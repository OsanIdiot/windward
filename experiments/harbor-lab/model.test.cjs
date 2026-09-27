const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const M=require('./model.js'),E=M.E;
test('lab starts with a valid independent sailing state at the real Lisbon coast',()=>{
  const s=M.initial();assert.ok(E.valid(s));assert.ok(E.N.isSea(s.position));assert.ok(M.within(s.position));assert.equal(s.port,null);assert.equal(s.screen,'chart');assert.deepEqual(s.visited,['lume']);assert.equal(s.gold,700);
  s.gold=0;assert.equal(M.initial().gold,700);
});
test('renderer coordinates round trip without changing geographic navigation',()=>{
  for(const p of [M.port,M.initial().position,{x:100,y:350}]){const q=M.world(M.local(p));assert.ok(Math.abs(q.x-p.x)<1e-9&&Math.abs(q.y-p.y)<1e-9);}
});
test('manual navigation rejects land, blocked routes and out-of-region destinations',()=>{
  const s=M.initial(),before=JSON.stringify(s);let land=null,blocked=null;
  for(let x=-40;x<40;x+=2)for(let y=-40;y<40;y+=2){const p={x:M.port.x+x,y:M.port.y+y};if(!M.within(p))continue;if(!E.N.isSea(p))land=p;else if(!E.N.clear(s.position,p))blocked=p;}
  assert.ok(land&&blocked);assert.throws(()=>M.move(s,land),/바다/);assert.throws(()=>M.move(s,blocked),/육지/);
  assert.throws(()=>M.move(s,{x:M.port.x+60,y:M.port.y}),/시험 해역/);assert.equal(JSON.stringify(s),before);
});
test('all headings either create a safe bounded route or reject the direction',()=>{
  for(let h=0;h<360;h+=10){const s=M.initial();try{const next=M.steer(s,h);const p=next.navigation.points.at(-1);assert.ok(M.within(p));assert.ok(E.N.clear(s.position,p));}catch(error){assert.match(error.message,/해안|시험 해역/);}}
});
test('sailing, natural stopping and restarting reuse the stable engine with reduced demo time',()=>{
  let s=M.steer(M.initial(),270);const start={...s.position};
  for(let i=0;i<500;i++)s=E.advance(s,.016*M.SIMULATION_RATE);
  assert.ok(E.N.distance(start,s.position)>1);const speed=s.motion.speed;assert.ok(speed>0);
  s=E.act(s,{type:'pause'});assert.ok(s.navigation.running);assert.equal(s.motion.speed,speed);
  for(let i=0;i<2000&&s.navigation.running;i++)s=E.advance(s,.016*M.SIMULATION_RATE);
  assert.equal(s.motion.speed,0);assert.ok(M.within(s.position));assert.ok(E.valid(s));s=E.act(s,{type:'resume'});assert.ok(s.navigation.running);
});
test('the prototype contains no save access and is not referenced by the production entry',()=>{
  for(const name of ['lab.js','model.js','world.js','ocean.js'])assert.doesNotMatch(fs.readFileSync(path.join(__dirname,name),'utf8'),/localStorage|sessionStorage|indexedDB|document\.cookie/);
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8'),/harbor-lab/);
  assert.match(fs.readFileSync(path.join(__dirname,'../../.github/workflows/pages.yml'),'utf8'),/node experiments\/harbor-lab\/package\.cjs/);
  assert.match(fs.readFileSync(path.join(__dirname,'vendor/LICENSE-three.txt'),'utf8'),/MIT License/);
});
