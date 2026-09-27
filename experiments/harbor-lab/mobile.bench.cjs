const {chromium}=require('playwright'),assert=require('node:assert/strict'),E=require('../../engine.js');
const base=process.env.DEMO_URL||'http://127.0.0.1:4180/demo/';
(async()=>{
  const channel=process.env.BROWSER_CHANNEL||'msedge',width=Number(process.env.WIDTH)||390,height=Number(process.env.HEIGHT)||844,cpuRate=Number(process.env.CPU_RATE)||4;
  const browser=await chromium.launch({channel,headless:true});
  try{
    const page=await browser.newPage({viewport:{width,height}}),state=E.initial();state.visited=['lume','cedar'];
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(state=>{
      localStorage.setItem('windward-demo-v1',JSON.stringify(state));localStorage.setItem('windward-demo-audio-enabled','off');
      window.longTasks=[];new PerformanceObserver(list=>longTasks.push(...list.getEntries().map(e=>({at:e.startTime,ms:e.duration})))).observe({type:'longtask',buffered:true});
      window.statsMutations=0;
    },state);
    const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:cpuRate});
    await page.goto(base);await page.waitForFunction(()=>window.windwardDemoReady);await page.click('#start-button');await page.click('#harbor-button');await page.waitForFunction(()=>windwardDemo.snapshot().chunk&&!windwardDemo.snapshot().loading);
    await page.evaluate(()=>new MutationObserver(list=>statsMutations+=list.length).observe(document.getElementById('gold'),{childList:true,subtree:true}));
    await page.click('#open-chart-button');await page.click('[data-chart-port="cedar"]');const start=await page.evaluate(()=>performance.now());
    await page.waitForFunction(()=>!windwardDemo.snapshot().state.navigation?.running,null,{timeout:60000});
    const result=await page.evaluate(start=>({tasks:longTasks.filter(t=>t.at>=start),triangles:windwardDemo.snapshot().triangles,elapsed:performance.now()-start,statsMutations,terrainMode:windwardDemo.snapshot().terrainMode}),start);
    assert.deepEqual(errors,[]);assert.equal(result.terrainMode,'worker');assert.ok(result.statsMutations<30,'Counters must not rebuild on every animation frame');
    console.log(JSON.stringify({channel,width,height,cpuRate,...result}));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
