const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const E = require('./engine.js');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const url = process.env.BASE_URL || 'http://127.0.0.1:4173/?v=22', errors = [];
    for (const mobile of [false, true]) {
      const state = E.act(E.initial(), { type: 'show-chart' }), port = E.portOf('cedar');
      const route = E.N.route(state.position, port), previous = route.at(-2) || state.position;
      const distance = E.N.distance(previous, port);
      state.position = { x: port.x + (previous.x - port.x) * 24 / distance, y: port.y + (previous.y - port.y) * 24 / distance };
      state.port = null; state.visited.push(port.id);
      assert.ok(E.valid(state));
      const context = await browser.newContext({ viewport: { width: mobile ? 390 : 1280, height: 900 }, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
      await context.addInitScript(state => {
        if (sessionStorage.getItem('departure-fixture')) return;
        localStorage.setItem('windward-v1', JSON.stringify(state));
        localStorage.setItem('windward-audio-enabled', 'off');
        sessionStorage.setItem('departure-fixture', '1');
      }, state);
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      const click = selector => mobile ? page.locator(selector).tap() : page.locator(selector).click();
      await page.goto(url); await click('#start-button'); await click('#open-chart-button');
      await click('[data-chart-port="cedar"]');
      await page.waitForFunction(() => {
        const s = JSON.parse(localStorage.getItem(Windward.KEY));
        return !s.navigation && Windward.nearbyPort(s)?.id === 'cedar';
      });
      await page.locator('#voyage-enter-port').waitFor({ state: 'visible' });
      const arrival = await page.evaluate(() => JSON.parse(localStorage.getItem(Windward.KEY)));
      const heading = await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem(Windward.KEY)), p = Windward.nearbyPort(s);
        for (let heading = 0; heading < 360; heading += 15) {
          const point = Windward.N.headingTarget(s.position, heading, 40);
          if (Windward.N.distance(s.position, point) > 30 && Windward.N.distance(point, p) > 30) return (heading - s.motion.heading + 360) % 360;
        }
        throw Error('No test departure heading');
      });
      const box = await page.locator('#voyage-canvas').boundingBox(), r = Math.min(box.width, box.height) * .28;
      const x = box.x + box.width * .5 + Math.sin(heading * Math.PI / 180) * r;
      const y = box.y + box.height * .58 - Math.cos(heading * Math.PI / 180) * r;
      if (mobile) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
      await page.waitForFunction(() => {
        const s = JSON.parse(localStorage.getItem(Windward.KEY));
        return s.navigation?.running && Windward.N.distance(s.position, Windward.portOf('cedar')) > 12;
      });
      await click('#voyage-pause');
      const departed = await page.evaluate(() => JSON.parse(localStorage.getItem(Windward.KEY)));
      assert.equal(departed.port, null); assert.equal(departed.lastPort, arrival.lastPort);
      assert.equal(departed.voyages, arrival.voyages); assert.deepEqual(departed.visited, arrival.visited);
      await page.reload(); await click('#start-button'); await click('#voyage-pause');
      await page.waitForFunction(p => {
        const s = JSON.parse(localStorage.getItem(Windward.KEY));
        return s.navigation?.running && Windward.N.distance(s.position, p) > 4;
      }, departed.position).catch(async error => {
        console.error('Resume diagnostics', { mobile, departed, current: await page.evaluate(() => JSON.parse(localStorage.getItem(Windward.KEY))) });
        throw error;
      });
      await click('#voyage-pause');
      await click('#open-chart-button'); await click('[data-chart-port="cedar"]');
      await page.waitForFunction(() => {
        const s = JSON.parse(localStorage.getItem(Windward.KEY));
        return !s.navigation && Windward.nearbyPort(s)?.id === 'cedar';
      });
      await click('#voyage-enter-port');
      await page.locator('#dock').waitFor({ state: 'visible' });
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem(Windward.KEY)).port), 'cedar');
      await context.close();
    }
    assert.deepEqual(errors, []);
    console.log('PASS: desktop click and mobile tap depart after auto arrival without docking, preserve port history, pause/reload/resume and re-arrive/dock normally.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
