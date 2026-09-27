const {chromium}=require('playwright'),assert=require('node:assert/strict');
const E=require('../../engine.js'),base=process.env.DEMO_URL||'http://127.0.0.1:4180/demo/';

(async()=>{
  const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  try{for(const [width,height] of [[390,844],[1280,900]])for(const camera of ['heading','north']){
    const state=E.act(E.initial(),{type:'show-chart'}),port=E.portOf('lume'),site=E.SEA_SITES[0];
    state.port=null;state.position={x:(port.x+site.x)/2,y:(port.y+site.y)/2};
    if(camera==='north')state.position.y-=3;
    assert.ok(E.N.isSea(state.position));
    const page=await browser.newPage({viewport:{width,height}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(({state,camera})=>{
      localStorage.setItem('windward-demo-v1',JSON.stringify(state));
      localStorage.setItem('windward-demo-camera',camera);localStorage.setItem('windward-demo-audio-enabled','false');
    },{state,camera});
    await page.goto(base);await page.waitForFunction(()=>window.windwardDemoReady);await page.click('#start-button');
    if(await page.locator('#return-sea-button').isVisible())await page.click('#return-sea-button');
    await page.waitForFunction(()=>windwardDemo.snapshot().chunk&&!windwardDemo.snapshot().loading);
    await page.waitForTimeout(400);
    await page.evaluate(()=>{
      window.markerCheck={samples:0,ports:0,sites:0,maxError:0,moves:0,replacements:0,last:new Map()};
      const observer=new MutationObserver(records=>{
        for(const r of records)for(const node of [...r.addedNodes,...r.removedNodes])if(node.nodeType===1)markerCheck.replacements++;
      });
      for(const root of [document.getElementById('voyage-ports'),document.querySelector('.demo-sites')])observer.observe(root,{childList:true});
      const sample=()=>{
        const s=markerCheck,r=document.getElementById('voyage-canvas').getBoundingClientRect();s.samples++;
        for(const el of document.querySelectorAll('.voyage-port,.demo-site')){
          if(el.hidden)continue;
          const port=el.classList.contains('voyage-port'),point=port?Windward.PORTS.find(p=>p.id===el.dataset.voyagePort):Windward.SEA_SITES.find(p=>p.id===el.dataset.site);
          const expected=windwardDemo.project(point),actual=el.getBoundingClientRect();
          if(port)expected.y-=r.width<600?72:48;
          s.maxError=Math.max(s.maxError,Math.abs(actual.x+actual.width/2-r.x-expected.x),Math.abs(actual.bottom-r.y-expected.y));
          s[port?'ports':'sites']++;
          if(s.last.has(el)&&s.last.get(el)!==el.style.transform)s.moves++;
          s.last.set(el,el.style.transform);
        }
        s.frame=requestAnimationFrame(sample);
      };sample();
    });
    await page.locator('#voyage-canvas').press(camera==='heading'?'ArrowUp':'ArrowLeft');await page.waitForTimeout(600);
    await page.locator('#voyage-canvas').press(camera==='heading'?'ArrowLeft':'ArrowDown');await page.waitForTimeout(800);
    const result=await page.evaluate(()=>{cancelAnimationFrame(markerCheck.frame);const {last,frame,...result}=markerCheck;return result;});
    assert.ok(result.ports>10&&result.sites>10,`Both marker types sampled: ${JSON.stringify(result)}`);
    assert.ok(result.maxError<1,`Markers match the rendered camera within one CSS pixel: ${JSON.stringify(result)}`);
    assert.ok(result.moves>25,'Marker transforms update at rendering cadence');assert.equal(result.replacements,0,'Marker elements retain their identity');
    assert.deepEqual(errors,[]);console.log(`PASS ${width}x${height} ${camera}: ${JSON.stringify(result)}`);await page.close();
  }}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
