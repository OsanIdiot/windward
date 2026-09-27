const {chromium}=require('playwright');

// Diagnostic only: finish() waits for the GPU and deliberately disturbs normal pacing.
// Compare runs on the same backend; these timings are not real phone FPS.
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:2});
    await page.addInitScript(()=>{
      const raf=window.requestAnimationFrame.bind(window);
      let calls=0,warmup=0;
      for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){
        const original=WebGL2RenderingContext.prototype[name];
        WebGL2RenderingContext.prototype[name]=function(...args){calls++;return original.apply(this,args);};
      }
      window.renderSamples=[];
      window.requestAnimationFrame=callback=>raf(stamp=>{
        const before=calls,start=performance.now();callback(stamp);
        if(calls===before)return;
        const gl=document.getElementById('scene').getContext('webgl2');gl.finish();
        if(warmup++>=20)renderSamples.push(performance.now()-start);
      });
    });
    await page.goto(process.env.BASE_URL||'http://127.0.0.1:4179');
    await page.waitForFunction(()=>window.renderSamples?.length>=45,null,{timeout:120000});
    console.log(JSON.stringify(await page.evaluate(()=>{
      const samples=renderSamples.slice(0,45).sort((a,b)=>a-b),canvas=document.getElementById('scene'),gl=canvas.getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');
      return{renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),pixels:canvas.width*canvas.height,medianMs:samples[22],p95Ms:samples[42],snapshot:harborLab.snapshot()};
    }),null,2));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
