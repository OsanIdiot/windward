const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage(), requested = [], errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (r.url().includes('/assets/audio/')) requested.push(new URL(r.url()).pathname); });
    await page.route('**/audio-config.js*', async route => {
      const response = await route.fetch();
      const body = await response.text();
      // A future music entry must never become an ambient effects loop.
      await route.fulfill({ response, body: body + '\nWindwardAudio.music.tracks.probe = {file:"assets/audio/music-probe.wav",gain:1,loop:true};' });
    });
    await page.addInitScript(() => {
      const Native = window.AudioContext;
      window.categoryProbe = { decoded: 0, loops: 0 };
      window.AudioContext = class extends Native {
        constructor(...args) {
          super(...args);
          const decode = this.decodeAudioData.bind(this), source = this.createBufferSource.bind(this);
          this.decodeAudioData = async bytes => { const result = await decode(bytes); categoryProbe.decoded++; return result; };
          this.createBufferSource = () => {
            const node = source(), start = node.start.bind(node);
            node.start = (...args) => { if (node.loop) categoryProbe.loops++; start(...args); };
            return node;
          };
        }
      };
    });
    await page.goto(process.env.BASE_URL || 'http://127.0.0.1:4173/?v=37');
    assert.equal(requested.length, 0);
    await page.locator('#start-button').click();
    await page.locator('#harbor-button').click();
    await page.waitForFunction(() => categoryProbe.decoded === 9 && categoryProbe.loops === 4);
    const expected = await page.evaluate(() => Object.values(WindwardAudio.sfx.sounds).map(s => new URL(s.file, document.baseURI).pathname));
    assert.deepEqual(requested.sort(), expected.sort());
    await page.locator('#open-chart-button').click(); await page.locator('#return-sea-button').click();
    await page.locator('#voyage-enter-port').click();
    assert.equal(requested.length, 9);
    assert.equal(await page.evaluate(() => categoryProbe.loops), 4);
    assert.deepEqual(errors, []);
    console.log('PASS: only nine SFX are fetched, four effects loops, no music fetching or playback, and no duplicates across screens.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
