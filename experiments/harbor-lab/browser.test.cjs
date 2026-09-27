const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const base=process.env.BASE_URL||'http://127.0.0.1:4179';
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    for(const [width,height] of [[390,844],[320,568],[844,390],[1280,900]]){
      const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,isMobile:width<900,hasTouch:width<900,reducedMotion:'reduce'});
      await context.addInitScript(()=>{
        localStorage.setItem('windward-v1','production-save-must-stay-untouched');
        const get=Storage.prototype.getItem,set=Storage.prototype.setItem;
        Storage.prototype.getItem=function(key){if(key==='windward-v1')throw Error('Prototype tried to read a production save');return get.call(this,key);};
        Storage.prototype.setItem=function(){throw Error('Prototype tried to write storage');};
        window.testOriginalGet=get;
      });
      const page=await context.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
      await page.goto(base);await page.waitForFunction(()=>!!window.harborLab);
      assert.equal(await page.locator('#failure').isVisible(),false);
      const snapshot=()=>page.evaluate(()=>harborLab.snapshot());const initial=await snapshot();
      assert.ok(initial.drawCalls<150);assert.ok(initial.triangles<80000);
      assert.ok(initial.renderPixels<=700000);assert.ok(initial.pixelRatio<=1);assert.equal(initial.shadows,false);assert.equal(initial.frameLimit,30);
      await page.waitForTimeout(150);const idle=(await snapshot()).renderedFrames;
      await page.waitForTimeout(200);assert.equal((await snapshot()).renderedFrames,idle,'Reduced-motion idle does not redraw');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight+1));
      const ui=await page.evaluate(()=>{const ids=['lookout','chart','stop','camera','quality','about'];return ids.map(id=>{const r=document.getElementById(id).getBoundingClientRect();return{id,x:r.x,y:r.y,w:r.width,h:r.height};});});
      for(const r of ui){assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=width+1&&r.y+r.h<=height+1,`${r.id} fits ${width}x${height}`);}
      await page.locator('#camera').click();assert.equal((await snapshot()).headingUp,false);assert.deepEqual((await snapshot()).state,initial.state);
      await page.locator('#camera').click();await page.locator('#quality').click();const sharp=await snapshot();assert.ok(sharp.high&&sharp.shadows);assert.equal(sharp.frameLimit,60);assert.ok(sharp.renderPixels<=1400000);await page.locator('#quality').click();
      await page.locator('#lookout').click();assert.ok((await snapshot()).lookout);await page.locator('#lookout').click();
      await page.screenshot({path:path.join(__dirname,`preview-${width}.png`)});
      await page.locator('#scene').focus();await page.keyboard.press('ArrowLeft');
      await page.waitForFunction(()=>harborLab.snapshot().state.motion.speed>.3);
      const moving=await snapshot();assert.ok(moving.state.navigation.running);
      const pose=await page.evaluate(()=>{const s=harborLab.snapshot().state,a=s.motion.heading*Math.PI/180;const bow=harborLab.project({x:s.position.x+Math.sin(a)*2,y:s.position.y-Math.cos(a)*2}),stern=harborLab.project({x:s.position.x-Math.sin(a)*2,y:s.position.y+Math.cos(a)*2});return{bow,stern};});
      assert.ok(Math.abs(pose.bow.x-pose.stern.x)<.01&&pose.bow.y<pose.stern.y,'Heading-up projects the bow above the stern');
      await page.locator('#chart').click();const paused=await snapshot();await page.waitForTimeout(250);assert.deepEqual((await snapshot()).state.position,paused.state.position);assert.equal((await snapshot()).renderedFrames,paused.renderedFrames,'Dialogs suspend drawing as well as physics');
      await page.keyboard.press('Escape');assert.equal(await page.locator('#chart-dialog').isVisible(),false);
      await page.locator('#stop').click();await page.waitForFunction(()=>!harborLab.snapshot().state.navigation.running,null,{timeout:30000});
      assert.equal((await snapshot()).state.motion.speed,0);
      await page.locator('#reset').click();assert.deepEqual((await snapshot()).state,initial.state);
      const targets=await page.evaluate(()=>{const M=HarborModel,s=harborLab.snapshot().state,top=document.querySelector('.masthead').getBoundingClientRect().bottom+12,bottom=document.querySelector('.helm').getBoundingClientRect().top-12;let water,land;for(let x=-15;x<15;x+=1.5)for(let y=-20;y<20;y+=1.5){const p={x:M.port.x+x,y:M.port.y+y},v=harborLab.project(p),hit=document.elementFromPoint(v.x,v.y);if(hit?.id!=='scene'||v.y<top||v.y>bottom)continue;if(!M.E.N.isSea(p))land={p,v};else if(M.E.N.clear(s.position,p)&&M.E.N.distance(s.position,p)>3)water={p,v};}return{water,land};});
      if(targets.land){await page.mouse.click(targets.land.v.x,targets.land.v.y);assert.equal((await snapshot()).state.navigation,null);}
      assert.ok(targets.water,'There is a reachable visible sea target');await page.mouse.click(targets.water.v.x,targets.water.v.y);assert.ok((await snapshot()).state.navigation.running);
      await page.screenshot({path:path.join(__dirname,`preview-${width}-sailing.png`)});
      assert.equal(await page.evaluate(()=>testOriginalGet.call(localStorage,'windward-v1')),'production-save-must-stay-untouched');
      assert.deepEqual(errors,[]);console.log(`PASS ${width}x${height}: WebGL, bounded draw budget, layout, camera, keyboard/pointer, land rejection, braking, chart pause, reset and save isolation`);await context.close();
    }
    const paced=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:2,reducedMotion:'no-preference'});
    await paced.goto(base);await paced.waitForFunction(()=>!!window.harborLab);
    const pacing=await paced.evaluate(async()=>{const start=performance.now(),before=harborLab.snapshot().renderedFrames;await new Promise(resolve=>setTimeout(resolve,1500));return{elapsed:performance.now()-start,frames:harborLab.snapshot().renderedFrames-before};});
    assert.ok(pacing.frames>0&&pacing.frames<=pacing.elapsed/1000*30+2,'Decorative water caps actual draws at 30 FPS');
    await paced.close();console.log('PASS lightweight pixel/shadow budget, reduced-motion idle, modal rendering pause and 30 FPS pacing');
    const blocked=await browser.newPage();await blocked.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:get.call(this,type,...args);};});
    await blocked.goto(base);await blocked.locator('#failure').waitFor({state:'visible'});assert.match(await blocked.locator('#failure-message').innerText(),/WebGL 2/);await blocked.close();
    const lost=await browser.newPage();await lost.goto(base);await lost.waitForFunction(()=>!!window.harborLab);await lost.evaluate(()=>document.getElementById('scene').dispatchEvent(new Event('webglcontextlost',{cancelable:true})));await lost.locator('#failure').waitFor({state:'visible'});await lost.close();
    const missing=await browser.newPage();await missing.route('**/world.js',route=>route.abort());await missing.goto(base);await missing.locator('#failure').waitFor({state:'visible'});await missing.close();
    const missingArt=await browser.newPage();await missingArt.route('**/painted-materials.webp',route=>route.abort());await missingArt.goto(base);await missingArt.locator('#failure').waitFor({state:'visible'});assert.equal(await missingArt.evaluate(()=>!!window.harborLab),false);await missingArt.close();
    console.log('PASS unsupported WebGL, context loss, missing painted texture and module-load failure show recoverable messages');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
