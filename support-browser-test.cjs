const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    const context = await browser.newContext({reducedMotion:'reduce'});
    const page = await context.newPage();
    await context.route('https://litt.ly/iwiwi', route => route.fulfill({status:200,body:'Support link test'}));
    await page.goto(process.env.BASE_URL || 'http://127.0.0.1:4173/?v=10');
    async function matchingStyle(linkSelector, helpSelector) {
      const read = el => { const s = getComputedStyle(el); return ['color','fontSize','fontWeight','fontFamily','backgroundColor','borderWidth','textDecorationLine','padding'].map(key => s[key]); };
      assert.deepEqual(await page.locator(linkSelector).evaluate(read),await page.locator(helpSelector).evaluate(read));
    }
    for (const width of [320,390,768,1440]) {
      await page.setViewportSize({width,height:844});
      const link = page.locator('#entry-screen [data-support]');
      assert.equal(await link.evaluate(el=>el.tagName),'BUTTON');
      assert.equal(await link.getAttribute('href'),null);
      assert.equal(await link.getAttribute('class'),await page.locator('#help-button').getAttribute('class'));
      const a = await link.boundingBox(), b = await page.locator('#help-button').boundingBox();
      assert.ok(a.x+a.width<=b.x,'Support appears left of help');
      await matchingStyle('#entry-screen [data-support]','#help-button');
      await link.hover();
      await matchingStyle('#entry-screen [data-support]','#help-button');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    }
    const popup = page.waitForEvent('popup');
    await page.locator('#entry-screen [data-support]').click();
    const opened = await popup;await opened.waitForLoadState();
    assert.equal(opened.url(),'https://litt.ly/iwiwi');assert.equal(await opened.evaluate(()=>window.opener),null);await opened.close();
    await page.locator('#start-button').click();
    await page.setViewportSize({width:320,height:844});
    assert.equal(await page.locator('#game-screen [data-support]').isVisible(),true);
    const a = await page.locator('#game-screen [data-support]').boundingBox(), b = await page.locator('[data-help]').boundingBox();
    assert.ok(a.x+a.width<=b.x);
    await matchingStyle('#game-screen [data-support]','[data-help]');
    await page.locator('#game-screen [data-support]').hover();
    await matchingStyle('#game-screen [data-support]','[data-help]');
    const nextPopup=page.waitForEvent('popup');
    await page.locator('#game-screen [data-support]').focus();await page.keyboard.press('Enter');
    const nextOpened=await nextPopup;await nextOpened.waitForLoadState();
    assert.equal(nextOpened.url(),'https://litt.ly/iwiwi');await nextOpened.close();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    console.log('PASS: native buttons with identical help styles at rest and hover, no href, correct secure popup, keyboard activation and responsive layout.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
