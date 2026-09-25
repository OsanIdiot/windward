const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const E = require('./engine.js');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const url = process.env.BASE_URL || 'http://127.0.0.1:4173/?v=31', errors = [];
  try {
    for (const mobile of [false, true]) {
      const context = await browser.newContext({ viewport: { width: mobile ? 390 : 1280, height: 844 }, isMobile: mobile, hasTouch: mobile });
      const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
      const click = selector => mobile ? page.locator(selector).tap() : page.locator(selector).click();
      const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem(Windward.KEY)));
      let fixture = E.act(E.initial(), { type: 'show-chart' });
      fixture.port = null; fixture.position = E.N.project(-12, 40);
      fixture.motion.heading = 180;
      fixture = E.act(fixture, { type: 'navigate', mode: 'manual', point: E.N.project(-12, 29) });
      await context.addInitScript(s => {
        if (!sessionStorage.getItem('braking-fixture')) {
          localStorage.setItem('windward-v1', JSON.stringify(s));
          localStorage.setItem('windward-audio-enabled', 'off');
          sessionStorage.setItem('braking-fixture', '1');
        }
      }, fixture);
      await page.goto(url); await click('#start-button'); await click('#voyage-pause');
      await page.waitForFunction(() => JSON.parse(localStorage.getItem(Windward.KEY)).motion.speed > .95);
      await click('#voyage-pause');
      assert.equal((await saved()).navigation.stopping, true);
      await page.waitForFunction(() => document.getElementById('voyage-speed').textContent.includes('감속 중'));
      assert.match(await page.locator('#voyage-speed').innerText(), /감속 중/);
      await page.waitForFunction(() => { const s = JSON.parse(localStorage.getItem(Windward.KEY)); return s.motion.speed < .85 && s.motion.speed > .25; });
      await click('#voyage-pause');
      assert.equal((await saved()).navigation.stopping, false);
      assert.ok((await saved()).motion.speed > .2, 'Continue retains the remaining speed');
      await page.waitForFunction(() => JSON.parse(localStorage.getItem(Windward.KEY)).motion.speed > .95);
      await click('#open-chart-button'); await click('#pause-sailing');
      assert.match(await page.locator('#navigation-status').innerText(), /감속 중/);
      await page.waitForFunction(() => !JSON.parse(localStorage.getItem(Windward.KEY)).navigation.running);
      await page.waitForTimeout(1100);
      assert.equal(await page.locator('#chart-screen').isVisible(), true, 'Stop cancels the chart return timer immediately');
      assert.equal((await saved()).motion.speed, 0);

      await click('#return-menu-button');
      await page.evaluate(() => {
        let s = Windward.act(Windward.initial(), { type: 'show-chart' });
        s.port = null; s.position.x -= 100; s.motion.heading = 90;
        s = Windward.act(s, { type: 'navigate', mode: 'auto', destination: 'lume' });
        localStorage.setItem(Windward.KEY, JSON.stringify(s));
      });
      await click('#start-button'); await page.locator('#game-screen').waitFor({ state: 'visible' });
      await click('#pause-sailing');
      await page.waitForFunction(() => { const s = JSON.parse(localStorage.getItem(Windward.KEY)); return s.motion.braking && s.navigation?.running; });
      await page.waitForFunction(() => document.getElementById('voyage-speed').textContent.includes('감속 중'));
      assert.match(await page.locator('#voyage-speed').innerText(), /감속 중/);
      assert.equal(await page.locator('#voyage-enter-port').count(), 0, 'Cannot dock while still drifting');
      await page.waitForFunction(() => !JSON.parse(localStorage.getItem(Windward.KEY)).navigation);
      assert.equal((await saved()).motion.speed, 0);
      await click('#voyage-enter-port'); assert.equal((await saved()).port, 'lume');
      await context.close();
    }
    assert.deepEqual(errors, []);
    console.log('PASS: desktop/mobile drift, braking HUD, momentum-preserving continue, chart stop timer, automatic approach braking and entry only after stopping.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
