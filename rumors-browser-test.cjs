const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const E = require('./engine.js');
const url = process.env.BASE_URL || 'http://127.0.0.1:4176/?v=0.1.8';
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [320, 390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 740, hasTouch: width < 740, reducedMotion: 'reduce' });
      await context.addInitScript(() => localStorage.setItem('windward-audio-enabled', 'off'));
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem(Windward.KEY)));
      await page.goto(url); await page.locator('#start-button').click();
      await page.locator('[data-service="adventure"]').click();
      await page.locator('#dock-content [data-rumor-hear="seabirds"]').click();
      const heard = await saved();
      assert.deepEqual(heard.seaRumors, ['seabirds']); assert.deepEqual(heard.seaClues, []);
      assert.equal(heard.gold, 700); assert.equal(heard.day, 1); assert.deepEqual(heard.visited, ['lume']);
      assert.match(await page.locator('#dock-content [data-rumor-card]').innerText(), /남서쪽/);
      await page.screenshot({ path: `rumor-${width}-heard.png`, fullPage: true });
      await page.locator('#dock-content [data-sea-atlas]').first().click();
      assert.equal(await page.locator('#sea-atlas-list [data-sea-approach]').count(), 0);
      assert.equal(await page.locator('.rumor-journal').evaluate(el => el.open), true);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#service-dialog').evaluate(el => el.open), true);
      await page.reload(); await page.locator('#start-button').click();
      assert.deepEqual((await saved()).seaRumors, heard.seaRumors);
      await page.locator('#harbor-button').click(); await page.locator('#open-chart-button').click();
      assert.equal(await page.locator('#sea-clue-markers>g').count(), 0, 'A heard rumor never adds a precise chart marker');
      await page.locator('#return-sea-button').click();
      await page.locator('#voyage-canvas').focus(); await page.keyboard.press('ArrowUp');
      await page.waitForFunction(() => JSON.parse(localStorage.getItem(Windward.KEY)).motion.speed > .12);
      await page.locator('#lookout-button').click();
      await page.locator('[data-sea-approach="seabirds"]').click();
      await page.waitForFunction(() => {
        const s = JSON.parse(localStorage.getItem(Windward.KEY));
        return !s.navigation?.running && Windward.N.distance(s.position, Windward.SEA_SITES[0]) <= Windward.SURVEY_RANGE;
      });
      await page.locator('#lookout-button').click(); await page.locator('[data-sea-survey="seabirds"]').click();
      assert.match(await page.locator('#sea-rumor-notice').innerText(), /리스본.*전달/);
      const found = await saved(); assert.equal(found.reputation, 5); assert.deepEqual(found.seaStories, []);
      await page.keyboard.press('Escape');
      await page.locator('[data-voyage-port="lume"]').click();
      await page.locator('#voyage-enter-port').waitFor({ state: 'visible' }); await page.locator('#voyage-enter-port').click();
      await page.locator('[data-service="adventure"]').click();
      const before = await saved();
      await page.locator('#dock-content [data-rumor-report="seabirds"]').click();
      const done = await saved(); assert.equal(done.gold, before.gold); assert.equal(done.reputation, 8);
      assert.deepEqual(done.seaStories, ['seabirds']); assert.deepEqual(done.visited, ['lume']);
      assert.equal(await page.locator('#dock-content [data-rumor-report]').count(), 0);
      const card = await page.locator('#dock-content [data-rumor-card]').innerText();
      assert.match(card, /이야기 완결/); assert.match(card, /이어지는 소문/); assert.ok(!card.includes('카디스'));
      await page.locator('#tab-log').click();
      assert.match(await page.locator('#dock-content .rumor-ending').innerText(), /함께 읽는 기록/);
      await page.screenshot({ path: `rumor-${width}-complete.png`, fullPage: true });
      assert.ok(await page.locator('#service-dialog').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.reload(); await page.locator('#start-button').click(); await page.locator('[data-service="log"]').click();
      assert.deepEqual((await saved()).seaStories, ['seabirds']);
      assert.equal(await page.locator('#dock-content [data-rumor-hear], #dock-content [data-rumor-report]').count(), 0);
      assert.deepEqual(errors, []); await context.close();
      console.log(`PASS rumor ${width}: listen, no marker, reload, sail, scan, survey, return, report, permanent journal, hidden port name`);
    }
    for (const followup of [false, true]) {
      const state = E.initial(); state.gold = 1234; state.reputation = followup ? 8 : 5;
      state.seaClues = ['seabirds']; state.seaDiscoveries = ['seabirds'];
      if (followup) {
        state.seaRumors = ['seabirds']; state.seaStories = ['seabirds'];
        state.port = state.lastPort = 'cedar'; state.visited.push('cedar');
        state.position = { x: E.portOf('cedar').x, y: E.portOf('cedar').y };
      } else { delete state.seaRumors; delete state.seaStories; }
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      await context.addInitScript(state => {
        localStorage.setItem('windward-v1', JSON.stringify(state)); localStorage.setItem('windward-audio-enabled', 'off');
      }, state);
      const page = await context.newPage(); await page.goto(url); await page.locator('#start-button').click();
      await page.locator('[data-service="adventure"]').click();
      const id = followup ? 'wreck' : 'seabirds';
      await page.locator(`#dock-content [data-rumor-hear="${id}"]`).click();
      if (followup) {
        assert.match(await page.locator('#dock-content [data-rumor-card="wreck"]').innerText(), /서쪽 바깥바다/);
        assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem(Windward.KEY)).seaClues), ['seabirds']);
      } else {
        await page.locator('#dock-content [data-sea-atlas]').click();
        await page.locator('#sea-rumor-list [data-rumor-report="seabirds"]').click();
        assert.equal(await page.locator('#sea-rumor-list [data-rumor-report]').count(), 0);
        assert.match(await page.locator('#sea-rumor-list').innerText(), /이야기 완결/);
        const saved = await page.evaluate(() => JSON.parse(localStorage.getItem(Windward.KEY)));
        assert.equal(saved.gold, 1234); assert.equal(saved.reputation, 8); assert.deepEqual(saved.seaStories, ['seabirds']);
      }
      await context.close();
      console.log('PASS ' + (followup ? 'follow-up rumor available at Cadiz without unlocking sea clue' : 'legacy discovery can be reported without sailing again'));
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
