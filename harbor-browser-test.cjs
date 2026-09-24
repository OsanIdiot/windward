const { openChart } = require('./browser-helpers.cjs');
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
    const url = process.env.BASE_URL || 'http://127.0.0.1:4173/?v=7';
    await page.goto(url);
    await page.locator('#start-button').click();await openChart(page);
    await page.locator('.harbor-background').evaluate(img => img.decode());
    assert.equal(await page.locator('#service-dialog').isVisible(), false);
    assert.equal(await page.locator('#qty-grain').isVisible(), false);
    await page.screenshot({ path: path.join(__dirname, 'harbor-town-desktop.png'), fullPage: true });
    const state = await page.evaluate(() => localStorage.getItem(Windward.KEY));
    for (const name of ['market', 'adventure', 'contracts', 'ship', 'log']) {
      await page.locator(`[data-service="${name}"]`).click();
      assert.equal(await page.locator('#service-dialog').isVisible(), true);
      assert.equal(await page.locator('#tab-' + name).getAttribute('aria-selected'), 'true');
      assert.equal(await page.locator('#dock-content').isVisible(), true);
      if (name === 'market') await page.screenshot({ path: path.join(__dirname, 'harbor-market-desktop.png'), fullPage: true });
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#service-dialog').isVisible(), false);
      assert.equal(await page.locator(`[data-service="${name}"]`).evaluate(el => document.activeElement === el), true);
    }
    assert.equal(await page.evaluate(() => localStorage.getItem(Windward.KEY)), state);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      const boxes = await page.locator('.place-button').evaluateAll(els => els.map(el => { const r = el.getBoundingClientRect(); return { x:r.x,y:r.y,w:r.width,h:r.height }; }));
      for (const [i, a] of boxes.entries()) {
        assert.ok(a.x >= 0 && a.x + a.w <= width, `Button fits ${width}`);
        assert.ok(a.h >= 44, 'Touch size');
        for (const b of boxes.slice(i + 1)) assert.ok(a.x+a.w<=b.x || b.x+b.w<=a.x || a.y+a.h<=b.y || b.y+b.h<=a.y, `No overlapping buttons at ${width}`);
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.locator('[data-service="market"]').click();
      const r = await page.locator('#service-dialog').boundingBox();
      assert.ok(r.width <= width && r.height <= 844);
      await page.locator('#close-service').click();
    }
    const mobile = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
    const phone = await mobile.newPage();
    phone.on('pageerror', e => errors.push(e.message));
    await phone.goto(url);await phone.locator('#start-button').tap();
    await phone.locator('.harbor-background').evaluate(img => img.decode());
    await phone.screenshot({path:path.join(__dirname,'harbor-town-mobile.png'),fullPage:true});
    await phone.locator('[data-service="market"]').tap();
    await phone.locator('#qty-grain').fill('2');await phone.locator('[data-trade="grain"]').tap();
    assert.equal(await phone.evaluate(()=>JSON.parse(localStorage.getItem(Windward.KEY)).cargo.grain),2);
    await phone.screenshot({path:path.join(__dirname,'harbor-market-mobile.png'),fullPage:true});
    await phone.locator('#close-service').tap();
    await phone.locator('#harbor-button').tap();await openChart(phone);
    assert.equal(await phone.locator('#chart-screen').isVisible(),true);
    assert.equal(await phone.locator('#dock').isVisible(),false);
    await phone.locator('#enter-port-button').tap();
    assert.equal(await phone.locator('.harbor-town').isVisible(),true);
    assert.equal(await phone.locator('#service-dialog').isVisible(),false);
    await phone.reload();await phone.locator('#start-button').tap();
    assert.equal(await phone.locator('#service-dialog').isVisible(),false);
    assert.deepEqual(errors, []);
    console.log('PASS: generated harbor asset, all five facility windows, keyboard/focus return, non-overlapping responsive hotspots, mobile trading, chart/entry round-trip, closed-on-reload and no browser errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
