const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const E = require('./engine.js');
const url = process.env.BASE_URL || 'http://127.0.0.1:4176/?v=0.1.9';
function fixture(port, day) {
  const s = E.initial(), p = E.portOf(port);
  s.port = s.lastPort = port; s.position = { x: p.x, y: p.y }; s.day = day;
  s.visited = [...new Set([...s.visited, port])]; return s;
}
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    async function setup(width, state) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 740, hasTouch: width < 740, reducedMotion: 'reduce' });
      await context.addInitScript(state => {
        if (!sessionStorage.getItem('market-fixture')) {
          localStorage.setItem('windward-v1', JSON.stringify(state));
          localStorage.setItem('windward-audio-enabled', 'off'); sessionStorage.setItem('market-fixture', '1');
        }
      }, state);
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(url); await page.locator('#start-button').click();
      return { context, page, errors };
    }
    for (const width of [320, 390, 1280]) {
      const { context, page, errors } = await setup(width, E.initial());
      await page.locator('[data-service="market"]').click();
      await page.locator('#dock-content [data-market-news]').click();
      const body = await page.locator('#market-news-content').innerText();
      assert.match(body, /밀 공급 부족/); assert.match(body, /35 G/); assert.match(body, /39 G/);
      assert.match(body, /오늘 포함 20일/); assert.ok(!body.includes('카디스'));
      assert.ok(await page.locator('#market-news-dialog').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
      const box = await page.locator('#market-news-dialog').boundingBox(); assert.ok(box.y >= 0 && box.y + box.height <= 845);
      await page.screenshot({ path: `market-news-${width}.png`, fullPage: true });
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#service-dialog').evaluate(el => el.open), true);
      assert.equal(await page.locator('#dock-content [data-market-news]').evaluate(el => el === document.activeElement), true);
      await page.locator('#qty-grain').fill('10'); await page.locator('#qty-grain').dispatchEvent('change');
      assert.match(await page.locator('[data-trade="grain"]').innerText(), /160 G/);
      await page.locator('[data-trade="grain"]').click();
      await page.reload(); await page.locator('#start-button').click();
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem(Windward.KEY)));
      assert.equal(saved.gold, 540); assert.equal(saved.cargo.grain, 10); assert.deepEqual(saved.visited, ['lume']);
      await page.locator('[data-service="market"]').click(); await page.locator('#dock-content [data-market-news]').click();
      assert.match(await page.locator('.market-deadline').innerText(), /20일/);
      await page.keyboard.press('Escape'); await page.locator('#close-service').click();
      await page.locator('#harbor-button').click(); await page.locator('#open-chart-button').click();
      await page.locator('#goals-button').click(); await page.locator('#goals-dialog [data-market-news]').click();
      assert.match(await page.locator('#market-news-content').innerText(), /밀 공급 부족/);
      await page.keyboard.press('Escape'); assert.equal(await page.locator('#goals-dialog').evaluate(el => el.open), true);
      assert.deepEqual(errors, []); await context.close();
      console.log(`PASS market ${width}: unknown port privacy, current quotes, dates, buy/reload, nested dialogs, sea access and mobile layout`);
    }
    for (const [day, good, buy, sell, event] of [[1, 'grain', 39, 35, true], [21, 'grain', 30, 27, false], [25, 'timber', 53, 47, true], [49, 'cloth', 85, 76, true]]) {
      const port = day === 25 ? 'lume' : day === 49 ? 'marseille' : 'cedar';
      const { context, page, errors } = await setup(390, fixture(port, day));
      await page.locator('[data-service="market"]').click();
      assert.match(await page.locator(`[data-trade="${good}"]`).innerText(), new RegExp(`${buy} G`));
      await page.locator(`[data-trade="${good}"]`).click();
      await page.locator('[data-side="sell"]').click();
      assert.match(await page.locator(`[data-trade="${good}"]`).innerText(), new RegExp(`${sell} G`));
      await page.locator(`[data-trade="${good}"]`).click();
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem(Windward.KEY)).gold), 700 - buy + sell);
      assert.equal(await page.locator('.market-price-note').count(), event ? 1 : 0);
      await page.locator('#dock-content [data-market-news]').click();
      assert.match(await page.locator('#market-news-content').innerText(), event ? /현재 항구에 적용/ : /평온한 시장/);
      assert.deepEqual(errors, []); await context.close();
    }
    // Move across the deadline with the news window open, without mutating production state via test hooks.
    let state = fixture('lume', 20); state = E.act(state, { type: 'show-chart' });
    state.port = null; state.position = E.N.project(-12, 40); state.motion.heading = 180; state.seaProgress = .5;
    state.visited.push('cedar');
    const { context, page, errors } = await setup(390, state);
    await page.locator('#voyage-screen').waitFor({ state: 'visible' });
    await page.locator('#voyage-canvas').focus(); await page.keyboard.press('ArrowUp');
    await page.locator('#open-chart-button').click(); await page.locator('#goals-button').click();
    await page.locator('#goals-dialog [data-market-news]').click();
    assert.match(await page.locator('#market-news-content').innerText(), /곧 종료됩니다/);
    assert.match(await page.locator('.market-passage').innerText(), /종료 후 도착/);
    try {
      await page.waitForFunction(() => document.getElementById('market-news-content').textContent.includes('평온한 시장'));
    } catch (error) {
      console.error(await page.evaluate(() => ({ saved: JSON.parse(localStorage.getItem(Windward.KEY)), news: document.getElementById('market-news-content').textContent, toast: document.getElementById('toast').textContent })));
      throw error;
    }
    await page.waitForFunction(() => JSON.parse(localStorage.getItem(Windward.KEY)).day >= 21);
    assert.equal(await page.locator('#chart-screen').isVisible(), true, 'Open news prevents the automatic chart return');
    assert.deepEqual(errors, []); await context.close();
    console.log('PASS event prices, quiet interval, real trading and live expiry during sailing');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
