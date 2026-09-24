const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    const context = await browser.newContext({reducedMotion:'reduce'});
    const page = await context.newPage();
    await context.route('https://litt.ly/iwiwi', route => route.fulfill({status:200,body:'Support link test'}));
    await page.goto(process.env.BASE_URL || 'http://127.0.0.1:4173/?v=8');
    for (const width of [320,390,768,1440]) {
      await page.setViewportSize({width,height:844});
      const link = page.locator('#entry-screen .support-link');
      assert.equal(await link.getAttribute('href'),'https://litt.ly/iwiwi');
      assert.equal(await link.getAttribute('target'),'_blank');
      assert.match(await link.getAttribute('rel'),/noopener/);
      const a = await link.boundingBox(), b = await page.locator('#help-button').boundingBox();
      assert.ok(a.x+a.width<=b.x,'Support appears left of help');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    }
    const popup = page.waitForEvent('popup');
    await page.locator('#entry-screen .support-link').click();
    const opened = await popup;await opened.waitForLoadState();
    assert.equal(opened.url(),'https://litt.ly/iwiwi');await opened.close();
    await page.locator('#start-button').click();
    await page.setViewportSize({width:320,height:844});
    assert.equal(await page.locator('#game-screen .support-link').isVisible(),true);
    const a = await page.locator('#game-screen .support-link').boundingBox(), b = await page.locator('[data-help]').boundingBox();
    assert.ok(a.x+a.width<=b.x);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    console.log('PASS: support links in both screens, exact destination, safe new-tab behavior, left of help and responsive layout.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
