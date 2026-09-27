const test=require('node:test');
const assert=require('node:assert/strict');

test('wake opacity actually reaches zero smoothly before old geometry is discarded',async()=>{
  const {wakeOpacity,WAKE_LIFETIME}=await import('./ocean.js');
  assert.equal(wakeOpacity(0,1),0);assert.equal(wakeOpacity(2,1),1);
  let previous=1;for(let t=2;t<=WAKE_LIFETIME;t+=.05){const alpha=wakeOpacity(t,1);assert.ok(alpha<=previous+1e-9&&alpha>=0);previous=alpha;}
  assert.ok(wakeOpacity(WAKE_LIFETIME-.01,1)<.00001);assert.equal(wakeOpacity(WAKE_LIFETIME,1),0);assert.equal(wakeOpacity(2,0),0);
});
test('wake stays in world space, emits only while moving, and retains a full bounded fade at 30 and 60 FPS',async()=>{
  const {createWakeHistory}=await import('./ocean.js');
  const counts=[];
  for(const hz of [30,60]){const history=createWakeHistory();
    for(let i=0;i<=hz*30;i++)history.update(i/hz,{x:0,z:-i/hz*3},0,.8);
    assert.ok(history.samples.length<=141&&history.samples.length>=138);counts.push(history.samples.length);
    const first={...history.samples[0]},last={...history.samples.at(-1)},count=history.samples.length;
    history.update(30.01,{x:0,z:-90},Math.PI/2,0);
    assert.equal(history.samples.length,count);assert.deepEqual(history.samples[0],first);assert.deepEqual(history.samples.at(-1),last);
    history.update(45,{x:0,z:-90},0,0);assert.equal(history.samples.length,0);
  }
  assert.ok(Math.abs(counts[0]-counts[1])<=1);
});
test('reset and teleport cannot connect distant wake strips',async()=>{
  const {createWakeHistory}=await import('./ocean.js');const history=createWakeHistory();
  history.update(0,{x:0,z:0},0,1);history.update(.1,{x:0,z:-1},0,1);assert.equal(history.samples.length,1);
  history.update(.2,{x:200,z:0},0,1);assert.equal(history.samples.length,0);
  history.update(.3,{x:200,z:-1},0,1);assert.equal(history.samples.length,1);history.clear();assert.equal(history.samples.length,0);
});

test('upgraded hull sizes emit foam at their own stern without moving older foam',async()=>{
  const {createWakeHistory}=await import('./ocean.js');const history=createWakeHistory();
  history.update(0,{x:0,z:0},0,1);history.update(.1,{x:0,z:-1},0,1);
  const first={...history.samples[0]};history.update(.2,{x:0,z:-2},0,1,1.32);
  assert.deepEqual(history.samples[0],first);assert.equal(history.samples.at(-1).z,-2+6.75*1.32);assert.equal(history.samples.at(-1).hullScale,1.32);
});
test('wake mesh uses per-vertex opacity, soft edges and a fixed geometry budget',async()=>{
  const T=await import('./vendor/three.module.min.js'),{createShipWake}=await import('./ocean.js'),scene=new T.Scene();const wake=createShipWake(scene,new T.Texture());
  for(let i=0;i<=600;i++)wake.update(i/30,{x:Math.sin(i/100)*3,z:-i/30*3},.2,.8);
  const mesh=scene.children[0];assert.ok(wake.active);assert.ok(mesh.geometry.drawRange.count>0);assert.ok(mesh.geometry.drawRange.count<=160*6);
  assert.equal(mesh.material.depthWrite,false);assert.ok(mesh.material.transparent);
  for(const value of mesh.geometry.attributes.position.array)assert.ok(Number.isFinite(value));
  wake.update(40,{x:0,z:-60},0,0);assert.equal(mesh.geometry.drawRange.count,0);assert.equal(wake.active,false);
  wake.clear();assert.equal(mesh.geometry.drawRange.count,0);
});
