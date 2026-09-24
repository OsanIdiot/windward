const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const url = process.env.BASE_URL || 'http://127.0.0.1:4173/?v=21';
  const errors = [];
  try {
    async function setup() {
      const context = await browser.newContext({ reducedMotion: 'reduce' });
      await context.addInitScript(() => {
        const Native = window.AudioContext;
        window.loadingProbe = { contexts: [], decoded: 0, bells: 0 };
        window.AudioContext = class extends Native {
          constructor(...args) {
            super(...args); loadingProbe.contexts.push(this);
            const decode = this.decodeAudioData.bind(this), source = this.createBufferSource.bind(this);
            this.decodeAudioData = async bytes => { const buffer = await decode(bytes); loadingProbe.decoded++; return buffer; };
            this.createBufferSource = () => {
              const node = source(), start = node.start.bind(node);
              node.start = (...args) => { if (Math.abs(node.buffer.duration - 4.14) < .001) loadingProbe.bells++; start(...args); };
              return node;
            };
          }
        };
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      return { context, page };
    }
    for (const action of ['mute', 'depart', 'background', 'late']) {
      const { context, page } = await setup();
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      await page.route('**/assets/audio/arrival-bell.wav*', async route => { await gate; await route.continue(); });
      await page.goto(url);
      assert.equal(await page.evaluate(() => loadingProbe.contexts.length), 0);
      await page.locator('#start-button').click();
      await page.waitForFunction(() => loadingProbe.contexts[0]?.state === 'running' && loadingProbe.decoded === 8);
      await page.locator('#harbor-button').click(); await page.locator('#voyage-enter-port').click();
      if (action === 'mute') await page.locator('#game-screen [data-sound]').click();
      if (action === 'depart') await page.locator('#harbor-button').click();
      if (action === 'background') await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange'));
      });
      if (action === 'late') await new Promise(resolve => setTimeout(resolve, 1700));
      release();
      await page.waitForFunction(() => loadingProbe.decoded === 9);
      if (action === 'mute') await page.locator('#game-screen [data-sound]').click();
      if (action === 'background') await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
      await page.waitForFunction(() => loadingProbe.contexts[0].state === 'running');
      assert.equal(await page.evaluate(() => loadingProbe.bells), 0, `No stale bell after ${action}`);
      await context.close();
    }
    for (const broken of ['missing', 'corrupt']) {
      const { context, page } = await setup();
      let requests = 0;
      await page.route('**/assets/audio/**', route => {
        requests++;
        return route.fulfill({ status: broken === 'missing' ? 404 : 200, contentType: 'audio/wav', body: 'invalid audio' });
      });
      await page.goto(url);
      assert.equal(requests, 0, 'Entry page does not download sound files');
      await page.locator('#start-button').click();
      await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('소리 파일'));
      await page.locator('#harbor-button').click();
      await page.waitForFunction(() => loadingProbe.contexts[0].currentTime > 1);
      await page.locator('#voyage-enter-port').click();
      assert.equal(await page.locator('#harbor-button').isVisible(), true, `${broken} files do not block entry`);
      assert.equal(requests, 9, 'Failed files are not fetched again every frame');
      await context.close();
    }
    assert.deepEqual(errors, []);
    console.log('PASS: delayed loading cancels stale bells on mute/departure/background/timeout; missing/corrupt files keep game playable, no eager or repeated downloads.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
