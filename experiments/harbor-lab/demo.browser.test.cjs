const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path');
const E=require('../../engine.js'),base=process.env.DEMO_URL||'http://127.0.0.1:4180/demo/';
const key='windward-demo-v1',sentinel='production-record-must-not-change';
const snapshot=p=>p.evaluate(()=>windwardDemo.snapshot());
async function fixture(browser,{width=390,height=844,state=null,fallback=false,missing=false}={}){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,reducedMotion:'reduce'});
  await context.addInitScript(({key,sentinel,state,fallback})=>{
    if(!sessionStorage.getItem('test-seeded')){
      localStorage.setItem('windward-v1',sentinel);localStorage.setItem('windward-camera','north');
      if(state)localStorage.setItem(key,JSON.stringify(state));sessionStorage.setItem('test-seeded','yes');
    }
    const get=Storage.prototype.getItem,set=Storage.prototype.setItem;
    window.testGet=get;
    Storage.prototype.getItem=function(name){if(name.startsWith('windward-v1'))throw Error('Production save read');return get.call(this,name);};
    Storage.prototype.setItem=function(name,value){if(name.startsWith('windward-v1')||name==='windward-camera'||name==='windward-audio-enabled')throw Error('Production storage write');return set.call(this,name,value);};
    if(fallback){const getContext=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...rest){return type==='webgl2'?null:getContext.call(this,type,...rest);};}
    const Original=window.AudioContext;window.audioContexts=[];window.audioStarts=[];
    if(Original)window.AudioContext=class extends Original{constructor(...args){super(...args);window.audioContexts.push(this);}createBufferSource(){const node=super.createBufferSource(),start=node.start;node.start=function(...args){window.audioStarts.push({loop:node.loop,duration:node.buffer?.duration});return start.apply(node,args);};return node;}};
  },{key,sentinel,state,fallback});
  const page=await context.newPage(),errors=[];
  page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  if(missing)await page.route('**/painted-materials.webp',route=>route.abort());
  await page.goto(base);await page.waitForFunction(()=>window.windwardDemoReady);await page.click('#start-button');await page.waitForFunction(()=>document.getElementById('entry-screen').hidden);
  return{page,context,errors};
}
async function isolation(page){assert.equal(await page.evaluate(()=>testGet.call(localStorage,'windward-v1')),sentinel);assert.equal(await page.evaluate(()=>testGet.call(localStorage,'windward-camera')),'north');}
async function departure(page){await page.click('#harbor-button');await page.waitForFunction(()=>windwardDemo.snapshot().chunk&&!windwardDemo.snapshot().loading);}
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    for(const [width,height] of [[390,844],[320,568],[844,390],[1280,900]]){
      const {page:p,context,errors}=await fixture(browser,{width,height});
      assert.equal((await snapshot(p)).state.gold,700);
      await p.click('[data-service="market"]');await p.fill('#qty-grain','8');await p.click('[data-trade="grain"]');
      assert.equal((await snapshot(p)).state.cargo.grain,8);assert.equal((await snapshot(p)).state.gold,572);
      await p.click('#tab-contracts');await p.click('#accept-contract-button');assert.equal((await snapshot(p)).state.activeContract,'bread');
      await p.click('#tab-adventure');await p.click('#explore-button');assert.deepEqual((await snapshot(p)).state.discoveries,['tide']);
      await p.locator('[data-close="discovery-dialog"]').last().click();await p.click('#close-service');
      await departure(p);assert.equal((await snapshot(p)).mode,'painted');
      await p.waitForTimeout(250);const idle=await snapshot(p);await p.waitForTimeout(250);assert.equal((await snapshot(p)).draws,idle.draws,'Reduced-motion idle does not repaint');
      assert.ok(idle.pixels<=700000);assert.ok(idle.drawCalls<150);
      assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
      if(width<=390)assert.ok(await p.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+2),'Compact portrait sailing fits the viewport');
      await p.screenshot({path:path.join(__dirname,`demo-${width}.png`),fullPage:true});
      await p.locator('.helm-help summary').click();await p.click('#voyage-camera-toggle');assert.equal((await snapshot(p)).headingUp,false);await p.click('#voyage-camera-toggle');await p.locator('.helm-help summary').click();
      await p.click('#open-chart-button');await p.locator('#chart-screen').waitFor({state:'visible'});await p.click('#return-sea-button');
      await p.click('#lookout-button');assert.ok((await snapshot(p)).state.seaClues.includes('seabirds'));await p.click('[data-close="sea-atlas-dialog"]');
      const tap=await p.evaluate(()=>{
        const s=windwardDemo.snapshot().state,r=document.getElementById('voyage-canvas').getBoundingClientRect(),angle=s.motion.heading*Math.PI/180;
        for(const distance of [3,6,10,14,18]){const point={x:s.position.x+Math.sin(angle)*distance,y:s.position.y-Math.cos(angle)*distance},v=windwardDemo.project(point),x=v.x+r.x,y=v.y+r.y;
          if(Windward.N.clear(s.position,point)&&document.elementFromPoint(x,y)?.id==='voyage-canvas')return{x,y};}
      });
      assert.ok(tap,'Visible unobstructed sea can be clicked');await p.mouse.click(tap.x,tap.y);
      await p.waitForFunction(()=>windwardDemo.snapshot().state.motion.speed>.2);
      const moving=await snapshot(p);assert.equal(moving.state.port,null);assert.notDeepEqual(moving.state.position,idle.state.position);
      await p.waitForFunction(()=>{const s=windwardDemo.snapshot().state;return Windward.N.distance(s.position,Windward.PORTS[0])>12;});
      await p.click('#voyage-pause');assert.ok((await snapshot(p)).state.navigation.stopping);
      await p.waitForFunction(()=>!windwardDemo.snapshot().state.navigation.running);assert.equal((await snapshot(p)).state.motion.speed,0);
      // Returning to the known home port exercises the real chart -> automatic route -> 3D loop.
      await p.click('#open-chart-button');await p.locator('#port-selector button').first().click();
      await p.locator('#voyage-screen').waitFor({state:'visible'});
      await p.waitForFunction(()=>!windwardDemo.snapshot().state.navigation?.running);await p.locator('#voyage-enter-port').waitFor();
      const audioBefore=await p.evaluate(()=>({contexts:audioContexts.length,oneShots:audioStarts.filter(a=>!a.loop).length}));
      await p.click('#voyage-enter-port');assert.equal((await snapshot(p)).state.port,'lume');
      await p.waitForFunction(n=>audioStarts.filter(a=>!a.loop).length>n,audioBefore.oneShots);
      assert.equal(await p.evaluate(()=>audioContexts.length),audioBefore.contexts,'Port entry reuses the unlocked audio context');
      assert.equal((await snapshot(p)).state.cargo.grain,8);assert.deepEqual((await snapshot(p)).state.discoveries,['tide']);
      const saved=(await snapshot(p)).state;await p.reload();await p.waitForFunction(()=>window.windwardDemoReady);await p.click('#start-button');await p.waitForFunction(()=>document.getElementById('entry-screen').hidden);
      assert.deepEqual((await snapshot(p)).state,saved);
      if(width===390){await p.click('#return-menu-button');await p.click('#reset-button');await p.click('#confirm-reset');await p.waitForFunction(()=>document.getElementById('entry-screen').hidden);assert.equal((await snapshot(p)).state.gold,700);assert.deepEqual((await snapshot(p)).state.discoveries,[]);}
      await isolation(p);assert.deepEqual(errors,[]);
      console.log(`PASS ${width}x${height}: trade, contract, exploration, sailing, braking, chart/port transitions, bell, reload, isolation`);await context.close();
    }
    // Complete a contract at an undiscovered destination, then upgrade through all tiers.
    let arrival=E.act(E.act(E.initial(),{type:'trade',side:'buy',good:'grain',qty:8}),{type:'accept',contract:'bread'});
    arrival=E.act(arrival,{type:'show-chart'});arrival.port=null;arrival.position={x:E.PORTS[1].x,y:E.PORTS[1].y};arrival.gold=100000;
    const run=await fixture(browser,{state:arrival}),p=run.page;
    await p.waitForFunction(()=>windwardDemo.snapshot().chunk);assert.match(await p.locator('#voyage-arrival').innerText(),/미확인 항구/);
    await p.click('#voyage-enter-port');assert.ok((await snapshot(p)).state.visited.includes('cedar'));
    await p.click('[data-service="contracts"]');await p.click('#deliver-button');assert.deepEqual((await snapshot(p)).state.contractsDone,['bread']);assert.equal((await snapshot(p)).state.cargo.grain,0);
    await p.click('#tab-ship');
    for(let tier=1;tier<E.SHIPS.length;tier++){
      await p.click('#upgrade-button');assert.equal((await snapshot(p)).state.ship,tier);await p.click('#close-service');await departure(p);
      assert.equal((await snapshot(p)).tier,tier);assert.match(await p.locator('#voyage-speed').innerText(),new RegExp(E.SHIPS[tier].name));
      await p.click('#voyage-enter-port');await p.click('[data-service="ship"]');
    }
    await p.click('#close-service');await isolation(p);assert.deepEqual(run.errors,[]);await run.context.close();console.log('PASS first port discovery, delivery and all seven ship tiers');
    // Each actual port and sea discovery can be rendered outside the old Lisbon-only area.
    for(const target of [...E.PORTS,...E.SEA_SITES]){
      const s=E.act(E.initial(),{type:'show-chart'});s.port=null;s.position={x:target.x,y:target.y};
      const run=await fixture(browser,{state:s});await run.page.waitForFunction(()=>windwardDemo.snapshot().chunk);
      if(E.SEA_SITES.includes(target)){
        await run.page.click('#lookout-button');await run.page.click(`[data-sea-survey="${target.id}"]`);
        assert.ok((await snapshot(run.page)).state.seaDiscoveries.includes(target.id));
      }
      assert.ok((await snapshot(run.page)).drawCalls<150);assert.deepEqual(run.errors,[]);await run.context.close();
    }
    console.log('PASS all eight port regions and all sea-discovery surveys');
    const known=E.initial();known.visited=['lume','cedar'];known.gold=5000;
    const passage=await fixture(browser,{state:known,width:1280,height:900}),sea=passage.page;
    await departure(sea);await sea.click('#open-chart-button');await sea.click('[data-chart-port="cedar"]');await sea.locator('#voyage-screen').waitFor({state:'visible'});
    const chunks=new Set(),start=Date.now();
    while((await snapshot(sea)).state.navigation?.running){
      const snap=await snapshot(sea);chunks.add(snap.chunk);assert.ok(snap.chunkCount<=3);assert.ok(E.N.isSea(snap.state.position));
      assert.ok(Date.now()-start<60000,'Cross-region voyage finishes at the real game speed');await sea.waitForTimeout(150);
    }
    assert.ok(chunks.size>=4,`Visited streamed regions: ${chunks.size}`);
    await sea.locator('#voyage-enter-port').waitFor();await sea.click('#voyage-enter-port');assert.equal((await snapshot(sea)).state.port,'cedar');
    await departure(sea);await sea.locator('#voyage-canvas').focus();await sea.keyboard.press('ArrowRight');await sea.waitForFunction(()=>windwardDemo.snapshot().state.motion.speed>.05);
    await sea.reload();await sea.waitForFunction(()=>window.windwardDemoReady);await sea.click('#start-button');await sea.waitForFunction(()=>!document.getElementById('voyage-screen').hidden);
    const restored=await snapshot(sea);assert.equal(restored.state.motion.speed,0);assert.equal(restored.state.navigation.running,false);assert.equal(restored.state.lastPort,'cedar');
    const second=await passage.context.newPage();await second.goto(base);await second.waitForFunction(()=>window.windwardDemoReady);await second.click('#start-button');await sea.locator('#entry-screen').waitFor({state:'visible'});
    assert.match(await sea.locator('#session-notice').innerText(),/다른 탭/);assert.deepEqual((await snapshot(second)).state.position,restored.state.position);
    await second.evaluate(()=>document.getElementById('voyage-canvas').dispatchEvent(new Event('webglcontextlost',{cancelable:true})));await second.locator('.demo-render-note').waitFor({state:'visible'});
    await second.click('#open-chart-button');await second.locator('#chart-screen').waitFor({state:'visible'});
    await isolation(second);assert.deepEqual(passage.errors,[]);await passage.context.close();
    console.log('PASS Lisbon -> Cadiz real-time sailing, bounded streaming cache, mid-sea reload, tab ownership and graphics-loss chart recovery');
    for(const options of [{fallback:true},{missing:true}]){
      const run=await fixture(browser,options),p=run.page;await p.click('#harbor-button');await p.locator('#voyage-screen').waitFor({state:'visible'});
      await p.click('#voyage-camera-toggle');await p.click('#voyage-enter-port');await p.click('[data-service="market"]');await p.click('[data-trade="grain"]');
      const state=await p.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);assert.equal(state.cargo.grain,1);
      await isolation(p);assert.deepEqual(run.errors,[]);await run.context.close();
    }
    console.log('PASS playable fallback with unsupported WebGL and missing graphics assets');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
