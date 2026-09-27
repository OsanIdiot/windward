const test=require('node:test'),assert=require('node:assert/strict'),E=require('../../engine.js');
test('coastal sampling keeps exact shore distances and existing sea collision mask',async()=>{
  const {coastSampler}=await import('./terrain-data.js'),center=E.PORTS[0],M={E,local:p=>({x:(p.x-center.x)*4,z:(p.y-center.y)*4}),world:p=>({x:p.x/4+center.x,y:p.z/4+center.y})},s=coastSampler(M,320);
  for(const [x,z] of [[0,0],[20,-20],[-100,50],[55,100]]){
    let expected=1000;
    for(const r of s.rings)for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length];if(Math.min(a.x,b.x)>370||Math.max(a.x,b.x)<-370||Math.min(a.z,b.z)>370||Math.max(a.z,b.z)<-370)continue;const dx=b.x-a.x,dz=b.z-a.z,l=dx*dx+dz*dz,t=l?Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/l)):0;expected=Math.min(expected,Math.hypot(x-a.x-dx*t,z-a.z-dz*t));}
    assert.ok(Math.abs(s.coastDistance(x,z)-expected)<1e-9);assert.equal(s.isLand(x,z),!E.N.isSea(M.world({x,z})));
  }
});
test('worker data and sliced fallback agree, with lower mobile relief detail but identical coastline depth',async()=>{
  const {coastSampler,terrainData,terrainDataAsync}=await import('./terrain-data.js');
  const M={E,local:p=>({x:p.x-130,z:p.y-365}),world:p=>({x:p.x+130,y:p.z+365})},s=coastSampler(M,24),options={size:16,step:4};
  const sync=terrainData(s,24,options);assert.deepEqual(await terrainDataAsync(s,24,options),sync);
  const mobile=terrainData(s,24,{...options,step:8});assert.deepEqual(mobile.data,sync.data);assert.ok(mobile.points.length<sync.points.length*.4);
  assert.ok(sync.data instanceof Uint8Array);assert.ok(sync.points instanceof Float32Array);assert.ok(sync.indices instanceof Uint32Array);
  for(const i of mobile.indices)assert.ok(i<mobile.points.length/3);
});
test('land UVs stay fixed to geography across streamed regions and relief resolutions',async()=>{
  const {coastSampler,terrainData,landUV}=await import('./terrain-data.js');
  const point={x:132,y:364},expected=landUV(point);
  for(const center of [{x:128,y:368},{x:136,y:360}]){
    const M={E,local:p=>({x:(p.x-center.x)*4,z:(p.y-center.y)*4}),world:p=>({x:p.x/4+center.x,y:p.z/4+center.y})},s=coastSampler(M,24),p=M.local(point);
    assert.deepEqual(s.textureUV(p.x,p.z),expected);
    for(const step of [4,8]){
      const data=terrainData(s,24,{size:8,step}),count=48/step+1,i=(p.z+24)/step*count+(p.x+24)/step;
      assert.equal(data.uv[i*2],expected.u);assert.equal(data.uv[i*2+1],expected.v);
      assert.ok(Math.abs(s.textureUV(p.x+64,p.z).u-expected.u-1)<1e-9,'Texture repeats once per 64 scene units, not twelve times per unit');
    }
  }
});
