const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage(), errors = [];
    await page.addInitScript(() => {
      const fixture = sessionStorage.getItem('chart-peek-fixture');
      if (fixture) {
        localStorage.setItem('windward-v1', fixture);
        sessionStorage.removeItem('chart-peek-fixture');
      }
    });
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('favicon.ico')) errors.push(response.status() + ' ' + response.url()); });
    const url = process.env.BASE_URL || 'http://127.0.0.1:4173/?v=13';
    const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem(Windward.KEY)));
    const mapVisible = () => page.locator('#chart-screen').isVisible();
    async function freshVoyage(arriving = false) {
      await page.evaluate(arriving => {
        let state = Windward.act(Windward.initial(), { type: 'show-chart' });
        state.visited.push('saffron', 'cedar');
        if (arriving) {
          state.port = null; state.lastPort = 'cedar';
          state.position = { x: state.position.x - 40, y: state.position.y };
        }
        state = Windward.act(state, { type: 'navigate', mode: 'auto', destination: arriving ? 'lume' : 'saffron' });
        sessionStorage.setItem('chart-peek-fixture', JSON.stringify(state));
      }, arriving);
      await page.reload(); await page.locator('#start-button').click();
      await page.locator('#voyage-pause').click();
    }
    await page.goto(url); await page.locator('#start-button').click(); await page.locator('#harbor-button').click();
    await page.locator('#open-chart-button').click();
    await page.waitForTimeout(3200);
    assert.equal(await mapVisible(), true, 'Stationary chart stays open');
    assert.equal(await page.locator('#chart-peek-note').isVisible(), false);
    await page.locator('#chart-world').click();
    async function clickWorld(lon, lat) {
      const point = await page.evaluate(([lon, lat]) => {
        const p = Windward.N.project(lon, lat);
        const c = new DOMPoint(p.x, p.y).matrixTransform(document.getElementById('sea-map').getScreenCTM());
        return { x: c.x, y: c.y };
      }, [lon, lat]);
      await page.mouse.click(point.x, point.y);
    }
    await clickWorld(-3.7, 40.4);
    assert.equal(await mapVisible(), true, 'Rejected land target does not switch views');
    await clickWorld(-12, 30);
    assert.equal(await page.locator('#voyage-screen').isVisible(), true, 'Manual departure switches immediately');
    assert.equal((await saved()).navigation.running, true);
    const before = await saved();
    await page.locator('#open-chart-button').click();
    assert.match(await page.locator('#chart-peek-note').innerText(), /3초/);
    await page.screenshot({ path: path.join(__dirname, 'chart-peek-desktop.png'), fullPage: true });
    await page.waitForTimeout(1200);
    assert.equal(await mapVisible(), true, 'Peek remains visible before three seconds');
    await page.waitForFunction(() => !document.getElementById('voyage-screen').hidden, null, { timeout: 3000 });
    assert.ok(Math.hypot((await saved()).position.x - before.position.x, (await saved()).position.y - before.position.y) > 1, 'Movement continues during peek');
    assert.equal(await page.locator('#voyage-heading').evaluate(el => document.activeElement === el), true);

    await freshVoyage();
    await page.locator('#mini-chart-button').click();
    await page.locator('#pause-sailing').click();
    await page.waitForTimeout(3200);
    assert.equal(await mapVisible(), true, 'Pause cancels auto-return');
    assert.equal(await page.locator('#chart-peek-note').isVisible(), false);
    await page.locator('#pause-sailing').click();
    assert.equal(await page.locator('#voyage-screen').isVisible(), true, 'Chart resume switches immediately');
    await page.locator('#open-chart-button').click();
    await page.locator('[data-chart-port="cedar"]').click();
    assert.equal(await page.locator('#voyage-screen').isVisible(), true, 'Automatic route switches immediately: ' + await page.locator('#toast').innerText());
    assert.equal((await saved()).navigation.targetPort, 'cedar');

    await freshVoyage();
    await page.locator('#open-chart-button').click();
    await page.waitForTimeout(1200);
    await page.locator('#return-sea-button').click();
    await page.locator('#mini-chart-button').click();
    await page.waitForTimeout(2100);
    assert.equal(await mapVisible(), true, 'Reopening starts a fresh three seconds');
    await page.waitForFunction(() => !document.getElementById('voyage-screen').hidden, null, { timeout: 2000 });

    await freshVoyage();
    await page.locator('#open-chart-button').click();
    const box = await page.locator('#sea-map').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2);
    await page.waitForTimeout(3200);
    assert.equal(await mapVisible(), true, 'No view switch during drag');
    await page.mouse.up();
    await page.waitForFunction(() => !document.getElementById('voyage-screen').hidden, null, { timeout: 4000 });

    await freshVoyage(true);
    await page.locator('#open-chart-button').click();
    await page.waitForFunction(() => !JSON.parse(localStorage.getItem(Windward.KEY)).navigation);
    await page.waitForTimeout(3200);
    assert.equal(await mapVisible(), true, 'Arrival cancels the countdown');
    await page.locator('#enter-port-button').click();
    assert.equal(await page.locator('#dock').isVisible(), true);

    await freshVoyage(); await page.locator('#open-chart-button').click();
    await page.locator('#return-menu-button').click(); await page.waitForTimeout(3200);
    assert.equal(await page.locator('#entry-screen').isVisible(), true, 'No delayed return from entry screen');
    await page.locator('#start-button').click();
    assert.equal(await mapVisible(), true);
    assert.equal((await saved()).navigation.running, false);

    await freshVoyage(); await page.locator('#open-chart-button').click();
    await page.locator('[data-help]').click();
    await page.waitForTimeout(3200);
    assert.equal(await mapVisible(), true, 'Help does not steal focus through an automatic return');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('voyage-screen').hidden, null, { timeout: 4000 });
    await page.locator('#open-chart-button').click();
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(3200);
    assert.equal(await mapVisible(), true, 'Background pause cancels the return');
    assert.equal((await saved()).navigation.running, false);

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const phone = await mobile.newPage(); phone.on('pageerror', error => errors.push(error.message));
    await phone.goto(url); await phone.locator('#start-button').tap(); await phone.locator('#harbor-button').tap();
    await phone.locator('#open-chart-button').tap();
    // Use the overview so a distant sea point is inside the mobile viewport.
    await phone.locator('#chart-world').tap();
    const target = await phone.evaluate(() => {
      const p = Windward.N.project(-12, 30), c = new DOMPoint(p.x, p.y).matrixTransform(document.getElementById('sea-map').getScreenCTM());
      return { x: c.x, y: c.y };
    });
    await phone.touchscreen.tap(target.x, target.y);
    assert.equal(await phone.locator('#voyage-screen').isVisible(), true);
    await phone.locator('#mini-chart-button').tap();
    await phone.screenshot({ path: path.join(__dirname, 'chart-peek-mobile.png'), fullPage: true });
    assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await phone.waitForFunction(() => !document.getElementById('voyage-screen').hidden, null, { timeout: 4000 });
    assert.deepEqual(errors, []);
    console.log('PASS: manual/auto departure and resume switch, three-second chart/minimap peek, uninterrupted movement, pause/arrival/menu cancellation, fresh timers, drag protection and mobile touch.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
