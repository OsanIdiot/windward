const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const [width, height] of [[390, 844], [1280, 800]]) {
      const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 740, hasTouch: width < 740, reducedMotion: 'no-preference' });
      await context.addInitScript(() => {
        localStorage.setItem('windward-audio-enabled', 'off');
        Object.defineProperty(window, 'createVoyageUI', { configurable: true, set(factory) {
          this.lookFactory = options => { const ui = factory(options); window.lookProbe = { ui, read: options.read }; return ui; };
        }, get() { return this.lookFactory; } });
      });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('favicon.ico')) errors.push(r.status() + ' ' + r.url()); });
      await page.goto(process.env.BASE_URL || 'http://127.0.0.1:4173/?v=look');
      await page.locator('#start-button').click(); await page.locator('#harbor-button').click();
      await page.locator('#voyage-screen').waitFor({ state: 'visible' });
      const toggle = page.locator('#voyage-look-toggle');
      assert.equal(await page.locator('#voyage-stage').getAttribute('data-look'), 'cute', 'Cute is the default look');
      assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
      const before = await page.evaluate(() => JSON.stringify(lookProbe.read()));
      const cuteFrame = await page.evaluate(() => document.getElementById('voyage-canvas').toDataURL());
      await toggle.click();
      assert.equal(await page.locator('#voyage-stage').getAttribute('data-look'), 'real');
      assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
      assert.ok((await toggle.innerText()).includes('사실적'));
      assert.equal(await page.evaluate(() => JSON.stringify(lookProbe.read())), before, 'Changing the look never changes the voyage');
      assert.notEqual(await page.evaluate(() => document.getElementById('voyage-canvas').toDataURL()), cuteFrame, 'The realistic look draws a different scene');
      assert.equal(await page.evaluate(() => localStorage.getItem('windward-look')), 'real');
      await page.locator('#voyage-canvas').focus(); await page.keyboard.press('ArrowUp');
      await page.waitForFunction(() => lookProbe.read().motion.speed > .5);
      await page.waitForTimeout(800);
      await page.keyboard.press('Space');
      await page.reload(); await page.locator('#start-button').click();
      await page.locator('#voyage-screen').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#voyage-stage').getAttribute('data-look'), 'real', 'The chosen look is remembered');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const still = await page.evaluate(() => { const t = performance.now() + 10000; lookProbe.ui.render(t); const a = document.getElementById('voyage-canvas').toDataURL(); lookProbe.ui.render(t + 1000); return a === document.getElementById('voyage-canvas').toDataURL(); });
      assert.ok(still, 'Reduced motion freezes the realistic water too');
      await toggle.click();
      assert.equal(await page.locator('#voyage-stage').getAttribute('data-look'), 'cute');
      assert.equal(await page.evaluate(() => localStorage.getItem('windward-look')), 'cute');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'No horizontal overflow');
      const stage = await page.locator('#voyage-stage').boundingBox(), button = await toggle.boundingBox();
      assert.ok(button.y >= stage.y + stage.height - 1, 'The look toggle sits below the sailing canvas so it never covers instruments');
      assert.ok(button.height >= 44 - 1, 'Touch target is at least 44px');
      await page.goto((process.env.BASE_URL || 'http://127.0.0.1:4173/?v=look').split('?')[0] + '?look=real');
      await page.locator('#start-button').click(); await page.locator('#voyage-screen').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#voyage-stage').getAttribute('data-look'), 'real', '?look=real selects the realistic look');
      assert.deepEqual(errors, []); await context.close();
      console.log('PASS look ' + width + ': default, toggle, memory, read-only, reduced motion, layout, ?look=real');
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
