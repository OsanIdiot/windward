const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [320, 390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 740, hasTouch: width < 740 });
      await context.addInitScript(() => {
        const Native = AudioContext;
        window.volumeProbe = { gains: [], sources: [], contexts: [], decoded: 0 };
        window.AudioContext = class extends Native {
          constructor(...args) {
            super(...args); volumeProbe.contexts.push(this);
            const gain = this.createGain.bind(this), source = this.createBufferSource.bind(this), decode = this.decodeAudioData.bind(this);
            this.createGain = () => { const node = gain(); volumeProbe.gains.push(node); return node; };
            this.decodeAudioData = async b => { const result = await decode(b); volumeProbe.decoded++; return result; };
            this.createBufferSource = () => {
              const node = source(), connect = node.connect.bind(node);
              node.connect = destination => { node.testGain = destination; return connect(destination); };
              volumeProbe.sources.push(node); return node;
            };
          }
        };
      });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(process.env.BASE_URL || 'http://127.0.0.1:4176/?v=0.1.4');
      const set = async (name, value) => page.locator(`#volume-${name}`).evaluate((el, value) => {
        el.value = value; el.dispatchEvent(new Event('input', { bubbles: true }));
      }, String(value));
      await page.locator('#entry-screen [data-volume-settings]').click();
      await set('master', 50); await set('water', 40); await set('bell', 25);
      assert.equal(await page.evaluate(() => volumeProbe.contexts.length), 0, 'Entry settings do not initialize audio');
      await page.locator('#volume-bell').focus(); await page.keyboard.press('ArrowLeft');
      assert.equal(await page.locator('#volume-bell-value').innerText(), '20%');
      await page.screenshot({ path: path.join(__dirname, `volume-${width}.png`), fullPage: true });
      assert.equal(await page.locator('#volume-dialog').evaluate(d => d.scrollWidth <= d.clientWidth + 1), true);
      await page.locator('[data-close="volume-dialog"]').click();
      await page.locator('#start-button').click(); await page.locator('#harbor-button').click();
      await page.waitForFunction(() => volumeProbe.decoded === 9 && Math.abs(volumeProbe.gains[0].gain.value - .225) < .002 && Math.abs(volumeProbe.gains[1].gain.value - .024) < .002);
      await page.locator('#game-screen [data-volume-settings]').click();
      await set('water', 0);
      await page.waitForFunction(() => volumeProbe.gains[1].gain.value < .0001);
      assert.ok(await page.evaluate(() => volumeProbe.gains[2].gain.value > .3), 'Water slider leaves wind intact');
      await set('water', 40);
      await page.locator('[data-close="volume-dialog"]').click();
      await page.locator('#voyage-enter-port').click();
      await page.waitForFunction(() => volumeProbe.sources.some(s => Math.abs((s.buffer?.duration || 0) - 2.4) < .001 && Math.abs(s.testGain.gain.value - .16) < .002));
      await page.locator('#game-screen [data-sound]').click();
      await page.locator('#game-screen [data-volume-settings]').click(); await set('master', 0);
      assert.equal(await page.evaluate(() => localStorage.getItem('windward-audio-enabled')), 'off');
      await page.reload(); await page.locator('#entry-screen [data-volume-settings]').click();
      assert.equal(await page.locator('#volume-master').inputValue(), '0');
      assert.equal(await page.locator('#volume-water').inputValue(), '40');
      assert.equal(await page.locator('#volume-bell').inputValue(), '20');
      await page.locator('#volume-reset').click();
      assert.equal(await page.locator('#volume-master').inputValue(), '100');
      assert.equal(await page.locator('#volume-water').inputValue(), '100');
      assert.equal(await page.evaluate(() => localStorage.getItem('windward-audio-enabled')), 'off');
      assert.equal(await page.evaluate(() => volumeProbe.contexts.length), 0);
      assert.deepEqual(errors, []); await context.close();
      console.log(`PASS ${width}: live gains, water mute, bell level, keyboard, storage/reload, reset, no eager audio or layout overflow`);
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
