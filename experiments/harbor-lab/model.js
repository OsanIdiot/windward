(function(root) {
  'use strict';
  const E = root.Windward || require('../../engine.js'), port = E.portOf('lume');
  const SCALE = 4, RADIUS = 52, SIMULATION_RATE = .15;
  const local = p => ({x:(p.x-port.x)*SCALE,z:(p.y-port.y)*SCALE});
  const world = p => ({x:p.x/SCALE+port.x,y:p.z/SCALE+port.y});
  const within = p => Math.hypot(p.x-port.x,p.y-port.y) <= RADIUS;
  function initial() {
    const state = E.act(E.initial(),{type:'show-chart'});
    state.port = null; state.position = {x:port.x-4.5,y:port.y+5.5}; state.motion.heading=0;
    return state;
  }
  function move(state, point) {
    if (!within(point)) throw Error('리스본 시험 해역 안의 바다를 눌러주세요.');
    return E.act(state,{type:'navigate',mode:'manual',point});
  }
  function steer(state, heading) {
    const radians = heading*Math.PI/180;
    for (let length = 16; length >= 1; length -= 1) {
      const p = {x:state.position.x+Math.sin(radians)*length,y:state.position.y-Math.cos(radians)*length};
      if (within(p) && E.N.clear(state.position,p)) return move(state,p);
    }
    throw Error('이 방향은 해안이나 시험 해역의 끝입니다. 다른 방향을 선택하세요.');
  }
  const api = {E,port,SCALE,RADIUS,SIMULATION_RATE,local,world,within,initial,move,steer};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.HarborModel=api;
})(typeof window !== 'undefined' ? window : globalThis);
