const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [];
  try {
    for (const [width, height] of [[320,568], [390,844], [412,915], [512,640], [768,1024], [844,390]]) {
      const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(process.env.BASE_URL || 'http://127.0.0.1:4173/?v=28');
      if (width === 412) {
        await page.evaluate(() => {
          const state = Windward.initial();
          state.visited = Windward.PORTS.map(port => port.id);
          localStorage.setItem(Windward.KEY, JSON.stringify(state));
        });
        await page.reload();
      }
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
      assert.equal(await page.locator('#chart-details, #chart-screen .chart-instructions').count(), 0);
      assert.equal(await page.locator('#route-panel').isVisible(), true);
      assert.match(await page.locator('#route-panel').innerText(), /미확인 항구는 직접 접근해 입항하세요/);
      await checkHeight('chart', width > height ? 330 : height < 700 ? 160 : 0);
      const map = await page.locator('#sea-map').boundingBox();
      const tools = await page.locator('.chart-tools').boundingBox();
      const title = await page.locator('.chart-note').boundingBox();
      assert.ok(map.height >= 180, 'Original compact chart height is retained');
      assert.ok(tools.y >= map.y && tools.y-map.y <= 12, 'Controls are pinned to the map top');
      assert.ok(map.x+map.width-tools.x-tools.width >= 0 && map.x+map.width-tools.x-tools.width <= 12, 'Controls are pinned to the map right');
      assert.equal(await page.locator('.chart-topbar').count(),0,'No separate toolbar row');
      assert.ok(title.x+title.width<=tools.x || title.y+title.height<=tools.y, 'Map title and controls do not overlap');
      const ports = await page.locator('.port-selector').evaluate(el => {
        const outer = el.getBoundingClientRect();
        const chips = [...el.children].map(chip => {
          const r = chip.getBoundingClientRect();
          return { left:r.left, right:r.right, top:r.top, bottom:r.bottom, height:r.height, fits:chip.scrollWidth <= chip.clientWidth };
        });
        return { left:outer.left, right:outer.right, top:outer.top, bottom:outer.bottom, overflow:el.scrollWidth > el.clientWidth, chips };
      });
      assert.equal(ports.overflow, false, 'Port list needs no horizontal scrolling');
      assert.equal(ports.chips.length, 8, 'All eight ports are present');
      assert.equal(new Set(ports.chips.map(chip => chip.top)).size, 2, 'Ports form two rows');
      for (const chip of ports.chips) assert.ok(chip.left >= ports.left && chip.right <= ports.right + 1 && chip.top >= ports.top && chip.bottom <= ports.bottom && chip.height >= 44 && chip.fits, 'Port buttons and labels fit inside the list');
      const notice = await page.locator('#route-panel').boundingBox();
      assert.ok(notice.y >= ports.bottom, 'Notice appears below the port list');
      await page.evaluate(() => scrollTo(0, 0));
      if (width === 320 || width === 390) await page.screenshot({ path: path.join(__dirname, `mobile-layout-${width}-chart.png`), fullPage: true });
      if (width === 390) {
        await page.setViewportSize({ width: 1200, height: 900 });
        assert.equal(await page.locator('#route-panel').isVisible(), true, 'Desktop shows the notice');
        await page.setViewportSize({ width, height });
        assert.equal(await page.locator('#route-panel').isVisible(), true, 'Mobile keeps the notice visible');
        await page.locator('#chart-world').tap();
        const target = await page.evaluate(() => {
          const p = Windward.N.project(-12,30), c = new DOMPoint(p.x,p.y).matrixTransform(document.getElementById('sea-map').getScreenCTM());
          return { x:c.x,y:c.y };
        });
        await page.touchscreen.tap(target.x, target.y);
        await page.locator('#open-chart-button').tap();
        await checkHeight('moving chart');
        assert.match(await page.locator('#route-panel').innerText(), /남은 항로/);
        await page.waitForFunction(() => !document.getElementById('voyage-screen').hidden, null, { timeout: 4000 });
        await page.locator('#voyage-pause').tap();
      }
      if (await page.locator('#return-sea-button').isVisible()) await page.locator('#return-sea-button').tap();
      if (width === 320 || width === 390) await page.screenshot({ path: path.join(__dirname, `mobile-layout-${width}-sea.png`), fullPage: true });
      const offshore = await page.evaluate(() => {
        const state = Windward.act(Windward.initial(), {type:'show-chart'});
        state.position = Windward.N.project(-12,34); state.port = null;
        return state;
      });
      await page.addInitScript(state => localStorage.setItem('windward-v1',JSON.stringify(state)), offshore);
      await page.reload(); await page.locator('#start-button').tap();
      for (const id of ['voyage-rescue','rescue-button']) {
        if (id === 'rescue-button') await page.locator('#open-chart-button').tap();
        const fit = await page.locator('#'+id).evaluate(button => {
          const panel=button.closest('.arrival-panel'), b=button.getBoundingClientRect(), p=panel.getBoundingClientRect();
          const message=panel.querySelector('div').getBoundingClientRect();
          const cost=button.querySelector('small'), range=document.createRange(); range.selectNodeContents(cost);
          return {fits:b.left>=p.left && b.right<=p.right && b.bottom<=p.bottom,
            separate:message.right<=b.left || message.bottom<=b.top,
            lines:range.getClientRects().length, height:b.height, label:cost.textContent};
        });
        assert.ok(fit.fits && fit.separate && fit.height>=44, 'Rescue button fits without overlapping the message');
        assert.equal(fit.lines,1,'Rescue cost stays on one line');
        assert.equal(fit.label,'3일 / 최대 40 G');
      }
      if ([320,390,512].includes(width)) await page.screenshot({path:path.join(__dirname,`mobile-layout-${width}-rescue.png`),fullPage:true});
      await page.locator('#rescue-button').tap();
      const rescued = await page.evaluate(() => JSON.parse(localStorage.getItem(Windward.KEY)));
      assert.equal(rescued.day,4); assert.equal(rescued.gold,660);
      await context.close();
    }
    assert.deepEqual(errors, []);
    console.log('PASS: map controls anchored top-right, compact chart height, two-row ports, route notice, dialog scrolling, automatic return and rescue layout/action on six viewport sizes.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
