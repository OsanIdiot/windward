const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const E = require('./engine.js');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [];
  try {
    for (const [width,height] of [[1280,900],[320,568],[390,844]]) {
      const mobile = width < 900;
      const context = await browser.newContext({ viewport:{width,height}, isMobile:mobile, hasTouch:mobile, reducedMotion:'reduce' });
      const fixture = E.initial();
      fixture.visited = E.PORTS.map(p => p.id); fixture.gold = 65960; fixture.ship = 1; fixture.won = true;
      await context.addInitScript(state => {
        localStorage.setItem('windward-v1', JSON.stringify(state));
        localStorage.setItem('windward-audio-enabled','off');
      }, fixture);
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(e.message));
      const click = selector => mobile ? page.locator(selector).tap() : page.locator(selector).click();
      const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem(Windward.KEY)));
      await page.goto(process.env.BASE_URL || 'http://127.0.0.1:4173/?v=25');
      await click('#start-button'); await click('#harbor-button'); await click('#open-chart-button');
      assert.equal(await page.locator('#mode-manual, #mode-auto').count(),0);
      assert.equal(await page.locator('#chart-screen #quest-checks, #chart-screen #adventure-checks').count(),0);
      assert.equal(await page.locator('#goals-dialog').isVisible(),false);
      const before = await saved();
      await click('#goals-button');
      assert.equal(await page.locator('#goals-dialog').isVisible(),true);
      assert.match(await page.locator('#quest-checks').innerText(), /항구 8\/8/);
      assert.match(await page.locator('#quest-checks').innerText(), /65,960 \/ 5,000 G/);
      assert.match(await page.locator('#quest-checks').innerText(), /첫 챕터 완료/);
      assert.match(await page.locator('#adventure-checks').innerText(), /발견 0\/5/);
      assert.deepEqual(await saved(),before,'Opening goals does not change progress');
      const bounds = await page.locator('#goals-dialog').boundingBox();
      assert.ok(bounds.x>=0 && bounds.y>=0 && bounds.x+bounds.width<=width+1 && bounds.y+bounds.height<=height+1);
      assert.ok(await page.locator('#goals-dialog').evaluate(el => el.scrollWidth<=el.clientWidth));
      await page.locator('#adventure-checks').scrollIntoViewIfNeeded();
      await page.screenshot({path:`goals-${width}.png`,fullPage:true});
      await click('[data-close="goals-dialog"]');
      assert.equal(await page.locator('#goals-button').evaluate(el => document.activeElement===el),true,'Close restores button focus');
      await click('#goals-button'); await page.keyboard.press('Escape');
      assert.equal(await page.locator('#goals-dialog').isVisible(),false);
      await click('[data-chart-port="saffron"]');
      assert.equal((await saved()).navigation.mode,'auto');
      await click('#open-chart-button'); await click('#goals-button');
      await page.waitForTimeout(3300);
      assert.equal(await page.locator('#chart-screen').isVisible(),true,'Goals prevent automatic screen return');
      assert.equal((await saved()).navigation.running,true,'Voyage continues while reading goals');
      await click('[data-close="goals-dialog"]');
      // The always-visible route notice must not hold the chart open.
      await page.waitForFunction(() => !document.getElementById('voyage-screen').hidden, null, {timeout:4000});
      await click('#open-chart-button'); await click('#chart-world');
      await page.locator('#sea-map').scrollIntoViewIfNeeded();
      const target = await page.evaluate(() => {
        const s=JSON.parse(localStorage.getItem(Windward.KEY));
        for (let heading=0;heading<360;heading+=15) {
          const p=Windward.N.headingTarget(s.position,heading,250);
          if (Windward.N.distance(s.position,p)<80) continue;
          const c=new DOMPoint(p.x,p.y).matrixTransform(document.getElementById('sea-map').getScreenCTM());
          const hit=document.elementFromPoint(c.x,c.y);
          // Mobile touch adjustment can select a nearby port even when the exact point is water.
          const nearPort = [...document.querySelectorAll('#sea-map [data-port]')].some(el => {
            const r = el.getBoundingClientRect();
            return c.x >= r.left - 12 && c.x <= r.right + 12 && c.y >= r.top - 12 && c.y <= r.bottom + 12;
          });
          if (hit?.closest('#sea-map') && !nearPort) return {x:c.x,y:c.y};
        }
        throw Error('No clear, unobstructed test sea target');
      });
      if (mobile) await page.touchscreen.tap(target.x,target.y); else await page.mouse.click(target.x,target.y);
      assert.equal((await saved()).navigation.mode,'manual',`Sea click changes auto route at ${width}: ` + await page.locator('#toast').innerText());
      assert.equal(await page.locator('#voyage-screen').isVisible(),true);
      await context.close();
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: goal progress dialog, mobile fit/scroll, close/Escape/focus, preserved state, protected chart return and automatic/manual navigation without mode buttons.');
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode=1;});
