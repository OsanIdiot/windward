const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [];
  try {
    for (const [width, height] of [[320,568], [390,844], [412,915], [768,1024], [844,390]]) {
      const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(process.env.BASE_URL || 'http://127.0.0.1:4173/?v=23');
      await page.locator('#start-button').tap();
      const checkHeight = async (screen, allowance = 0) => {
        const size = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight, vh: innerHeight, vw: innerWidth }));
        assert.ok(size.w <= size.vw, `${screen}: no horizontal overflow at ${width}`);
        assert.ok(size.h <= size.vh + allowance, `${screen}: ${size.h} exceeds ${size.vh} + ${allowance} at ${width}`);
      };
      await checkHeight('harbor', width > height ? 150 : 0);
      const boxes = await page.locator('.place-button').evaluateAll(els => els.map(el => {
        const r = el.getBoundingClientRect(); return { x:r.x, y:r.y, w:r.width, h:r.height };
      }));
      for (const [i, a] of boxes.entries()) {
        assert.ok(a.x >= 0 && a.x + a.w <= width && a.h >= 44, 'Harbor targets fit');
        for (const b of boxes.slice(i + 1)) assert.ok(a.x+a.w<=b.x || b.x+b.w<=a.x || a.y+a.h<=b.y || b.y+b.h<=a.y, 'Harbor targets do not overlap');
      }
      await page.locator('[data-service="market"]').tap();
      const dialog = await page.locator('#service-dialog').boundingBox();
      assert.ok(dialog.y >= 0 && dialog.y + dialog.height <= height + 1, 'Service dialog fits viewport');
      await page.locator('#service-dialog').evaluate(el => { el.scrollTop = el.scrollHeight; });
      await page.locator('#close-service').tap();
      await page.locator('#harbor-button').tap();
      await checkHeight('sailing', width > height ? 160 : 0);
      await page.locator('.helm-help summary').tap();
      await page.locator('.helm-help p').last().scrollIntoViewIfNeeded();
      await page.locator('.helm-help summary').tap();
      await page.locator('#open-chart-button').tap();
      assert.equal(await page.locator('#chart-details').evaluate(el => el.open), false);
      await checkHeight('chart', width > height ? 220 : width === 320 ? 24 : 0);
      await page.locator('.port-chip').last().scrollIntoViewIfNeeded();
      assert.ok(await page.locator('.port-selector').evaluate(el => el.scrollLeft > 0), 'Port list scrolls horizontally');
      await page.locator('#chart-details summary').tap();
      await page.locator('#adventure-checks').scrollIntoViewIfNeeded();
      assert.ok(await page.evaluate(() => scrollY > 0), 'Expanded information remains scrollable');
      await page.locator('#chart-details summary').tap();
      await page.evaluate(() => scrollTo(0, 0));
      if (width === 320 || width === 390) await page.screenshot({ path: path.join(__dirname, `mobile-layout-${width}-chart.png`), fullPage: true });
      if (width === 390) {
        await page.setViewportSize({ width: 1200, height: 900 });
        await page.waitForFunction(() => document.getElementById('chart-details').open);
        assert.equal(await page.locator('#chart-details').evaluate(el => el.open), true, 'Desktop shows information by default');
        await page.setViewportSize({ width, height });
        await page.waitForFunction(() => !document.getElementById('chart-details').open);
        assert.equal(await page.locator('#chart-details').evaluate(el => el.open), false, 'Returning to mobile collapses information');
        await page.locator('#chart-world').tap();
        const target = await page.evaluate(() => {
          const p = Windward.N.project(-12,30), c = new DOMPoint(p.x,p.y).matrixTransform(document.getElementById('sea-map').getScreenCTM());
          return { x:c.x,y:c.y };
        });
        await page.touchscreen.tap(target.x, target.y);
        await page.locator('#open-chart-button').tap();
        await checkHeight('moving chart');
        await page.locator('#chart-details summary').tap();
        await page.waitForTimeout(3300);
        assert.equal(await page.locator('#chart-screen').isVisible(), true, 'Reading details holds the chart open');
        await page.locator('#chart-details summary').tap();
        await page.waitForFunction(() => !document.getElementById('voyage-screen').hidden, null, { timeout: 4000 });
        await page.locator('#voyage-pause').tap();
      }
      if (await page.locator('#return-sea-button').isVisible()) await page.locator('#return-sea-button').tap();
      if (width === 320 || width === 390) await page.screenshot({ path: path.join(__dirname, `mobile-layout-${width}-sea.png`), fullPage: true });
      await context.close();
    }
    assert.deepEqual(errors, []);
    console.log('PASS: compact mobile harbor/sailing/chart, accessible help/dialog scrolling, horizontal port list, responsive details and protected chart reading.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
