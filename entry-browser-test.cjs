const { closeService, openService, openChart } = require('./browser-helpers.cjs');
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('favicon.ico')) errors.push(r.status() + ' ' + r.url()); });
    const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem(Windward.KEY)));
    await page.goto(process.env.BASE_URL || 'http://127.0.0.1:4173/?v=7');
    assert.equal(await page.locator('#entry-screen').isVisible(), true);
    assert.equal(await page.locator('#game-screen').isVisible(), false);
    assert.equal(await page.locator('footer').count(), 0);
    assert.match(await page.locator('#start-button').innerText(), /항해 시작/);
    assert.equal(await saved(), null);
    await page.screenshot({ path: path.join(__dirname, 'entry-desktop.png'), fullPage: true });
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Entry fits ${width}`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(__dirname, 'entry-mobile.png'), fullPage: true });
    await page.locator('#help-button').click();
    assert.equal(await page.locator('#help-dialog').isVisible(), true);
    await page.keyboard.press('Escape');
    await page.locator('#start-button').click();await openChart(page);
    assert.equal(await page.locator('#entry-screen').isVisible(), false);
    assert.equal(await page.locator('.masthead').isVisible(), false);
    assert.equal(await page.locator('.intro').isVisible(), false);
    assert.equal(await page.locator('#reset-button').isVisible(), false);
    assert.equal(await page.locator('#dock').isVisible(), true);
    assert.ok((await page.locator('.game-stats').boundingBox()).y < 70);
    await page.screenshot({ path: path.join(__dirname, 'game-clean-mobile.png'), fullPage: true });
    await openService(page,'market');await page.locator('#qty-grain').fill('10');
    await page.locator('[data-trade="grain"]').click();
    const before = await saved();
    await closeService(page);await page.locator('#return-menu-button').click();
    assert.match(await page.locator('#start-button').innerText(), /이어하기/);
    assert.equal(await page.locator('#reset-button').isVisible(), true);
    assert.deepEqual(await saved(), before);
    await page.locator('#reset-button').click();
    await page.keyboard.press('Escape');
    assert.deepEqual(await saved(), before);
    await page.reload();
    assert.equal(await page.locator('#entry-screen').isVisible(), true);
    assert.match(await page.locator('#entry-summary').innerText(), /540 G/);
    await page.locator('#start-button').click();await openChart(page);
    await closeService(page);await page.locator('#harbor-button').click();await openChart(page);
    const target = await page.evaluate(() => {
      const p = Windward.N.project(-11, 38.4), svg = document.getElementById('sea-map');
      const c = new DOMPoint(p.x, p.y).matrixTransform(svg.getScreenCTM());
      return { x: c.x, y: c.y };
    });
    await page.mouse.click(target.x, target.y);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem(Windward.KEY))?.navigation?.running);
    await closeService(page);await page.locator('#return-menu-button').click();
    const paused = await saved();
    assert.equal(paused.navigation.running, false);
    await page.waitForTimeout(350);
    assert.deepEqual(await saved(), paused);
    await page.locator('#start-button').click();await openChart(page);
    assert.equal(await page.locator('#chart-screen').isVisible(), true);
    assert.equal(await page.locator('#pause-sailing').innerText(), '계속');
    await closeService(page);await page.locator('#return-menu-button').click();
    await page.locator('#reset-button').click();
    await page.locator('#confirm-reset').click();
    await page.locator('#reset-dialog').waitFor({ state: 'hidden' });
    assert.equal((await saved()).gold, 700);
    assert.equal((await saved()).cargo.grain, 0);
    assert.equal(await page.locator('#dock').isVisible(), true);
    assert.deepEqual(errors, []);
    console.log('PASS: title-only entry, clean game view, responsive entry, help, start/continue, persisted progress, reset cancel/confirm, pause on menu return, no footer or browser errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
