const test = require('node:test');
const assert = require('node:assert/strict');

test('helm rays stop before coastlines and stay inside playable water',()=>{
  for(const p of E.PORTS) for(let heading=0;heading<360;heading+=30) {
    const end=N.headingTarget(p,heading);
    assert.ok(N.isSea(end));assert.ok(N.clear(p,end));
  }
  assert.throws(()=>N.headingTarget(E.initial().position,NaN));
  assert.throws(()=>N.headingTarget(E.initial().position,Infinity));
  assert.throws(()=>N.headingTarget(E.initial().position,90,-1));
});
test('helm steering preserves cargo, supports pause/reload, and can be changed mid-voyage',()=>{
  const start=chart();start.cargo.grain=10;
  const moving=E.act(start,{type:'steer',heading:270});
  assert.equal(start.port,'lume');assert.equal(moving.port,null);
  assert.equal(moving.navigation.mode,'manual');assert.equal(moving.cargo.grain,10);
  const atSea=E.advance(moving,.5),paused=E.act(atSea,{type:'pause'});
  const stopped=run(paused);
  assert.ok(N.distance(stopped.position,paused.position)>0);
  assert.deepEqual(E.advance(stopped,1).position,stopped.position);
  const resumed=E.act(E.migrate(JSON.parse(JSON.stringify(paused))),{type:'resume'});
  const turned=E.act(resumed,{type:'steer',heading:180});
  assert.deepEqual(turned.position,resumed.position);assert.ok(E.valid(turned));
  assert.equal(turned.cargo.grain,10);
  assert.throws(()=>E.act(E.initial(),{type:'steer',heading:270}),/항해도/);
});
test('helm controls work with limited gold and stop safely without overspending',()=>{
  for(const ship of [0,6]) for(const gold of [0,7,8,15]) {
    const s=chart();s.gold=gold;s.ship=ship;s.seaProgress=.9;
    const end=run(E.act(s,{type:'steer',heading:270}));
    assert.ok(end.gold>=0);assert.ok(N.isSea(end.position));assert.ok(E.valid(end));
  }
});
const E = require('./engine.js'), N = E.N;
function run(s) { for(let i=0;s.navigation?.running&&i<10000;i++)s=E.advance(s,.5); return s; }
const chart = () => E.act(E.initial(), {type:'show-chart'});
function openWater() {
  const state = chart();
  state.port = null; state.position = N.project(-12, 40); state.motion.heading = 180;
  return E.act(state, {type:'navigate',mode:'manual',point:N.project(-12,29)});
}
test('departure accelerates smoothly and pause/resume starts again from rest',()=>{
  let s=openWater(), previous={...s.position};const distances=[];
  for(let i=0;i<6;i++){s=E.advance(s,.5);distances.push(N.distance(previous,s.position));previous={...s.position};}
  assert.ok(distances[0]>0&&distances[0]<4);
  assert.ok(distances.every((d,i)=>i===0||d>=distances[i-1]));
  assert.ok(s.motion.speed>.95);
  const cruiseSpeed=s.motion.speed;
  s=E.act(s,{type:'pause'});assert.equal(s.motion.speed,cruiseSpeed);
  s=run(s);assert.equal(s.motion.speed,0);
  const resumed=E.advance(E.act(s,{type:'resume'}),.25);
  assert.ok(resumed.motion.speed>0&&resumed.motion.speed<.15);
  assert.ok(N.distance(resumed.position,s.position)<1);
});

test('wind keeps every ship within the halved maximum and preserves distance-based travel costs',()=>{
  for(let tier=0;tier<E.SHIPS.length;tier++) for(const mode of ['manual','auto']) {
    const s=openWater();s.ship=tier;s.motion.speed=1;s.navigation.mode=mode;
    const next=E.advance(s,1),distance=N.distance(s.position,next.position);
    const maximum=31.5*.5*E.SHIPS[tier].speed;
    assert.ok(distance<=maximum+1e-7&&distance>=maximum*.8,`${mode} tier ${tier+1} speed`);
    assert.ok(Math.abs(next.motion.speed-E.windAt(next).factor)<.01,'Cruise follows wind without changing the speed scale');
    const quote=E.passage(s,s.navigation.points),arrived=run(next);
    assert.equal(arrived.gold,s.gold-quote.cost);
    assert.equal(arrived.day,s.day+quote.days);
    assert.ok(E.valid(arrived));
  }
});
test('turning slows the ship without teleporting and straight sailing restores cruise',()=>{
  let s=openWater();for(let i=0;i<3;i++)s=E.advance(s,1);
  const before=JSON.parse(JSON.stringify(s));
  s=E.act(s,{type:'steer',heading:90});assert.deepEqual(s.position,before.position);
  assert.equal(s.motion.speed,before.motion.speed);
  s=E.advance(s,.5);assert.ok(s.motion.speed<.8);assert.equal(s.motion.turning,true);
  assert.ok(Math.abs(s.motion.heading-before.motion.heading)<=47.6);
  s=E.act(s,{type:'steer',heading:180});
  for(let i=0;i<3;i++)s=E.advance(s,1);
  assert.ok(s.motion.speed>.95);assert.equal(s.motion.turning,false);assert.ok(E.valid(s));
  const straight=E.act(s,{type:'steer',heading:180});
  assert.equal(straight.motion.speed,s.motion.speed,'Repeated straight commands retain momentum');
});
test('route corners brake in advance while retaining the safe waypoint path',()=>{
  let s=openWater();const corner=N.project(-12,36),end=N.project(-7.5,36);
  s.navigation.points=[corner,end];s.motion.speed=1;
  // Lower cruise speed shortens the approach-braking distance.
  while(N.distance(s.position,corner)>9)s=E.advance(s,.1);
  assert.equal(s.navigation.points.length,2);
  assert.ok(s.motion.speed<.9);assert.equal(s.motion.turning,true);
  const result=run(s);assert.ok(N.distance(result.position,end)<.01);
  assert.equal(result.motion.speed,0);assert.ok(E.valid(result));
});
test('acceleration is frame-rate independent and charges only actual distance',()=>{
  let coarse=openWater(),fine=openWater();
  for(let i=0;i<2;i++)coarse=E.advance(coarse,1);
  for(let i=0;i<120;i++)fine=E.advance(fine,1/60);
  assert.ok(N.distance(coarse.position,fine.position)<.02);
  assert.ok(Math.abs(coarse.motion.speed-fine.motion.speed)<1e-8);
  assert.equal(coarse.gold,fine.gold);assert.equal(coarse.day,fine.day);
  const full=run(coarse),q=E.passage(openWater(),[N.project(-12,29)]);
  assert.equal(full.gold,700-q.cost);assert.ok(E.valid(full));
});
test('legacy saves acquire motion safely; reload keeps heading but resets speed',()=>{
  const s=E.advance(openWater(),1),old=JSON.parse(JSON.stringify(s));delete old.motion;
  const legacy=E.migrate(old);assert.ok(legacy);assert.equal(legacy.motion.speed,0);
  assert.deepEqual(legacy.position,s.position);assert.deepEqual(legacy.cargo,s.cargo);
  const restored=E.migrate(s);assert.equal(restored.motion.heading,s.motion.heading);assert.equal(restored.motion.speed,0);
  for(const patch of [{speed:-1},{speed:NaN},{speed:2},{heading:Infinity},{heading:360},{turning:'yes'}]) {
    assert.equal(E.migrate({...s,motion:{...s.motion,...patch}}),null);
  }
});
function approach(s,id) {
  s=E.act(s,{type:'show-chart'});
  for(const point of N.route(s.position,E.portOf(id))) {
    if(N.distance(s.position,point)<1)continue;
    s=run(E.act(s,{type:'navigate',mode:'manual',point}));
  }
  return s;
}
function visit(s,id) {
  s=E.act(approach(s,id),{type:'enter-port'});
  assert.equal(s.port,id);return s;
}

function waitingAt(id='cedar',ship=0,mode='auto') {
  const s=chart();s.ship=ship;
  if(mode==='manual')return approach(s,id);
  s.visited.push(id);
  return run(E.act(s,{type:'navigate',mode:'auto',destination:id}));
}
function escapeFrom(s) {
  const port=E.nearbyPort(s);
  for(let heading=0;heading<360;heading+=15) {
    const point=N.headingTarget(s.position,heading,40);
    if(N.distance(s.position,point)>30&&N.distance(point,port)>30)return {heading,point};
  }
  throw Error('No open-water test heading');
}
test('arrived ships can leave every automatic destination without entering port',()=>{
  for(const port of E.PORTS.slice(1))for(const ship of [0,6]) {
    const waiting=waitingAt(port.id,ship),{heading,point}=escapeFrom(waiting);
    assert.equal(waiting.port,null);assert.equal(E.nearbyPort(waiting).id,port.id);
    for(const action of [{type:'steer',heading},{type:'navigate',mode:'manual',point}]) {
      const first=E.advance(E.act(waiting,action),.2);
      assert.ok(first.navigation?.running,`${port.id}, ship ${ship}: no repeated arrival stop`);
      assert.ok(first.motion.speed>0);
      const departed=run(first);
      assert.ok(N.distance(departed.position,port)>6);
      assert.equal(departed.port,null);assert.equal(departed.lastPort,waiting.lastPort);
      assert.equal(departed.voyages,waiting.voyages);assert.deepEqual(departed.visited,waiting.visited);
      assert.ok(E.valid(departed));
    }
  }
});
test('departure survives pause, reload and steering changes within the arrival radius',()=>{
  const waiting=waitingAt(),{heading,point}=escapeFrom(waiting);
  let s=E.advance(E.act(waiting,{type:'steer',heading}),.1);
  assert.ok(E.nearbyPort(s));
  s=E.act(s,{type:'pause'});
  s=E.act(E.migrate(JSON.parse(JSON.stringify(s))),{type:'resume'});
  s=E.advance(s,.1);assert.ok(s.navigation?.running);
  s=E.act(s,{type:'navigate',mode:'manual',point});
  assert.ok(E.advance(s,.1).navigation?.running);
  assert.ok(N.distance(run(s).position,E.portOf('cedar'))>6);
});
test('unvisited arrival can be bypassed and returning still stops for explicit port entry',()=>{
  const waiting=waitingAt('cedar',0,'manual'),{point}=escapeFrom(waiting);
  const away=run(E.act(waiting,{type:'navigate',mode:'manual',point}));
  assert.ok(N.distance(away.position,E.portOf('cedar'))>6);
  assert.equal(away.visited.includes('cedar'),false);
  const back=approach(away,'cedar');
  assert.equal(E.nearbyPort(back).id,'cedar');assert.equal(back.navigation,null);
  assert.equal(back.port,null);assert.equal(back.visited.includes('cedar'),false);
  assert.equal(E.act(back,{type:'enter-port'}).port,'cedar');
  const retry=run(E.act(back,{type:'navigate',mode:'manual',point:E.portOf('cedar')}));
  assert.equal(E.nearbyPort(retry).id,'cedar');assert.equal(retry.navigation,null);
});
test('real geography distinguishes Iberian land from open Atlantic water',()=>{
  assert.equal(N.isSea(N.project(-3.7,40.4)),false);
  assert.equal(N.isSea(N.project(-11,36)),true);
  for(const p of E.PORTS)assert.ok(N.isSea(p),p.name+' has a sea anchorage');
});
test('every port is reachable without crossing coastlines, including Gibraltar and the Italian peninsula',()=>{
  const start=E.initial().position;
  for(const port of E.PORTS.slice(1)) {
    const route=N.route(start,port);
    assert.ok(route.every((p,i)=>N.clear(i?route[i-1]:start,p)),port.name);
  }
  assert.equal(N.clear(E.portOf('lume'),E.portOf('azure')),false);
  assert.ok(N.route(E.portOf('azure'),E.portOf('haven')).length>2);
});
test('unknown names and automatic navigation stay locked until physical arrival',()=>{
  let s=chart();
  assert.equal(E.portLabel(s,'cedar'),'미확인 항구');
  assert.throws(()=>E.act(s,{type:'navigate',mode:'auto',destination:'cedar'}));
  assert.throws(()=>E.act(s,{type:'sail',destination:'cedar'}));
  s=visit(s,'cedar');
  assert.equal(E.portLabel(s,'cedar'),'카디스');assert.ok(E.valid(s));
  s=run(E.act(E.act(s,{type:'show-chart'}),{type:'navigate',mode:'auto',destination:'lume'}));
  assert.equal(s.port,null);assert.equal(E.nearbyPort(s).id,'lume');
  s=E.act(s,{type:'enter-port'});
  assert.equal(s.port,'lume');assert.equal(s.visited.length,2);
  assert.ok(E.act(E.act(s,{type:'show-chart'}),{type:'navigate',mode:'auto',destination:'cedar'}).navigation.running);
});
test('manual land targets and straight lines across land are rejected without state changes',()=>{
  const s=chart(),snapshot=JSON.stringify(s);
  assert.throws(()=>E.act(s,{type:'navigate',mode:'manual',point:N.project(-3.7,40.4)}));
  assert.throws(()=>E.act(s,{type:'navigate',mode:'manual',point:E.portOf('azure')}));
  assert.equal(JSON.stringify(s),snapshot);
});
test('movement is incremental; pause and steering use the actual current position',()=>{
  let s=chart();const target=N.project(-11,37);
  s=E.act(s,{type:'navigate',mode:'manual',point:target});
  assert.equal(s.port,null);const origin={...s.position};
  s=E.advance(s,.1);assert.ok(N.distance(s.position,origin)>0);assert.ok(N.distance(s.position,target)>0);
  s=run(E.act(s,{type:'pause'}));const paused={...s.position};
  assert.deepEqual(E.advance(s,1).position,paused);
  const steer=N.project(-12,37);
  s=E.act(s,{type:'navigate',mode:'manual',point:steer});assert.deepEqual(s.position,paused);
  s=run(s);assert.ok(N.distance(s.position,steer)<.01);assert.equal(s.port,null);assert.equal(s.visited.length,1);
});
test('mid-sea reload preserves location and route, but requires explicit resume',()=>{
  let s=E.act(chart(),{type:'navigate',mode:'manual',point:N.project(-11,37)});
  s=E.advance(s,.5);
  const restored=E.migrate(JSON.parse(JSON.stringify(s)));
  assert.ok(restored);assert.deepEqual(restored.position,s.position);assert.equal(restored.navigation.running,false);
  assert.ok(E.act(restored,{type:'resume'}).navigation.running);
  assert.throws(()=>E.act(restored,{type:'trade',side:'buy',good:'grain',qty:1}));
});
test('distance fractions survive multiple commands and do not make steering more expensive',()=>{
  const start=chart(),end=N.project(-11,37),mid={x:(start.position.x+end.x)/2,y:(start.position.y+end.y)/2};
  const one=run(E.act(start,{type:'navigate',mode:'manual',point:end}));
  let two=run(E.act(start,{type:'navigate',mode:'manual',point:mid}));
  two=run(E.act(two,{type:'navigate',mode:'manual',point:end}));
  assert.equal(two.gold,one.gold);assert.equal(two.day,one.day);assert.ok(Math.abs(two.seaProgress-one.seaProgress)<1e-8);
});
test('sea rescue works at zero gold without revealing other ports',()=>{
  let s=run(E.act(chart(),{type:'navigate',mode:'manual',point:N.project(-11,37)}));
  s.gold=0;s=E.act(s,{type:'rescue'});
  assert.equal(s.port,null);assert.equal(E.nearbyPort(s).id,'lume');
  s=E.act(s,{type:'enter-port'});
  assert.equal(s.port,'lume');assert.equal(s.gold,0);assert.deepEqual(s.visited,['lume']);assert.ok(E.valid(s));
});
test('malformed sea saves are rejected',()=>{
  const s=E.initial();
  assert.equal(E.migrate({...s,position:N.project(-3.7,40.4)}),null);
  assert.equal(E.migrate({...s,seaProgress:-.1}),null);
  assert.equal(E.migrate({...s,port:null,navigation:{mode:'auto',targetPort:'cedar',running:true,points:[E.portOf('cedar')]}}),null);
});
test('approaching a port does not reveal its name or grant services until explicit entry',()=>{
  const waiting=approach(chart(),'cedar');
  assert.equal(waiting.port,null);assert.equal(waiting.screen,'chart');
  assert.equal(waiting.voyages,0);assert.deepEqual(waiting.visited,['lume']);
  assert.equal(E.portLabel(waiting,'cedar'),'미확인 항구');
  assert.equal(E.nearbyPort(waiting).id,'cedar');
  for(const action of [
    {type:'trade',side:'buy',good:'grain',qty:1},
    {type:'upgrade'},{type:'explore',site:'grove'},{type:'accept',contract:'loom'}
  ]) assert.throws(()=>E.act(waiting,action),/입항/);
  const restored=E.migrate(JSON.parse(JSON.stringify(waiting)));
  assert.equal(restored.screen,'chart');assert.equal(restored.port,null);
  const entered=E.act(restored,{type:'enter-port'});
  assert.equal(entered.screen,'port');assert.equal(entered.port,'cedar');
  assert.equal(entered.voyages,1);assert.equal(E.portLabel(entered,'cedar'),'카디스');
  assert.equal(E.migrate(entered).screen,'port');assert.ok(E.valid(entered));
});
test('chart and port round trips are free and cannot duplicate voyage counts',()=>{
  const start=E.initial(),map=E.act(start,{type:'show-chart'});
  assert.equal(map.screen,'chart');
  assert.throws(()=>E.act(map,{type:'trade',side:'buy',good:'grain',qty:1}),/입항/);
  assert.throws(()=>E.act(start,{type:'navigate',mode:'manual',point:N.project(-11,37)}),/항해도/);
  assert.deepEqual(E.act(map,{type:'enter-port'}),start);
  assert.equal(E.migrate(map).screen,'chart');
  assert.equal(E.valid({...start,screen:'invalid'}),false);
  assert.equal(E.valid({...start,screen:'port',port:null}),false);
});
test('entry is rejected while sailing and far from any port',()=>{
  const moving=E.act(chart(),{type:'navigate',mode:'manual',point:N.project(-11,37)});
  assert.throws(()=>E.act(moving,{type:'enter-port'}),/정지/);
  const far=run(moving);
  assert.equal(E.nearbyPort(far),null);
  assert.throws(()=>E.act(far,{type:'enter-port'}),/가까이/);
});
test('version-three saves preserve progress and infer the correct screen',()=>{
  for(const state of [E.initial(),run(E.act(chart(),{type:'navigate',mode:'manual',point:N.project(-11,37)}))]) {
    const old={...state,version:3};delete old.screen;
    const restored=E.migrate(old);
    assert.equal(restored.version,4);
    assert.equal(restored.screen,state.port?'port':'chart');
    assert.deepEqual(restored.position,state.position);
    assert.equal(restored.gold,state.gold);assert.deepEqual(restored.visited,state.visited);
  }
});
