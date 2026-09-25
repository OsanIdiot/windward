const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [320, 390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 740, hasTouch: width < 740 });
      await context.addInitScript(() => {
        // Deliberately conflicting old slider values must not change the fixed mix.
        localStorage.setItem('windward-audio-volumes', '{"master":0,"water":0.01,"bell":1}');
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
      await page.goto(process.env.BASE_URL || 'http://127.0.0.1:4176/?v=0.1.5');
      assert.equal(await page.locator('[data-volume-settings], #volume-dialog, [data-volume]').count(), 0);
      assert.equal(await page.evaluate(() => volumeProbe.contexts.length), 0);
      await page.locator('#start-button').click(); await page.locator('#harbor-button').click();
      await page.waitForFunction(() => volumeProbe.decoded === 9 && Math.abs(volumeProbe.gains[0].gain.value - .45) < .001 && Math.abs(volumeProbe.gains[1].gain.value - .009) < .0001);
      assert.ok(await page.evaluate(() => volumeProbe.gains[2].gain.value > .3), 'Wind is unchanged');
      await page.locator('#voyage-enter-port').click();
      await page.waitForFunction(() => volumeProbe.sources.some(s => Math.abs((s.buffer?.duration || 0) - 2.4) < .001 && Math.abs(s.testGain.gain.value - .16) < .001));
      await page.locator('#game-screen [data-sound]').click();
      assert.equal(await page.evaluate(() => localStorage.getItem('windward-audio-enabled')), 'off');
      await page.reload(); await page.locator('#start-button').click();
      assert.equal(await page.evaluate(() => volumeProbe.contexts.length), 0, 'Mute persists after reload');
      await page.locator('#game-screen [data-sound]').click(); await page.locator('#harbor-button').click();
      await page.waitForFunction(() => volumeProbe.decoded === 9 && Math.abs(volumeProbe.gains[1].gain.value - .009) < .0001);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.deepEqual(errors, []); await context.close();
      console.log('PASS ' + width + ': no volume UI, exact fixed levels, old settings ignored, sound toggle and reload');
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
