const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const E = require('./engine.js');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const state = E.act(E.initial(), { type: 'show-chart' });
    state.port = null; state.position = E.N.project(-12, 40); state.motion.heading = 180;
    assert.ok(E.valid(state));
    async function seed(context) {
      await context.addInitScript(state => {
        if (!sessionStorage.getItem('motion-fixture')) {
          localStorage.setItem('windward-v1', JSON.stringify(state));
          localStorage.setItem('windward-audio-enabled', 'off');
          sessionStorage.setItem('motion-fixture', '1');
        }
      }, state);
    }
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    await seed(context);
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const url = process.env.BASE_URL || 'http://127.0.0.1:4173/?v=16';
    const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem(Windward.KEY)));
    await page.goto(url); await page.locator('#start-button').click();
    await page.locator('#voyage-canvas').focus(); await page.keyboard.press('ArrowDown');
    assert.equal((await saved()).motion.speed, 0);
    await page.waitForFunction(() => { const s = JSON.parse(localStorage.getItem(Windward.KEY)); return s.motion.speed > 0 && s.motion.speed < .6; });
    assert.match(await page.locator('#voyage-speed').innerText(), /가속 중/);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem(Windward.KEY)).motion.speed > .95);
    assert.match(await page.locator('#voyage-speed').innerText(), /순항/);
    await page.locator('#voyage-canvas').focus(); await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => { const s = JSON.parse(localStorage.getItem(Windward.KEY)); return s.motion.turning && s.motion.speed < .8; });
    assert.match(await page.locator('#voyage-speed').innerText(), /선회 중/);
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(() => JSON.parse(localStorage.getItem(Windward.KEY)).motion.speed > .95);
    await page.locator('#voyage-pause').click();
    const paused = await saved(); assert.equal(paused.motion.speed, 0);
    assert.equal(paused.motion.turning, false);
    await page.reload(); await page.locator('#start-button').click();
    assert.deepEqual((await saved()).position, paused.position);
    assert.equal((await saved()).motion.heading, paused.motion.heading);
    assert.equal((await saved()).motion.speed, 0);
    await page.locator('#voyage-pause').click();
    await page.waitForFunction(() => { const s = JSON.parse(localStorage.getItem(Windward.KEY)); return s.motion.speed > 0 && s.motion.speed < .6; });
    await page.locator('#open-chart-button').click();
    await page.waitForFunction(() => !document.getElementById('voyage-screen').hidden, null, { timeout: 4000 });
    assert.ok((await saved()).motion.speed > .9, 'Chart peek does not reset momentum');
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await seed(mobile);
    const phone = await mobile.newPage(); phone.on('pageerror', error => errors.push(error.message));
    await phone.goto(url); await phone.locator('#start-button').tap();
    const box = await phone.locator('#voyage-canvas').boundingBox();
    await phone.touchscreen.tap(box.x + box.width * .5, box.y + box.height * .82);
    await phone.waitForFunction(() => { const s = JSON.parse(localStorage.getItem(Windward.KEY)); return s.motion.speed > 0 && s.motion.speed < .6; });
    assert.match(await phone.locator('#voyage-speed').innerText(), /가속 중/);
    assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
    console.log('PASS: gradual launch, turn slowdown, straight recovery, live speed/heading, pause/reload/restart, chart momentum and mobile touch.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
