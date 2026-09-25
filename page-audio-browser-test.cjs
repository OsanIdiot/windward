const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--autoplay-policy=document-user-activation-required'] });
  const url = process.env.BASE_URL || 'http://127.0.0.1:4173/?v=33', errors = [];
  try {
    for (const mobile of [false, true]) {
      const c = await browser.newContext({ viewport: { width: mobile ? 390 : 1280, height: 844 }, isMobile: mobile, hasTouch: mobile });
      await c.addInitScript(() => {
        if (!/^https?:$/.test(location.protocol)) return;
        window.documentId = crypto.randomUUID(); window.audioProbe = { contexts: [], buffers: [], decoded: 0 };
        if (!sessionStorage.getItem('audio-fixture')) {
          localStorage.setItem('windward-audio-enabled', 'on'); sessionStorage.setItem('audio-fixture', '1');
        }
        const Native = window.AudioContext;
        window.AudioContext = class extends Native {
          constructor(...args) {
            super(...args); audioProbe.contexts.push(this);
            const decode = this.decodeAudioData.bind(this), gain = this.createGain.bind(this), source = this.createBufferSource.bind(this);
            this.decodeAudioData = async bytes => { const buffer = await decode(bytes); audioProbe.decoded++; return buffer; };
            this.createGain = () => {
              const node = gain();
              if (!audioProbe.rms) {
                const analyzer = this.createAnalyser(); analyzer.fftSize = 2048; node.connect(analyzer);
                audioProbe.rms = () => { const samples = new Float32Array(2048); analyzer.getFloatTimeDomainData(samples); return Math.sqrt(samples.reduce((sum, v) => sum + v * v, 0) / samples.length); };
              }
              return node;
            };
            this.createBufferSource = () => {
              const node = source(), start = node.start.bind(node), record = { ended: false };
              node.start = (...args) => { record.duration = node.buffer?.duration; record.loop = node.loop; audioProbe.buffers.push(record); start(...args); };
              node.addEventListener('ended', () => { record.ended = true; }); return node;
            };
          }
        };
      });
      const p = await c.newPage(); p.on('pageerror', e => errors.push(e.message));
      const hop = async (selector, screen) => {
        const old = await p.evaluate(() => documentId);
        if (mobile) await p.locator(selector).tap(); else await p.locator(selector).click();
        await p.locator(screen).waitFor({ state: 'visible' }); await p.locator('#page-transition').waitFor({ state: 'hidden' });
        assert.equal(await p.evaluate(() => documentId), old);
      };
      const audioReady = () => p.waitForFunction(() => audioProbe.contexts[0]?.state === 'running' && audioProbe.decoded === 9);
      const bellCount = () => p.evaluate(() => audioProbe.buffers.filter(b => !b.loop && Math.abs(b.duration - 4.14) < .001).length);
      await p.goto(url); assert.equal(await p.evaluate(() => audioProbe.contexts.length), 0);
      await hop('#start-button', '#dock'); await audioReady(); assert.equal(await bellCount(), 0);
      await hop('#harbor-button', '#voyage-screen'); await audioReady();
      await p.waitForFunction(() => audioProbe.rms() > .0001); assert.equal(await p.evaluate(() => audioProbe.contexts.length), 1);
      const seaDoc = await p.evaluate(() => documentId);
      await p.locator('#open-chart-button').click(); await p.locator('#return-sea-button').click();
      assert.equal(await p.evaluate(() => documentId), seaDoc); assert.equal(await p.evaluate(() => audioProbe.contexts.length), 1);
      await hop('#voyage-enter-port', '#dock'); await audioReady();
      await p.waitForFunction(() => audioProbe.buffers.some(b => !b.loop && Math.abs(b.duration - 4.14) < .001));
      assert.equal(await bellCount(), 1, 'Entry rings once without another sound-button press');
      await p.locator('[data-service="market"]').click(); await p.locator('#close-service').click();
      assert.equal(await bellCount(), 1);
      await p.reload(); await p.locator('#entry-screen').waitFor({ state: 'visible' });
      assert.equal(await p.evaluate(() => audioProbe.contexts.length), 0);
      await hop('#start-button', '#dock'); await audioReady(); assert.equal(await bellCount(), 0, 'Reload/continue does not replay entry');
      await p.locator('#game-screen [data-sound]').click();
      await hop('#harbor-button', '#voyage-screen');
      assert.equal(await p.evaluate(() => audioProbe.contexts.length), 1, 'The muted graph is retained across screen refresh');
      await p.waitForFunction(() => audioProbe.contexts[0].state === 'suspended');
      await hop('#voyage-enter-port', '#dock'); assert.equal(await bellCount(), 0);
      await p.locator('#game-screen [data-sound]').click(); await audioReady();
      assert.equal(await bellCount(), 0, 'Unmuting must not replay a muted arrival');
      await hop('#harbor-button', '#voyage-screen'); await hop('#voyage-enter-port', '#dock');
      await p.waitForFunction(() => audioProbe.buffers.some(b => !b.loop && Math.abs(b.duration - 4.14) < .001));
      assert.equal(await bellCount(), 1);
      await c.close();
    }
    const quiet = await browser.newContext();
    await quiet.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; });
    const p = await quiet.newPage(); p.on('pageerror', e => errors.push(e.message));
    await p.goto(url); await p.locator('#start-button').click(); await p.locator('#harbor-button').click();
    await p.locator('#voyage-screen').waitFor({ state: 'visible' });
    assert.equal(await p.locator('#game-screen [data-sound]').isDisabled(), true);
    await quiet.close(); assert.deepEqual(errors, []);
    console.log('PASS: one gesture-unlocked audio graph across screens, bell once per entry without Resume, no reload/mute replay, desktop/mobile playback and unsupported audio fallback.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
