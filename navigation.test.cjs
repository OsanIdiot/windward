const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./engine.js'), N = E.N;
function run(s) { for(let i=0;s.navigation?.running&&i<10000;i++)s=E.advance(s,.5); return s; }
const chart = () => E.act(E.initial(), {type:'show-chart'});
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
  s=E.act(s,{type:'pause'});const paused={...s.position};
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
