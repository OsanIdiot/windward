const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const E = require('./engine.js');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const [width, height] of [[320, 568], [390, 844], [844, 390], [1280, 900]]) {
      const state = E.act(E.initial(), { type: 'show-chart' });
      state.port = null; state.position = E.N.project(-12, 40);
      state.motion.heading = E.windAt(state).from;
      const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 740, hasTouch: width < 740 });
      await context.addInitScript(state => {
        if (!sessionStorage.getItem('wind-fixture')) {
          localStorage.setItem('windward-v1', JSON.stringify(state));
          localStorage.setItem('windward-audio-enabled', 'off');
          sessionStorage.setItem('wind-fixture', '1');
        }
        Object.defineProperty(window, 'createVoyageUI', { configurable: true, set(factory) {
          this.windFactory = options => { const ui = factory(options); window.windProbe = { ui, read: options.read }; return ui; };
        }, get() { return this.windFactory; } });
      }, state);
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(process.env.BASE_URL || 'http://127.0.0.1:4176/?v=0.1.7');
      await page.locator('#start-button').click();
      await page.locator('#voyage-screen').waitFor({ state: 'visible' });
      assert.match(await page.locator('#voyage-wind-label').innerText(), /풍 · \d+ kn/);
      assert.match(await page.locator('#voyage-wind-effect').innerText(), /맞바람/);
      const checkArrow = () => page.evaluate(() => {
        const s = windProbe.read(), w = Windward.windAt(s);
        const bearing = document.getElementById('voyage-stage').dataset.camera === 'heading' ? s.motion.heading : 0;
        const degrees = Number(document.getElementById('voyage-wind-arrow').style.transform.match(/rotate\(([-\d.]+)deg\)/)[1]);
        return Math.abs((degrees - (w.from + 180 - bearing) + 540) % 360 - 180) < .1;
      });
      assert.ok(await checkArrow());
      const windBefore = await page.evaluate(() => Windward.windAt(windProbe.read()));
      await page.locator('#voyage-camera-toggle').click(); assert.ok(await checkArrow());
      assert.deepEqual(await page.evaluate(() => Windward.windAt(windProbe.read())), windBefore);
      await page.locator('#voyage-camera-toggle').click();
      await page.locator('#voyage-canvas').focus(); await page.keyboard.press('ArrowUp');
      await page.waitForFunction(() => document.getElementById('voyage-speed').textContent.includes('순항'));
      await page.waitForFunction(() => { const s = windProbe.read(); return Math.abs(s.motion.speed - Windward.windAt(s).factor) < .01; });
      const moving = await page.evaluate(() => windProbe.read());
      assert.ok(moving.motion.speed >= .79 && moving.motion.speed < .9);
      assert.ok(E.N.distance(state.position, moving.position) > 10, 'Headwind never stalls sailing');
      await page.screenshot({ path: `wind-${width}.png`, fullPage: true });
      await page.locator('#voyage-pause').click();
      await page.waitForFunction(() => !windProbe.read().navigation?.running);
      const paused = await page.evaluate(() => ({ state: windProbe.read(), wind: Windward.windAt(windProbe.read()) }));
      await page.reload(); await page.locator('#start-button').click();
      await page.locator('#voyage-screen').waitFor({ state: 'visible' });
      const loaded = await page.evaluate(() => ({ state: windProbe.read(), wind: Windward.windAt(windProbe.read()) }));
      assert.deepEqual(loaded.wind, paused.wind); assert.deepEqual(loaded.state.position, paused.state.position);
      assert.equal(loaded.state.gold, paused.state.gold); assert.equal(loaded.state.motion.speed, 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      const caption = await page.locator('.voyage-caption').boundingBox(), instruments = await page.locator('.voyage-instruments').boundingBox();
      assert.ok(caption.x + caption.width < instruments.x);
      const mini = await page.locator('#mini-chart-button').boundingBox();
      assert.ok(instruments.y + instruments.height <= mini.y, 'Minimap cannot cover camera controls');
      const banner = await page.locator('#voyage-wind').boundingBox(), stage = await page.locator('#voyage-stage').boundingBox();
      assert.ok(banner.y + banner.height <= stage.y, 'Wind information stays outside the sailing canvas');
      if (height < 500) {
        const title = await page.locator('#voyage-screen .section-heading h2').boundingBox(), chart = await page.locator('#open-chart-button').boundingBox();
        assert.ok(title.x + title.width < banner.x && banner.x + banner.width < chart.x, 'Landscape header controls remain separate');
      }
      assert.deepEqual(errors, []); await context.close();
      console.log(`PASS wind ${width}: headwind cruise, true wind arrow in both camera modes, stop, save/reload and layout`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
