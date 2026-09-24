const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

async function instrument(context) {
  await context.addInitScript(() => {
    const Native = window.AudioContext || window.webkitAudioContext;
    window.audioProbe = { contexts: [], oscillators: 0, sources: 0, gains: [] };
    window.AudioContext = class extends Native {
      constructor(...args) {
        super(...args);
        audioProbe.contexts.push(this);
        const gain = this.createGain.bind(this), oscillator = this.createOscillator.bind(this), source = this.createBufferSource.bind(this);
        this.createGain = () => { const node = gain(); audioProbe.gains.push(node); return node; };
        this.createOscillator = () => { audioProbe.oscillators++; return oscillator(); };
        this.createBufferSource = () => { audioProbe.sources++; return source(); };
      }
    };
  });
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const url = process.env.BASE_URL || 'http://127.0.0.1:4173/?v=12';
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    await instrument(context);
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('favicon.ico')) errors.push(response.status() + ' ' + response.url()); });
    await page.goto(url);
    assert.equal(await page.evaluate(() => audioProbe.contexts.length), 0, 'No autoplay on entry');
    await page.locator('#start-button').click();
    await page.waitForFunction(() => audioProbe.contexts[0]?.state === 'running');
    await page.evaluate(() => {
      const analyzer = audioProbe.contexts[0].createAnalyser();
      analyzer.fftSize = 2048; audioProbe.gains[0].connect(analyzer);
      audioProbe.rms = () => { const values = new Float32Array(2048); analyzer.getFloatTimeDomainData(values); return Math.sqrt(values.reduce((sum, v) => sum + v * v, 0) / values.length); };
    });
    assert.equal(await page.evaluate(() => audioProbe.rms()), 0, 'Port starts silent');
    await page.locator('#harbor-button').click();
    await page.waitForFunction(() => audioProbe.rms() > .001);
    await page.locator('#voyage-canvas').focus(); await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(() => audioProbe.gains[3].gain.value > .85);
    await page.locator('#voyage-pause').click();
    await page.waitForFunction(() => audioProbe.gains[3].gain.value < .65);
    await page.locator('#open-chart-button').click();
    assert.equal(await page.evaluate(() => audioProbe.contexts.length), 1);
    assert.equal(await page.evaluate(() => audioProbe.sources), 2, 'View switching does not duplicate sources');
    await page.locator('#return-sea-button').click();
    const sound = page.locator('#game-screen [data-sound]');
    await page.evaluate(() => { for (let i = 0; i < 8; i++) document.querySelector('#game-screen [data-sound]').click(); });
    await page.waitForFunction(() => audioProbe.contexts[0].state === 'running');
    assert.equal(await sound.getAttribute('aria-pressed'), 'true');
    await sound.click();
    await page.waitForFunction(() => audioProbe.contexts[0].state === 'suspended');
    assert.equal(await sound.getAttribute('aria-pressed'), 'false');
    await page.reload();
    assert.equal(await page.locator('#entry-screen [data-sound]').getAttribute('aria-pressed'), 'false');
    await page.locator('#start-button').click();
    assert.equal(await page.evaluate(() => audioProbe.contexts.length), 0, 'Muted preference does not create an audio graph');
    await sound.click();
    await page.waitForFunction(() => audioProbe.contexts[0]?.state === 'running');
    await page.locator('#voyage-rescue').click();
    await page.locator('#voyage-enter-port').click();
    assert.equal(await page.evaluate(() => audioProbe.oscillators), 6, 'Two swells plus four bell partials');
    await page.waitForFunction(() => audioProbe.gains[3].gain.value < .01 && audioProbe.gains[6].gain.value < .01);
    await page.locator('#harbor-button').click();
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForFunction(() => audioProbe.contexts[0].state === 'suspended');
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    await page.locator('#voyage-canvas').click({ position: { x: 30, y: 200 } });
    await page.waitForFunction(() => audioProbe.contexts[0].state === 'running');
    await page.locator('#return-menu-button').click();
    await page.waitForFunction(() => audioProbe.contexts[0].state === 'suspended');
    await page.locator('#start-button').click();
    await page.waitForFunction(() => audioProbe.contexts[0].state === 'running');
    assert.equal(await page.evaluate(() => audioProbe.contexts.length), 1);
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Fits ${width}`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(__dirname, 'audio-mobile.png'), fullPage: true });
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await instrument(mobile);
    const phone = await mobile.newPage(); phone.on('pageerror', error => errors.push(error.message));
    await phone.goto(url); await phone.locator('#start-button').tap(); await phone.locator('#harbor-button').tap();
    await phone.waitForFunction(() => audioProbe.contexts[0]?.state === 'running');
    await phone.locator('#game-screen [data-sound]').tap();
    await phone.waitForFunction(() => audioProbe.contexts[0]?.state === 'suspended');
    const unsupported = await browser.newContext();
    await unsupported.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; });
    const quiet = await unsupported.newPage(); quiet.on('pageerror', error => errors.push(error.message));
    await quiet.goto(url); await quiet.locator('#start-button').click(); await quiet.locator('#harbor-button').click();
    assert.equal(await quiet.locator('#game-screen [data-sound]').isDisabled(), true);
    assert.equal(await quiet.locator('#voyage-screen').isVisible(), true);
    assert.deepEqual(errors, []);
    console.log('PASS: real Web Audio signal, gesture unlock, motion/idle mix, shared chart audio, mute persistence, entry bells, background/menu suspension, mobile touch, responsive controls and unsupported-browser fallback.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
