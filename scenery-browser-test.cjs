const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 740, hasTouch: width < 740, reducedMotion: 'no-preference' });
      await context.addInitScript(() => {
        localStorage.setItem('windward-audio-enabled', 'off');
        Object.defineProperty(window, 'createVoyageUI', { configurable: true, set(factory) {
          this.sceneryFactory = options => { const ui = factory(options); window.sceneryProbe = { ui, read: options.read }; return ui; };
        }, get() { return this.sceneryFactory; } });
      });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(process.env.BASE_URL || 'http://127.0.0.1:4176/?v=0.1.6');
      await page.locator('#start-button').click(); await page.locator('#harbor-button').click();
      await page.locator('#voyage-screen').waitFor({ state: 'visible' });
      await page.screenshot({ path: path.join(__dirname, `scenery-${width}-harbor.png`), fullPage: true });
      const snapshot = await page.evaluate(() => {
        const before = JSON.stringify(sceneryProbe.read()), start = performance.now();
        for (let i = 0; i < 90; i++) sceneryProbe.ui.render(start + i * 16.67);
        return { unchanged: before === JSON.stringify(sceneryProbe.read()), average: (performance.now() - start) / 90 };
      });
      assert.ok(snapshot.unchanged, 'Drawing never changes navigation, money or save state');
      console.log(width + ' mean render ms: ' + snapshot.average.toFixed(2));
      await page.locator('#voyage-canvas').focus(); await page.keyboard.press('ArrowUp');
      await page.waitForFunction(() => sceneryProbe.read().motion.speed > .7);
      await page.waitForTimeout(2500);
      await page.screenshot({ path: path.join(__dirname, `scenery-${width}-sailing.png`), fullPage: true });
      const initialHeading = await page.evaluate(() => sceneryProbe.read().motion.heading);
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(heading => Math.abs((sceneryProbe.read().motion.heading - heading + 540) % 360 - 180) > 25, initialHeading);
      await page.screenshot({ path: path.join(__dirname, `scenery-${width}-turn.png`), fullPage: true });
      await page.locator('#voyage-pause').click();
      await page.waitForFunction(() => !sceneryProbe.read().navigation?.running);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForFunction(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const reduced = await page.evaluate(() => {
        const t = performance.now() + 10000;
        sceneryProbe.ui.render(t); const before = document.getElementById('voyage-canvas').toDataURL();
        sceneryProbe.ui.render(t + 1000); return before === document.getElementById('voyage-canvas').toDataURL();
      });
      assert.ok(reduced, 'Reduced motion stops idle water, rocking and cloth animation');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.deepEqual(errors, []); await context.close();
      console.log('PASS scenery ' + width + ': harbor, cruise, turn, stop, reduced motion, read-only render');
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
