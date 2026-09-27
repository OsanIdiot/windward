const {chromium}=require('playwright'),assert=require('node:assert/strict');
const base=process.env.DEMO_URL||'http://127.0.0.1:4180/demo/';
(async()=>{
  const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  try{
    const page=await browser.newPage();await page.goto(base);await page.waitForFunction(()=>window.windwardDemoReady);
    const result=await page.evaluate(async()=>{
      const T=await import('./vendor/three.module.min.js'),{createWorld}=await import('./world.js'),{landUV}=await import('./terrain-data.js');
      const E=Windward,center=E.PORTS[0],M={E,local:p=>({x:(p.x-center.x)*4,z:(p.y-center.y)*4}),world:p=>({x:p.x/4+center.x,y:p.z/4+center.y})};
      const scene=new T.Scene(),world=createWorld(scene,M,{}, {extent:32,town:false});
      let maxUVError=0,capHeight=-Infinity,minRelief=Infinity,capVertices=0,reliefVertices=0;
      const check=(geo,i)=>{const p=geo.attributes.position,uv=geo.attributes.uv,expected=landUV(M.world({x:p.getX(i),z:p.getZ(i)}));maxUVError=Math.max(maxUVError,Math.abs(uv.getX(i)-expected.u),Math.abs(uv.getY(i)-expected.v));};
      for(const mesh of scene.children){const g=mesh.geometry,p=g.attributes.position;
        if(mesh.name==='coast-base')for(const group of g.groups)if(group.materialIndex===0)for(let i=group.start;i<group.start+group.count;i++){check(g,i);capHeight=Math.max(capHeight,p.getY(i));capVertices++;}
        if(mesh.name==='inland-relief')for(let i=0;i<p.count;i++){check(g,i);minRelief=Math.min(minRelief,p.getY(i));reliefVertices++;}
      }
      const map=scene.getObjectByName('inland-relief').material.map,c=map.image,bytes=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
      let contrast=0,count=0;
      for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)for(let channel=0;channel<3;channel++){
        const i=(y*c.width+x)*4+channel,right=(y*c.width+(x+1)%c.width)*4+channel;
        contrast+=Math.abs(bytes[i]-bytes[right]);count++;
      }
      const result={maxUVError,capHeight,minRelief,capVertices,reliefVertices,contrast:contrast/count,
        mipmaps:map.generateMipmaps&&map.minFilter===T.LinearMipmapLinearFilter,repeat:map.repeat.toArray()};
      const materials=new Set(),textures=new Set([world.depth]);scene.traverse(mesh=>{mesh.geometry?.dispose();for(const m of mesh.material?(Array.isArray(mesh.material)?mesh.material:[mesh.material]):[])materials.add(m);});
      for(const m of materials){if(m.map)textures.add(m.map);m.dispose();}for(const t of textures)t.dispose();return result;
    });
    assert.ok(result.capVertices>0&&result.reliefVertices>0);
    assert.ok(result.maxUVError<.000002,'Base and relief use the same world-space texture mapping');
    assert.ok(result.minRelief-result.capHeight>.03,'Relief cannot fight with the coast base for depth');
    assert.ok(result.contrast<1.5,'Land texture has soft detail, including wrapped tile edges');
    assert.equal(result.mipmaps,true);assert.deepEqual(result.repeat,[1,1]);
    console.log(`PASS stable land surfaces: ${JSON.stringify(result)}`);
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
