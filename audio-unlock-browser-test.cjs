const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--autoplay-policy=document-user-activation-required'] });
  const url = process.env.BASE_URL || 'http://127.0.0.1:4173/?v=34', errors = [];
  try {
    for (const mobile of [false, true]) {
      const c = await browser.newContext({ viewport: { width: mobile ? 390 : 1280, height: 844 }, isMobile: mobile, hasTouch: mobile });
      await c.addInitScript(() => {
        if (!/^https?:$/.test(location.protocol)) return;
        window.audioProbe = { contexts: [], blocked: 0, gestures: 0, buffers: [] };
        const Native = window.AudioContext;
        window.AudioContext = class extends Native {
          constructor(...args) {
            super(...args); audioProbe.contexts.push(this);
            this.suspend();
            const resume = this.resume.bind(this), gain = this.createGain.bind(this), source = this.createBufferSource.bind(this);
            // Reproduce a browser that leaves autoplay resume promises pending.
            this.resume = () => {
              const e = window.event;
              const allowed = e?.isTrusted && (['touchend', 'click', 'keydown'].includes(e.type)
                || e.type === 'pointerup' && e.pointerType !== 'mouse'
                || e.type === 'pointerdown' && e.pointerType === 'mouse');
              if (!allowed) { audioProbe.blocked++; return new Promise(() => {}); }
              audioProbe.gestures++; return resume();
            };
            this.createGain = () => {
              const node = gain();
              if (!audioProbe.rms) {
                const analyzer = this.createAnalyser(); analyzer.fftSize = 2048; node.connect(analyzer);
                audioProbe.rms = () => { const samples = new Float32Array(2048); analyzer.getFloatTimeDomainData(samples); return Math.sqrt(samples.reduce((s, x) => s + x * x, 0) / samples.length); };
              }
              return node;
            };
            this.createBufferSource = () => {
              const node = source(), start = node.start.bind(node);
              node.start = (...args) => { audioProbe.buffers.push({ loop: node.loop, duration: node.buffer?.duration }); start(...args); };
              return node;
            };
          }
        };
      });
      const p = await c.newPage(); p.on('pageerror', e => errors.push(e.message));
      const click = s => mobile ? p.locator(s).tap() : p.locator(s).click();
      const ready = s => p.locator(s).waitFor({ state: 'visible' });
      const sound = '#game-screen [data-sound]';
      const waitBlocked = async () => {
        await p.waitForFunction(() => audioProbe.blocked > 0 && audioProbe.contexts[0]?.state === 'suspended');
        assert.equal(await p.locator(sound).innerText(), '소리 재개');
      };
      const waitAudio = async () => {
        await p.waitForFunction(() => audioProbe.contexts[0]?.state === 'running');
        await p.waitForFunction(() => audioProbe.rms?.() > .0001);
        assert.equal(await p.locator(sound).innerText(), '소리 켜짐');
        assert.notEqual(await p.evaluate(() => localStorage.getItem('windward-audio-enabled')), 'off');
      };
      await p.goto(url); await click('#start-button'); await ready('#dock');
      await click('#harbor-button'); await ready('#voyage-screen'); await waitBlocked();
      await click('#voyage-heading'); await waitAudio();
      assert.ok(await p.evaluate(() => audioProbe.gestures > 0), 'A later gesture retries even with a pending resume');
      await click('#open-chart-button'); await click('#return-sea-button');
      assert.equal(await p.evaluate(() => audioProbe.contexts.length), 1);

      await p.reload(); await click('#start-button'); await ready('#voyage-screen'); await waitBlocked();
      await click(sound); await waitAudio();
      assert.equal(await p.evaluate(() => audioProbe.contexts.length), 1, 'Resume reuses the existing graph');
      await click(sound);
      await p.waitForFunction(() => audioProbe.contexts[0].state === 'suspended');
      assert.equal(await p.locator(sound).innerText(), '소리 꺼짐');
      await click('#voyage-heading');
      assert.equal(await p.evaluate(() => audioProbe.contexts[0].state), 'suspended', 'General touches never unmute');
      await p.reload(); await click('#start-button'); await ready('#voyage-screen');
      assert.equal(await p.evaluate(() => audioProbe.contexts.length), 0, 'Mute survives full document loading');
      await click(sound); await waitAudio();

      await click('#voyage-enter-port'); await ready('#dock'); await waitBlocked();
      await p.waitForTimeout(2200);
      await click(sound);
      await p.waitForFunction(() => audioProbe.contexts[0]?.state === 'running');
      assert.equal(await p.evaluate(() => audioProbe.buffers.filter(b => !b.loop && Math.abs(b.duration - 4.14) < .001).length), 0, 'Late unlock never replays an old arrival bell');
      await click('#harbor-button'); await ready('#voyage-screen'); await waitBlocked();
      if (mobile) await click('#voyage-heading');
      else { await p.locator('#voyage-canvas').focus(); await p.keyboard.press('ArrowLeft'); }
      await waitAudio();
      await c.close();
    }
    assert.deepEqual(errors, []);
    console.log('PASS: pending autoplay retries on real touch/mouse/key gestures, resume button does not mute, actual audio signal, one graph, mute persistence and no stale arrival bell.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
