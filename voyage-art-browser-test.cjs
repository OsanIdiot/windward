const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const E = require('./engine.js');
const url = process.env.BASE_URL || 'http://127.0.0.1:4178/?v=0.1.10';
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const [width, height, tier, fallback] of [[320, 568, 0, false], [390, 844, 6, false], [844, 390, 6, false], [1280, 900, 0, false], [390, 844, 0, true]]) {
      const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 900, hasTouch: width < 900, reducedMotion: 'reduce' });
      const state = E.act(E.initial(), { type: 'show-chart' });
      state.port = null; state.position = E.N.project(-12, 40); state.ship = tier; state.motion.heading = 0;
      await context.addInitScript(state => {
        localStorage.setItem('windward-v1', JSON.stringify(state)); localStorage.setItem('windward-audio-enabled', 'off');
        Object.defineProperty(window, 'createVoyageUI', { configurable: true, set(factory) {
          this.artFactory = options => { const ui = factory(options); window.artProbe = { ui, read: options.read }; return ui; };
        }, get() { return this.artFactory; } });
        window.shipDraws = 0; window.shipClipped = false;
        const drawImage = CanvasRenderingContext2D.prototype.drawImage;
        CanvasRenderingContext2D.prototype.drawImage = function (source, ...args) {
          if (this.canvas.id === 'voyage-canvas' && source.src?.includes('merchant-caravel.webp')) {
            window.shipDraws++;
            const [x, y, w, h] = args.length === 4 ? args : args.slice(4), m = this.getTransform();
            for (const [px, py] of [[x, y], [x+w, y], [x, y+h], [x+w, y+h]]) {
              const p = new DOMPoint(px, py).matrixTransform(m);
              if (p.x < 0 || p.y < 0 || p.x > this.canvas.width || p.y > this.canvas.height) window.shipClipped = true;
            }
          }
          return drawImage.call(this, source, ...args);
        };
      }, state);
      if (fallback) await context.route('**/assets/merchant-caravel.webp*', route => route.abort());
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('favicon.ico')) errors.push(`${r.status()} ${r.url()}`); });
      await page.goto(url); await page.locator('#start-button').click();
      await page.locator('#voyage-screen').waitFor({ state: 'visible' });
      if (!fallback) await page.waitForFunction(() => shipDraws > 0);
      assert.equal(await page.evaluate(() => shipClipped), false, 'The entire ship fits even on short landscape screens');
      const result = await page.evaluate(() => {
        const state = JSON.stringify(artProbe.read()), c = document.getElementById('voyage-canvas');
        const stamp = performance.now() + 10000;
        artProbe.ui.render(stamp); const first = c.toDataURL();
        artProbe.ui.render(stamp + 1000);
        return { unchanged: state === JSON.stringify(artProbe.read()), still: first === c.toDataURL(), overflow: document.documentElement.scrollWidth > innerWidth, imageDraws: shipDraws };
      });
      assert.ok(result.unchanged); assert.ok(result.still); assert.equal(result.overflow, false);
      assert.equal(result.imageDraws > 0, !fallback);
      await page.screenshot({ path: `voyage-art-${width}-${height}${fallback ? '-fallback' : ''}.png`, fullPage: true });
      await page.locator('#voyage-canvas').focus(); await page.keyboard.press('ArrowUp');
      await page.waitForFunction(() => artProbe.read().motion.speed > .5);
      assert.ok(E.N.distance(state.position, await page.evaluate(() => artProbe.read().position)) > 1);
      await page.locator('#voyage-pause').click(); await page.waitForFunction(() => !artProbe.read().navigation?.running);
      await page.locator('#open-chart-button').click(); assert.equal(await page.locator('#chart-screen').isVisible(), true);
      assert.deepEqual(errors, []); await context.close();
      console.log(`PASS art ${width}x${height}, tier ${tier + 1}, fallback ${fallback}: loaded art, still motion, read-only rendering, steering, stop and chart`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
