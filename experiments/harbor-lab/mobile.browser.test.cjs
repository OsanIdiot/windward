const {chromium}=require('playwright'),assert=require('node:assert/strict');
const base=process.env.DEMO_URL||'http://127.0.0.1:4180/demo/';
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{for(const workers of [true,false]){
    const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    if(!workers)await page.addInitScript(()=>{window.Worker=class{constructor(){throw Error('Workers disabled for recovery test');}};});
    await page.goto(base);await page.waitForFunction(()=>window.windwardDemoReady);await page.click('#start-button');await page.click('#harbor-button');
    await page.waitForFunction(()=>windwardDemo.snapshot().chunk&&!windwardDemo.snapshot().loading);
    const snap=await page.evaluate(()=>windwardDemo.snapshot());assert.equal(snap.terrainMode,workers?'worker':'sliced');assert.ok(snap.triangles<60000);
    const layout=await page.evaluate(()=>{const stage=document.getElementById('voyage-stage').getBoundingClientRect();return{height:stage.height,overflow:document.documentElement.scrollHeight-innerHeight,mini:getComputedStyle(document.getElementById('mini-chart-button')).display};});
    assert.ok(layout.height>560);assert.ok(layout.overflow<=2);assert.equal(layout.mini,'none');
    for(const id of ['open-chart-button','lookout-button']){
      assert.ok(await page.evaluate(id=>{const el=document.getElementById(id),r=el.getBoundingClientRect();return r.width>=44&&r.height>=44&&el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));},id),`${id} is a reachable touch target`);
    }
    await page.click('#lookout-button');await page.click('[data-close="sea-atlas-dialog"]');await page.locator('.helm-help summary').click();await page.click('#voyage-camera-toggle');await page.locator('.helm-help summary').click();
    await page.setViewportSize({width:1280,height:900});await page.waitForTimeout(300);assert.equal(await page.locator('#mini-chart-button').isVisible(),true);
    const miniDrawn=await page.evaluate(()=>Array.from(document.getElementById('voyage-minimap').getContext('2d').getImageData(0,0,1,1).data));assert.equal(miniDrawn[3],255);
    await page.click('#open-chart-button');await page.click('#return-sea-button');await page.click('#voyage-enter-port');assert.equal(await page.evaluate(()=>windwardDemo.snapshot().state.screen),'port');
    assert.deepEqual(errors,[]);await page.close();console.log(`PASS mobile layout, touch targets, settings, resize and ${workers?'worker':'sliced fallback'} terrain`);
  }}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
