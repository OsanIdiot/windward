const { closeService, openService } = require('./browser-helpers.cjs');
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const testSave = () => page.evaluate(() => JSON.parse(localStorage.getItem(`${Windward.KEY}-test`)));
    const normalSave = () => page.evaluate(() => localStorage.getItem(Windward.KEY));
    await page.goto('http://127.0.0.1:4173/?v=7');await page.locator('#start-button').click();
    await openService(page,'market');await page.locator('#qty-grain').fill('10');
    await page.locator('[data-trade="grain"]').click();
    const original = await normalSave();
    await openService(page,'ship');
    assert.equal(await page.locator('#test-gold-button').count(), 0);
    await page.getByRole('link', { name: '테스트 모드 열기' }).click();
    assert.equal(await page.locator('.test-banner').isVisible(), true);
    await page.locator('#start-button').click();
    await openService(page,'ship');
    await page.locator('#test-gold-button').click();
    assert.equal((await testSave()).gold, 50540);
    for (let tier = 1; tier <= 6; tier++) {
      await page.locator('#upgrade-button').click();
      assert.equal((await testSave()).ship, tier);
      assert.equal((await testSave()).cargo.grain, 10);
      assert.ok(await page.evaluate(() => Windward.valid(JSON.parse(localStorage.getItem(`${Windward.KEY}-test`)))));
    }
    assert.equal(await page.locator('#upgrade-button').count(), 0);
    await page.locator('.ship-roster summary').click();
    assert.equal(await page.locator('.ship-roster li').count(), 7);
    assert.match(await page.locator('.ship-roster .current').innerText(), /7단계.*대양 기함/);
    await page.screenshot({ path: path.join(__dirname, 'ships-desktop.png'), fullPage: true });
    await openService(page,'market');
    await page.locator('[data-max="grain"]').click();
    await page.locator('[data-trade="grain"]').click();
    assert.equal((await testSave()).cargo.grain, 320);
    await page.reload();await page.locator('#start-button').click();
    assert.equal((await testSave()).ship, 6);
    assert.match(await page.locator('#cargo-count').innerText(), /320\s*\/\s*320/);
    assert.equal(await normalSave(), original);
    await closeService(page);await page.locator('#return-menu-button').click();await page.locator('#reset-button').click();
    await page.locator('#confirm-reset').click();
    assert.equal((await testSave()).ship, 0);
    await openService(page,'ship');
    await page.locator('#test-ship-button').click();
    assert.equal((await testSave()).ship, 6);
    assert.equal((await testSave()).gold, 700);
    assert.equal(await normalSave(), original);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Fits ${width}`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(__dirname, 'ships-mobile.png'), fullPage: true });
    await closeService(page);await page.locator('#return-menu-button').click();
    await page.getByRole('link', { name: '일반 플레이로 돌아가기' }).click();
    await page.locator('#start-button').click();
    assert.equal(await page.locator('.test-banner').count(), 0);
    assert.equal(await normalSave(), original);
    assert.match(await page.locator('#gold').innerText(), /540/);
    await openService(page,'ship');
    assert.match(await page.locator('.ship-portrait').innerText(), /1 \/ 7단계/);
    assert.equal(await page.locator('#test-ship-button').count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS: all seven ship tiers, purchase costs, preserved cargo, 320-unit capacity, max-ship shortcut, test funding, separate saves, reload/reset isolation, responsive layouts; no page errors.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
