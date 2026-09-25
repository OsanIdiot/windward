const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [320, 390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 740, hasTouch: width < 740, reducedMotion: 'reduce' });
      const page = await context.newPage(), errors = [];
      await page.addInitScript(() => {
        window.discoveryFonts = {};
        const fillText = CanvasRenderingContext2D.prototype.fillText;
        CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
          if (this.canvas.id === 'voyage-canvas' && ['수평선의 흔적', '해상 단서', '물새들의 쉼터'].includes(text)) discoveryFonts[text] = parseFloat(this.font);
          return fillText.call(this, text, ...args);
        };
      });
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => { if (response.status() >= 400) errors.push(response.url()); });
      await page.goto(process.env.BASE_URL || 'http://127.0.0.1:4176/?v=0.1.2');
      // Existing players must keep their currency and receive empty discovery fields.
      await page.evaluate(() => {
        const old = Windward.initial(); delete old.seaClues; delete old.seaDiscoveries;
        old.gold = 1234; localStorage.setItem(Windward.KEY, JSON.stringify(old));
      });
      await page.reload(); await page.locator('#start-button').click();
      await page.locator('#harbor-button').click();
      await page.waitForFunction(() => Object.keys(discoveryFonts).length > 0);
      const labelSizes = await page.evaluate(() => ({ names: Object.values(discoveryFonts), port: parseFloat(getComputedStyle(document.querySelector('.voyage-port')).fontSize) }));
      assert.ok(labelSizes.names.every(size => size <= labelSizes.port), 'Discovery labels never exceed port names');
      await page.locator('#lookout-button').click();
      await page.locator('#sea-atlas-dialog').waitFor({ state: 'visible' });
      assert.equal(await page.locator('[data-sea-approach]').count(), 1);
      assert.equal(await page.locator('[data-sea-survey="seabirds"]').isDisabled(), true);
      assert.equal(await page.locator('#sea-atlas-list').innerText().then(t => t.includes('부서진 배의 항해 일지')), false);
      await page.screenshot({ path: path.join(__dirname, `discovery-${width}-scope.png`), fullPage: true });
      await page.locator('[data-sea-approach="seabirds"]').click();
      await page.locator('#sea-atlas-dialog').waitFor({ state: 'hidden' });
      await page.waitForFunction(() => {
        const s = JSON.parse(localStorage.getItem(Windward.KEY));
        return s.port === null && !s.navigation?.running && Windward.N.distance(s.position, Windward.SEA_SITES[0]) <= Windward.SURVEY_RANGE;
      });
      await page.screenshot({ path: path.join(__dirname, `discovery-${width}-sea.png`), fullPage: true });
      await page.locator('#lookout-button').click();
      await page.locator('[data-sea-survey="seabirds"]').click();
      assert.match(await page.locator('#sea-atlas-count').innerText(), /1 \/ 5/);
      assert.equal(await page.locator('[data-sea-survey="seabirds"]').count(), 0);
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem(Windward.KEY)));
      assert.equal(saved.gold, 1314); assert.deepEqual(saved.seaDiscoveries, ['seabirds']);
      assert.deepEqual(saved.visited, ['lume']); assert.deepEqual(saved.discoveries, []);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.equal(await page.locator('#sea-atlas-dialog').evaluate(d => d.scrollWidth <= d.clientWidth + 1), true);
      await page.keyboard.press('Escape');
      await page.locator('#open-chart-button').click();
      assert.equal(await page.locator('#sea-clue-markers>g').count(), 1);
      assert.equal(await page.locator('#sea-clue-markers .port-caption').count(), 0);
      assert.equal((await page.locator('#sea-clue-markers').textContent()).trim(), '+', 'Chart shows a symbol without the discovery name');
      await page.reload(); await page.locator('#start-button').click();
      await page.locator('#lookout-button').click();
      assert.match(await page.locator('#sea-atlas-count').innerText(), /1 \/ 5/);
      const reloaded = await page.evaluate(() => JSON.parse(localStorage.getItem(Windward.KEY)));
      assert.equal(reloaded.gold, saved.gold); assert.deepEqual(reloaded.seaDiscoveries, saved.seaDiscoveries);
      await page.keyboard.press('Escape');
      await page.locator('[data-voyage-port="lume"]').click();
      await page.locator('#voyage-enter-port').waitFor({ state: 'visible' });
      await page.locator('#voyage-enter-port').click();
      await page.locator('[data-service="adventure"]').click();
      await page.locator('#dock-content [data-sea-atlas]').click();
      assert.match(await page.locator('#sea-atlas-count').innerText(), /1 \/ 5/);
      assert.equal(await page.locator('#sea-atlas-scan').isVisible(), false);
      assert.deepEqual(errors, []);
      await context.close(); console.log(`PASS ${width}: migrate, scan, approach, stop, survey, save/reload, chart and port atlas, no overflow/errors`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
