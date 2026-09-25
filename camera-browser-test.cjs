const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const E = require('./engine.js');
const delta = (a, b) => (a - b + 540) % 360 - 180;

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const url = process.env.BASE_URL || 'http://127.0.0.1:4173/?v=32', errors = [];
  try {
    for (const width of [1280, 390, 320]) {
      const mobile = width < 500;
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
      const fixture = E.act(E.initial(), { type: 'show-chart' });
      fixture.port = null; fixture.position.x -= 30; fixture.motion.heading = 90;
      await context.addInitScript(s => {
        if (!sessionStorage.getItem('camera-fixture')) {
          localStorage.setItem('windward-v1', JSON.stringify(s)); localStorage.setItem('windward-audio-enabled', 'off');
          sessionStorage.setItem('camera-fixture', '1');
        }
        window.cameraProbe = {};
        Object.defineProperty(window, 'createVoyageUI', { configurable: true, set(factory) {
          this.cameraFactory = options => { cameraProbe.read = options.read;
            const steer = options.steer; options.steer = heading => { cameraProbe.steer = heading; return steer(heading); };
            return factory(options);
          };
        }, get() { return this.cameraFactory; } });
        const fill = CanvasRenderingContext2D.prototype.fill;
        CanvasRenderingContext2D.prototype.fill = function (...args) {
          const color = this.fillStyle;
          if (this.canvas.id === 'voyage-canvas' && (color === '#81583c' || color === '#dcd8b8')) {
            const m = this.getTransform(); cameraProbe[color === '#81583c' ? 'ship' : 'land'] = { angle: Math.atan2(m.b, m.a) * 180 / Math.PI, x: m.e, y: m.f };
          }
          if (this.canvas.id === 'voyage-minimap' && color === '#e2dcc0') {
            const m = this.getTransform(); cameraProbe.mini = Math.atan2(m.b, m.a) * 180 / Math.PI;
          }
          return fill.apply(this, args);
        };
        const drawImage = CanvasRenderingContext2D.prototype.drawImage;
        CanvasRenderingContext2D.prototype.drawImage = function (source, ...args) {
          if (this.canvas.id === 'voyage-canvas' && source.src?.includes('merchant-caravel.webp')) {
            const m = this.getTransform(); cameraProbe.ship = { angle: Math.atan2(m.b, m.a) * 180 / Math.PI, x: m.e, y: m.f };
          }
          return drawImage.call(this, source, ...args);
        };
      }, fixture);
      const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
      page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('favicon.ico')) errors.push(`${r.status()} ${r.url()}`); });
      const click = id => mobile ? page.locator(id).tap() : page.locator(id).click();
      const read = () => page.evaluate(() => {
        const n = document.getElementById('voyage-needle'), nr = n.getBoundingClientRect(), dr = n.parentElement.getBoundingClientRect();
        return { ship: cameraProbe.ship, land: cameraProbe.land, mini: cameraProbe.mini, state: cameraProbe.read(),
          needle: parseFloat(n.style.transform.match(/-?[\d.]+/)[0]), offset: Math.hypot((nr.left + nr.right - dr.left - dr.right) / 2, (nr.top + nr.bottom - dr.top - dr.bottom) / 2) };
      });
      await page.goto(url); await click('#start-button'); await page.locator('#voyage-screen').waitFor({ state: 'visible' });
      await page.waitForFunction(() => cameraProbe.ship && cameraProbe.land);
      let snap = await read();
      assert.ok(Math.abs(snap.ship.angle) < .001); assert.ok(Math.abs(snap.land.angle + 90) < .001);
      assert.equal(snap.needle, -90); assert.equal(snap.mini, 0); assert.ok(snap.offset < .1);
      const port = page.locator('[data-voyage-port="lume"]'); await port.waitFor({ state: 'visible' });
      const matches = await port.evaluate(el => {
        const s = cameraProbe.read(), canvas = document.getElementById('voyage-canvas').getBoundingClientRect();
        const p = VoyageCamera.project(Windward.portOf('lume'), s.position, { x: canvas.width / 2, y: canvas.height * .58, zoom: Math.min(canvas.width, canvas.height) / 145, bearing: s.motion.heading });
        return Math.abs(parseFloat(el.style.left) - p.x) < .1 && Math.abs(parseFloat(el.style.top) - (p.y - 38)) < .1;
      });
      assert.ok(matches, 'Port labels follow the rotated coastline');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: path.join(__dirname, `camera-${width}.png`), fullPage: true });
      const original = snap.state;
      await click('#voyage-camera-toggle'); snap = await read();
      assert.ok(Math.abs(snap.ship.angle - 90) < .001); assert.equal(snap.needle, 0); assert.equal(snap.land.angle, 0);
      assert.deepEqual(snap.state, original, 'Camera switch does not change the voyage');
      await page.reload(); await click('#start-button'); await page.locator('#voyage-screen').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#voyage-camera-toggle').getAttribute('aria-pressed'), 'false');
      await click('#voyage-camera-toggle');
      await click('#open-chart-button');
      assert.equal(await page.locator('#chart-screen').isVisible(), true);
      await click('#return-sea-button'); assert.equal(await page.locator('#voyage-camera-toggle').getAttribute('aria-pressed'), 'true');
      await click('[data-voyage-port="lume"]');
      assert.equal((await read()).state.navigation.targetPort, 'lume', 'Rotated port button keeps its actual destination');
      await click('#voyage-pause');
      await page.waitForFunction(() => !cameraProbe.read().navigation?.running);
      await page.locator('#voyage-canvas').focus(); await page.keyboard.press('ArrowDown');
      const steering = await page.evaluate(() => cameraProbe.steer); assert.ok(Math.abs(delta(steering, 270)) < .1);
      await page.waitForTimeout(180);
      snap = await read(); assert.ok(Math.abs(snap.ship.angle) < .001); assert.ok(Math.abs(delta(snap.land.angle, -snap.state.motion.heading)) < .001);
      const box = await page.locator('#voyage-canvas').boundingBox();
      const before = snap.state.motion.heading;
      if (mobile) await page.touchscreen.tap(box.x + box.width * .78, box.y + box.height * .58);
      else await page.mouse.click(box.x + box.width * .78, box.y + box.height * .58);
      const after = await page.evaluate(() => cameraProbe.steer);
      assert.ok(Math.abs(delta(after, before + 90)) < 20, 'Pointer steering uses the currently rotated view');
      await click('#return-menu-button'); await click('#start-button'); await page.locator('#voyage-screen').waitFor({ state: 'visible' });
      for (const h of [359, 0, 1]) {
        await page.evaluate(h => { cameraProbe.read().motion.heading = h; }, h);
        await page.waitForFunction(h => document.getElementById('voyage-needle').style.transform === `rotate(${-h}deg)`, h);
        snap = await read(); assert.ok(Math.abs(snap.ship.angle) < .001); assert.ok(Math.abs(delta(snap.land.angle, -h)) < .001);
      }
      assert.equal(await page.locator('#voyage-needle').evaluate(el => getComputedStyle(el).transitionDuration), '0s');
      await context.close();
    }
    assert.deepEqual(errors, []);
    console.log('PASS: fixed bow, rotated coast/ports, north compass, north-up minimap, mode persistence, chart round-trip, keyboard/pointer/touch controls and 0/360 crossing on desktop/mobile.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
