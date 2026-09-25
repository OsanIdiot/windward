(function (root) {
  'use strict';
  root.createSeaUI = function ({ read, navigate, toggle, notify }) {
    const E = root.Windward, N = E.N, G = N.G;
    const $ = id => document.getElementById(id), svg = $('sea-map');
    let follow = true, camera = { x: 45, y: 220, w: 430, h: 270 }, markerKey = '';
    let pointers = new Map(), gesture = null;
    const coords = p => { const c = N.unproject(p); return `${Math.abs(c.lat).toFixed(2)}° ${c.lat >= 0 ? 'N' : 'S'} · ${Math.abs(c.lon).toFixed(2)}° ${c.lon >= 0 ? 'E' : 'W'}`; };
    $('real-land').innerHTML = `<path d="${G.rings.map(r => 'M' + r.map(p => p.join(',')).join('L') + 'Z').join('')}" fill="#e5dec3" stroke="#91a68c" stroke-width=".7" vector-effect="non-scaling-stroke" fill-rule="evenodd"/>`;
    const labels = [[-4,40,'IBERIA'],[3,46,'FRANCE'],[12,43,'ITALIA'],[24,39,'AEGEAN SEA'],[19,34,'MARE MEDITERRANEUM'],[-10,33,'ATLANTIC'],[2,32,'NORTH AFRICA']];
    $('geographic-labels').innerHTML = labels.map(([lon,lat,label]) => { const p=N.project(lon,lat); return `<text x="${p.x}" y="${p.y}" text-anchor="middle" font-family="Georgia,serif" font-size="11" letter-spacing="2.5" fill="#799085" opacity=".8">${label}</text>`; }).join('');
    function clampCamera() {
      camera.x = Math.max(0, Math.min(G.width - camera.w, camera.x));
      camera.y = Math.max(0, Math.min(G.height - camera.h, camera.y));
      svg.setAttribute('viewBox', `${camera.x} ${camera.y} ${camera.w} ${camera.h}`);
    }
    function center(p = read().position) { follow = p === read().position; camera.x=p.x-camera.w/2; camera.y=p.y-camera.h/2; clampCamera(); render(); }
    function zoom(factor, point) {
      const anchor = point || { x: camera.x+camera.w/2, y: camera.y+camera.h/2 };
      const ratio = Math.min(G.width, Math.max(150,camera.w*factor))/camera.w;
      camera.x=anchor.x-(anchor.x-camera.x)*ratio; camera.y=anchor.y-(anchor.y-camera.y)*ratio;
      camera.w*=ratio; camera.h=Math.min(G.height,camera.h*ratio); clampCamera(); render();
    }
    function worldPoint(event) {
      const matrix=svg.getScreenCTM();
      if (!matrix) return null;
      const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
      return {x:p.x,y:p.y};
    }
    function portClick(id, fromList = false) {
      const state=read(), port=E.portOf(id);
      if (state.port===id || (E.nearbyPort(state)?.id===id && !state.navigation?.running)) { center(port); notify('항구 근처입니다. 입항 버튼으로 항구 화면에 들어갈 수 있습니다.'); return; }
      if (state.visited.includes(id)) { if(navigate({mode:'auto',destination:id})) follow=true; }
      else if(fromList) { follow=false; center(port); notify('미확인 항구입니다. 바다를 따라 직접 접근해 입항하세요.'); }
      else if(navigate({mode:'manual',point:{x:port.x,y:port.y}})) follow=true;
      render();
    }
    function render() {
      if ($('chart-screen').hidden) return;
      const state=read(), nav=state.navigation, here=E.portOf(state.port);
      const nearby=E.nearbyPort(state);
      const arrivalHTML=nearby&&!nav?.running
        ? `<div><p class="eyebrow">READY TO GO ASHORE</p><h3>${E.portLabel(state,nearby.id)} · 입항 가능</h3><p>입항하면 교역소와 항구의 여러 시설을 이용할 수 있습니다.</p></div><button class="primary" id="enter-port-button">입항 <span aria-hidden="true">→</span></button>`
        : `<div><p class="eyebrow">ON THE OPEN SEA</p><p>항구 가까이 접근한 뒤 입항 버튼을 눌러 주세요.</p></div>${!here?'<button class="secondary rescue-button" id="rescue-button"><span>귀환 지원</span><small>3일 / 최대 40 G</small></button>':''}`;
      if($('arrival-panel').innerHTML!==arrivalHTML)$('arrival-panel').innerHTML=arrivalHTML;
      const key=state.visited.join(',')+'|'+state.port+'|'+(nav?.targetPort||'');
      if(key!==markerKey) {
        markerKey=key;
        $('map-markers').innerHTML=E.PORTS.map(p=>{const known=state.visited.includes(p.id),name=E.portLabel(state,p.id);return `<g class="marker" data-port="${p.id}" transform="translate(${p.x} ${p.y})"><title>${name}</title><g class="marker-pixel"><circle r="17" fill="transparent"/><circle r="6" fill="${known?'#346f60':'#f1e8cc'}" stroke="${known?'#315e4d':'#9c825d'}" stroke-width="1.5"/><text text-anchor="middle" y="3.5" class="port-question">${known?'':'?'}</text><text class="port-caption" text-anchor="middle" y="-15">${name}</text></g></g>`;}).join('');
        $('port-selector').innerHTML=E.PORTS.map((p,i)=>`<button class="port-chip ${p.id===state.port?'current':''}" data-chart-port="${p.id}" aria-label="${E.portLabel(state,p.id)}${state.visited.includes(p.id)?' 자동항해':' 위치 보기'}">${E.portLabel(state,p.id)}<small>${p.id===state.port?'정박 중':state.visited.includes(p.id)?'자동항해 가능':`표식 ${i+1} 보기`}</small></button>`).join('');
      }
      if(follow && nav?.running && (state.position.x<camera.x+camera.w*.12 || state.position.x>camera.x+camera.w*.88 || state.position.y<camera.y+camera.h*.12 || state.position.y>camera.y+camera.h*.88)) {
        camera.x=state.position.x-camera.w/2; camera.y=state.position.y-camera.h/2; clampCamera();
      }
      const matrix=svg.getScreenCTM(), pixel=matrix?.a>0?1/matrix.a:camera.w/700;
      document.querySelectorAll('.marker-pixel').forEach(g=>g.setAttribute('transform',`scale(${pixel})`));
      $('map-ship').setAttribute('transform',`translate(${state.position.x} ${state.position.y}) scale(${pixel})`);
      const points=nav?.points || [];
      $('route-line').setAttribute('d', points.length?`M${state.position.x} ${state.position.y} `+points.map(p=>`L${p.x} ${p.y}`).join(' '):'');
      $('target-ring').setAttribute('visibility',points.length?'visible':'hidden'); $('target-ring').removeAttribute('hidden');
      if(points.length) { const p=points.at(-1);$('target-ring').setAttribute('cx',p.x);$('target-ring').setAttribute('cy',p.y);$('target-ring').setAttribute('r',5*pixel); }
      $('current-label').textContent=here?`${here.name} 정박 중`:nav?.running?'항해 중':nearby?'항구 앞 · 입항 대기':'해상 정지';
      $('coordinates').textContent=coords(state.position);
      $('navigation-status').textContent=nav?`${nav.mode==='auto'?'자동':'수동'}항해 · ${state.motion?.braking?'감속 중':nav.running?'이동 중':'정지됨'}`:here?'바다를 클릭해 출항하세요':'다음 바다 지점을 선택하세요';
      $('pause-sailing').disabled=!nav; $('pause-sailing').textContent=nav&&(!nav.running||nav.stopping)?'계속':'정지';
      if(nav) {
        const q=E.passage(state,points);
        $('route-panel').innerHTML=`<div><h3>${nav.mode==='auto'?E.portLabel(state,nav.targetPort)+' 자동항해':'나의 수동항로'}</h3><p>남은 항로 약 ${Math.ceil(q.distance)} 해도 단위 · 추가 ${q.days}일 / ${q.cost} G<br>${state.discoveries.includes('tide')?'해류 지도 적용 · ':''}새 바다 지점을 누르면 현재 위치에서 방향을 바꿉니다.</p></div>`;
      } else $('route-panel').innerHTML=`<div><h3>${here?here.name+'에서 새로운 바다로':'지정한 바다에 도착했습니다'}</h3><p>바다를 누르면 그 지점으로 수동항해하고, 방문한 항구를 누르면 자동항해합니다. 미확인 항구는 직접 접근해 입항하세요.</p></div>`;
    }
    svg.addEventListener('pointerdown',event=>{
      if(event.button!==0) return;
      pointers.set(event.pointerId,{x:event.clientX,y:event.clientY}); svg.setPointerCapture(event.pointerId);
      if(pointers.size===1) gesture={x:event.clientX,y:event.clientY,camera:{...camera},drag:false,port:event.target.closest('[data-port]')?.dataset.port};
      else { const [a,b]=[...pointers.values()];gesture={pinch:true,distance:Math.hypot(a.x-b.x,a.y-b.y),drag:true}; }
    });
    svg.addEventListener('pointermove',event=>{
      if(!pointers.has(event.pointerId)||!gesture) return;
      pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
      if(pointers.size===2) { const [a,b]=[...pointers.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(gesture.distance>0&&d>0)zoom(gesture.distance/d);gesture.distance=d;gesture.pinch=true;follow=false;return; }
      if(gesture.pinch) return;
      const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
      if(Math.hypot(dx,dy)>5) gesture.drag=true;
      if(gesture.drag) { follow=false;const factor=1/svg.getScreenCTM().a;camera.x=gesture.camera.x-dx*factor;camera.y=gesture.camera.y-dy*factor;clampCamera();render(); }
    });
    function endPointer(event,cancelled) {
      const tap=gesture&&!gesture.drag&&!gesture.pinch&&!cancelled;
      const port=gesture?.port;
      pointers.delete(event.pointerId);
      if(svg.hasPointerCapture(event.pointerId))svg.releasePointerCapture(event.pointerId);
      if(tap) {
        if(port)portClick(port);
        else { const p=worldPoint(event);if(p&&navigate({mode:'manual',point:p}))follow=true; }
      }
      if(!pointers.size)gesture=null;
    }
    svg.addEventListener('pointerup',event=>endPointer(event,false));
    svg.addEventListener('pointercancel',event=>endPointer(event,true));
    svg.addEventListener('wheel',event=>{event.preventDefault();follow=false;zoom(event.deltaY>0?1.15:1/1.15,worldPoint(event));},{passive:false});
    $('port-selector').addEventListener('click',event=>{const b=event.target.closest('[data-chart-port]');if(b)portClick(b.dataset.chartPort,true);});
    $('zoom-in').addEventListener('click',()=>zoom(1/1.3));$('zoom-out').addEventListener('click',()=>zoom(1.3));
    $('chart-home').addEventListener('click',()=>{follow=true;center();});
    $('chart-world').addEventListener('click',()=>{follow=false;camera={x:0,y:0,w:G.width,h:G.height};clampCamera();render();});
    $('pause-sailing').addEventListener('click',()=>toggle(read().navigation?.running&&!read().navigation.stopping?'pause':'resume'));
    window.addEventListener('resize',render);
    clampCamera(); center();
    return { render, reset:()=>{follow=true;center();} };
  };
})(window);
