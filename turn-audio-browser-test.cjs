const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const E = require('./engine.js');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const state = E.act(E.initial(), { type: 'show-chart' });
    state.port = null; state.position = E.N.project(18, 35); state.motion.heading = 180;
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    await context.addInitScript(state => {
      localStorage.setItem('windward-v1', JSON.stringify(state));
      localStorage.setItem('windward-audio-enabled', 'on');
      const Native = window.AudioContext;
      window.turnProbe = { contexts: [], creaks: [] };
      window.AudioContext = class extends Native {
        constructor(...args) {
          super(...args); turnProbe.contexts.push(this);
          const create = this.createBufferSource.bind(this);
          this.createBufferSource = () => {
            const source = create(), start = source.start.bind(source);
            source.start = (...args) => {
              if (Math.abs(source.buffer.duration - 1.25) < .001) {
                const samples = source.buffer.getChannelData(0);
                const record = { at: this.currentTime, ended: false, peak: samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0) };
                turnProbe.creaks.push(record);
                source.addEventListener('ended', () => { record.ended = true; });
              }
              start(...args);
            };
            return source;
          };
        }
      };
    }, state);
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const url = process.env.BASE_URL || 'http://127.0.0.1:4173/?v=18';
    await page.goto(url); await page.locator('#start-button').click();
    const steer = async key => { await page.locator('#voyage-canvas').focus(); await page.keyboard.press(key); };
    await steer('ArrowDown');
    await page.waitForFunction(() => JSON.parse(localStorage.getItem(Windward.KEY)).motion.speed > .95);
    assert.equal(await page.evaluate(() => turnProbe.creaks.length), 0, 'Straight sailing does not trigger turning creaks');
    await steer('ArrowRight');
    await page.waitForFunction(() => turnProbe.creaks.length > 0);
    assert.ok(await page.evaluate(() => turnProbe.creaks[0].peak > .1 && turnProbe.creaks[0].peak < 1), 'Non-silent synthesized friction without clipping');
    await page.locator('#open-chart-button').click();
    await page.waitForFunction(() => turnProbe.creaks.every(c => c.ended));
    assert.equal(await page.evaluate(() => turnProbe.creaks.length), 1, 'Chart switch and repeated frame updates do not layer duplicates');
    if (await page.locator('#return-sea-button').isVisible()) await page.locator('#return-sea-button').click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem(Windward.KEY)).motion.speed > .95);
    await steer('ArrowLeft');
    await page.waitForFunction(() => turnProbe.creaks.length === 2);
    const sound = page.locator('#game-screen [data-sound]');
    await sound.click();
    await page.waitForFunction(() => turnProbe.contexts[0].state === 'suspended');
    await page.locator('#voyage-pause').click();
    await sound.click();
    await page.waitForFunction(() => turnProbe.contexts[0].state === 'running' && turnProbe.creaks.every(c => c.ended));
    assert.equal(await page.evaluate(() => turnProbe.creaks.length), 2, 'Mute/resume while stopped does not replay queued creaks');
    await page.locator('#voyage-pause').click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem(Windward.KEY)).motion.speed > .95);
    const count = await page.evaluate(() => turnProbe.creaks.length);
    await steer('ArrowRight');
    await page.waitForFunction(n => turnProbe.creaks.length > n, count);
    await page.locator('#voyage-pause').click();
    await page.waitForFunction(() => turnProbe.creaks.every(c => c.ended));
    await page.locator('#voyage-rescue').click(); await page.locator('#voyage-enter-port').click();
    const portCount = await page.evaluate(() => turnProbe.creaks.length);
    await page.waitForFunction(() => turnProbe.contexts[0].currentTime > turnProbe.creaks.at(-1).at + 2.5);
    assert.equal(await page.evaluate(() => turnProbe.creaks.length), portCount, 'No creaks while docked');
    assert.equal(await page.evaluate(() => turnProbe.contexts.length), 1);
    assert.deepEqual(errors, []);
    console.log('PASS: actual steering triggers creaks, straight travel stays quiet, chart continuity, no duplicates, mute/pause/port cancellation.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
