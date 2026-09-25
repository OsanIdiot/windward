(function (root) {
  'use strict';
  root.createVoyageUI = function ({ read, steer, navigate, toggle, notify }) {
    const E = root.Windward, N = E.N, C = root.VoyageCamera, $ = id => document.getElementById(id);
    const canvas = $('voyage-canvas'), ctx = canvas.getContext('2d');
    const art = root.createVoyageArt(ctx);
    const caption = canvas.parentElement.querySelector('.voyage-caption');
    const mini = $('voyage-minimap'), mc = mini.getContext('2d');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const compact = matchMedia('(max-width: 740px)');
    const land = new Path2D(N.G.rings.map(r => 'M' + r.map(p => p.join(',')).join('L') + 'Z').join(''));
    const seaMask = new Path2D(); seaMask.rect(0, 0, N.G.width, N.G.height); seaMask.addPath(land);
    // Bake static coast color and terrain once rather than retracing details per frame.
    const scenery = document.createElement('canvas'), sc = scenery.getContext('2d');
    const terrainRatio = 1.5;
    scenery.width = Math.ceil(N.G.width * terrainRatio); scenery.height = Math.ceil(N.G.height * terrainRatio);
    sc.scale(terrainRatio, terrainRatio); sc.lineJoin = 'round';
    for (const [size, color] of [[29, '#40bdb018'], [23, '#40bdb028'], [17, '#63d3b647'], [11, '#86dcc177'], [6, '#b4dec29c'], [2, '#eed7a2']]) {
      sc.lineWidth = size; sc.strokeStyle = color; sc.stroke(land);
    }
    sc.fillStyle = '#a5b68b'; sc.fill(land, 'evenodd');
    const noise = (x, y) => { const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return n - Math.floor(n); };
    sc.save(); sc.clip(land, 'evenodd');
    sc.lineWidth = 7; sc.strokeStyle = '#ecd6a2'; sc.stroke(land);
    sc.lineWidth = 2.5; sc.strokeStyle = '#fff0c980'; sc.stroke(land);
    for (let y = 0; y < N.G.height; y += 12) for (let x = 0; x < N.G.width; x += 15) {
      const n = noise(x, y), px = x + n * 14, py = y + noise(y, x) * 10;
      sc.fillStyle = n > .5 ? '#526f5840' : '#e9d7a64a';
      sc.beginPath(); sc.ellipse(px, py, 5 + n * 9, 3 + n * 3, -.35, 0, Math.PI * 2); sc.fill();
      if (n > .55) {
        sc.fillStyle = '#3e654a55';
        for(let j=0;j<4;j++){sc.beginPath();sc.ellipse(px+j*.9,py+Math.sin(j)*1.2,.6+n*.6,.45+n*.4,0,0,Math.PI*2);sc.fill();}
      }
    }
    sc.restore(); sc.lineWidth = .65; sc.strokeStyle = '#758e7566'; sc.stroke(land);
    const lisbon = E.portOf('lume');
    const town = [];
    let shore = null;
    for (let radius = 2; radius <= 35 && !shore; radius += 2) {
      for (let i = 0; i < 48; i++) {
        const a = i * Math.PI / 24, p = { x: lisbon.x + Math.cos(a) * radius, y: lisbon.y + Math.sin(a) * radius };
        if (!N.isSea(p)) { shore = p; break; }
      }
    }
    if (shore) {
      const length = N.distance(shore, lisbon), nx = (shore.x-lisbon.x)/length, ny = (shore.y-lisbon.y)/length;
      for (let row = 0; row < 5; row++) for (let col = -4; col <= 4; col++) {
        const p = { x: shore.x + nx*(3+row*3.8) - ny*col*3.8, y: shore.y + ny*(3+row*3.8) + nx*col*3.8 };
        if (noise(row, col) < .22 || N.isSea(p)) continue;
        town.push({ ...p, row });
      }
      // Decorative quay, aligned from the land toward the existing anchorage.
      sc.strokeStyle='#a99871';sc.lineWidth=2.4;sc.beginPath();sc.moveTo(shore.x,shore.y);sc.lineTo(lisbon.x,lisbon.y);sc.stroke();
      sc.strokeStyle='#eee1b5';sc.lineWidth=.5;sc.stroke();
      for(let i=2;i<length;i+=2){const x=shore.x-nx*i,y=shore.y-ny*i;sc.strokeStyle='#7a795b';sc.beginPath();sc.moveTo(x-ny*1.5,y+nx*1.5);sc.lineTo(x+ny*1.5,y-nx*1.5);sc.stroke();}
    }
    let width = 0, height = 0, scale = 1, cx = 0, cy = 0, heading = 225, lastStamp = 0, portKey = '';
    let trail = [], previous = null, press = null, lastHUD = 0, bank = 0, animationTime = 0;
    let captionRight = 0, captionBottom = 0;
    let headingUp = true;
    try { headingUp = localStorage.getItem('windward-camera') !== 'north'; } catch (_) {}
    const cameraBearing = () => headingUp ? heading : 0;
    const cameraView = () => ({ x: cx, y: cy, zoom: scale, bearing: cameraBearing() });
    const text = (id, value) => { if ($(id).textContent !== value) $(id).textContent = value; };
    function resize() {
      const rect = canvas.getBoundingClientRect(), ratio = Math.min(2, devicePixelRatio || 1);
      width = rect.width; height = rect.height;
      if (!width || !height) return;
      if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
        canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      scale = Math.min(width, height) / 145;
      cx = width * .5; cy = height * .58;
      captionRight = caption.offsetLeft + caption.offsetWidth;
      captionBottom = caption.offsetTop + caption.offsetHeight;
    }
    function worldTransform(context, position, x = cx, y = cy, zoom = scale, bearing = cameraBearing()) {
      C.transform(context, position, { x, y, zoom, bearing });
    }
    function water(bounds, time, wind) {
      art.water(bounds, time, wind, compact.matches);
    }
    function harbor(state) {
      if (!shore || N.distance(state.position, lisbon) > 210) return;
      ctx.save(); ctx.clip(land, 'evenodd');
      for(const p of town){
        const height=2.4+(p.row%3)*.7;
        ctx.fillStyle='#4b625444';ctx.fillRect(p.x-.5,p.y-.8,3.5,3.8);
        ctx.fillStyle='#ede1bd';ctx.fillRect(p.x-1.2,p.y-height,2.8,height+1.5);
        ctx.fillStyle='#b3a57f';ctx.fillRect(p.x+1,p.y-height,.6,height+1.5);
        ctx.fillStyle=p.row%2?'#a77552':'#b98058';
        ctx.beginPath();ctx.moveTo(p.x-1.7,p.y-height);ctx.lineTo(p.x,p.y-height-1);ctx.lineTo(p.x+2,p.y-height);ctx.closePath();ctx.fill();
        ctx.fillStyle='#647265';ctx.fillRect(p.x-.6,p.y-.3,.6,1.1);
        ctx.fillStyle='#d7c592';ctx.fillRect(p.x+.3,p.y-height+.5,.5,.6);
      }
      ctx.restore();
    }
    function wake(stamp) {
      for(let i=1;i<trail.length;i++){
        const a=trail[i-1],b=trail[i],age=Math.max(0,(stamp-b.at)/1000),fade=Math.max(0,1-age/8);
        const strength=Math.min(a.speed,b.speed)*fade;
        if(strength<.015)continue;
        const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
        if(length<.01||length>20)continue;
        const w=(.9+age*.7),px=-dy/length*w,py=dx/length*w;
        ctx.fillStyle=`rgba(140,229,215,${strength*.26})`;
        ctx.beginPath();ctx.moveTo(a.x+px,a.y+py);ctx.lineTo(b.x+px,b.y+py);ctx.lineTo(b.x-px,b.y-py);ctx.lineTo(a.x-px,a.y-py);ctx.closePath();ctx.fill();
        if(i%2===0){ctx.strokeStyle=`rgba(231,253,236,${strength*.48})`;ctx.lineWidth=.45;ctx.beginPath();ctx.moveTo(b.x-px*.8,b.y-py*.8);ctx.quadraticCurveTo(b.x-dx*.5,b.y-dy*.5,b.x+px*.8,b.y+py*.8);ctx.stroke();}
      }
    }
    function ship(time, moving, tier, speed, wind) {
      art.ship({ x: cx, y: cy, width, height, bearing: heading - cameraBearing(), time, moving, tier, speed, wind, bank, compact: width < 500, reduced: reduced.matches });
    }
    function renderMini(state) {
      mc.clearRect(0,0,150,110);mc.fillStyle='#adc9bd';mc.fillRect(0,0,150,110);
      mc.save();worldTransform(mc,state.position,75,55,.5,0);mc.fillStyle='#e2dcc0';mc.fill(land,'evenodd');mc.restore();
      for(const p of E.PORTS){const x=75+(p.x-state.position.x)*.5,y=55+(p.y-state.position.y)*.5;
        if(x<4||x>146||y<4||y>106)continue;
        mc.fillStyle=state.visited.includes(p.id)?'#386957':'#a68453';mc.beginPath();mc.arc(x,y,2,0,Math.PI*2);mc.fill();}
      mc.save();mc.translate(75,55);mc.rotate(heading*Math.PI/180);mc.fillStyle='#a45c42';mc.beginPath();mc.moveTo(0,-6);mc.lineTo(4,5);mc.lineTo(0,3);mc.lineTo(-4,5);mc.closePath();mc.fill();mc.restore();
      mc.fillStyle='#385d51';mc.font='10px Georgia';mc.fillText('N',7,13);
    }
    function renderPorts(state) {
      const visible=E.PORTS.map(p=>({p,...C.project(p,state.position,cameraView())})).filter(v=>v.x>50&&v.x<width-50&&v.y>115&&v.y<height-110)
        .filter(v=>!(v.x<captionRight+40&&v.y<captionBottom+65))
        .filter(v=>!(v.x>width-135&&v.y<205));
      const key=visible.map(v=>v.p.id+state.visited.includes(v.p.id)).join(',');
      if(key!==portKey){
        portKey=key;
        $('voyage-ports').innerHTML=visible.map(({p})=>`<button class="voyage-port" data-voyage-port="${p.id}" aria-label="${E.portLabel(state,p.id)} 접근"><svg class="icon" aria-hidden="true"><use href="#i-anchor"/></svg>${E.portLabel(state,p.id)}</button>`).join('');
      }
      for(const {p,x,y} of visible){const b=$('voyage-ports').querySelector(`[data-voyage-port="${p.id}"]`);b.style.left=x+'px';b.style.top=(y-38)+'px';}
      return visible;
    }
    function renderHUD(state, visible, wind) {
      const nav=state.navigation, near=E.nearbyPort(state), coordinate=N.unproject(state.position);
      const degree=(Math.round(heading)%360+360)%360;
      const directions=['북','북동','동','남동','남','남서','서','북서'];
      const windName=directions[Math.round(wind.from/45)%8];
      text('voyage-wind-label',`${windName}풍 · ${Math.round(wind.knots)} kn`);
      text('voyage-wind-effect',`${wind.kind} · 순항 목표 ${Math.round(wind.factor*100)}%`);
      $('voyage-wind').setAttribute('aria-label',`${windName}쪽에서 불어오는 바람, 풍속 ${Math.round(wind.knots)}노트. ${wind.kind}, 순항 목표 ${Math.round(wind.factor*100)}퍼센트. 화살표는 바람이 흐르는 방향입니다.`);
      text('voyage-bearing',`${directions[Math.round(degree/45)%8]} · ${degree}°`);
      text('voyage-position',`${Math.abs(coordinate.lat).toFixed(2)}° N · ${Math.abs(coordinate.lon).toFixed(2)}° ${coordinate.lon>=0?'E':'W'}`);
      text('voyage-motion',nav?.stopping?'돛을 내리고 감속 중':nav?.running?(nav.mode==='auto'?'자동항해 중':'직접 조타 · 항해 중'):nav?'돛을 내리고 정지 중':near?'항구 앞바다':'잔잔한 바다 · 정지');
      const speed = nav?.running ? state.motion?.speed ?? 1 : 0;
      text('voyage-speed',`${E.SHIPS[state.ship].name} · ${Math.round(speed*100)}% · ${speed===0?'정지':state.motion?.braking?'감속 중':state.motion?.turning?'선회 중':speed<wind.factor-.03?'가속 중':speed>wind.factor+.03?'바람에 맞춰 감속':'순항'}`);
      text('voyage-mood',near?`${E.portLabel(state,near.id)} 앞바다`:visible.length?'수평선 너머, 항구의 모습':'바람을 따라, 더 먼 바다로');
      text('voyage-status',nav?.stopping?'서서히 속도를 줄이고 있습니다. 계속을 누르거나 바다를 눌러 다시 출발하세요.':nav?.running?(nav.mode==='auto'?`${E.portLabel(state,nav.targetPort)}(으)로 향하고 있습니다.`:'바다를 다시 누르면 방향을 바꿉니다.'):nav?'정지했습니다. 계속 버튼으로 같은 항로를 이어갑니다.':near?'가까운 항구로 입항하거나 바다를 눌러 출항하세요.':'바다를 눌러 방향을 정하세요. 해안·해역 경계·예산 한계에서는 정지합니다.');
      $('voyage-pause').disabled=!nav;text('voyage-pause',nav&&(!nav.running||nav.stopping)?'계속':'정지');
      const html=near&&!nav?.running?`<div><p class="eyebrow">READY TO GO ASHORE</p><h3>${E.portLabel(state,near.id)} · 입항 가능</h3><p>처음 입항하면 항구 이름과 자동항해가 열립니다.</p></div><button class="primary" id="voyage-enter-port">입항 →</button>`:`<div><p class="eyebrow">THE OPEN WATER</p><p>미확인 항구는 가까이 접근한 뒤 입항하세요.</p></div>${!state.port?'<button class="secondary rescue-button" id="voyage-rescue"><span>귀환 지원</span><small>3일 / 최대 40 G</small></button>':''}`;
      if($('voyage-arrival').innerHTML!==html)$('voyage-arrival').innerHTML=html;
    }
    function render(stamp = performance.now()) {
      if($('voyage-screen').hidden||document.hidden){lastStamp=0;return;}
      resize();if(!width||!height)return;
      const state=read(), moving=!!state.navigation?.running, dt=lastStamp?Math.max(0,Math.min(.1,(stamp-lastStamp)/1000)):0;
      lastStamp=stamp;
      const target=state.navigation?.points[0], oldHeading=heading;
      if(state.motion) heading=state.motion.heading;
      else if(target){const wanted=(Math.atan2(target.x-state.position.x,state.position.y-target.y)*180/Math.PI+360)%360;const difference=(wanted-heading+540)%360-180;heading=(heading+difference*Math.min(1,dt*8)+360)%360;}
      const turn=dt>0?Math.max(-1,Math.min(1,((heading-oldHeading+540)%360-180)/(dt*95))):0;
      bank += (turn-bank)*Math.min(1,dt*4);
      const wind=E.windAt(state,heading);
      $('voyage-wind-arrow').style.transform=`rotate(${wind.from+180-cameraBearing()}deg)`;
      // The compass points to world north, not the ship's bow. No CSS interpolation across 0/360.
      $('voyage-needle').style.transform=`rotate(${-cameraBearing()}deg)`;
      $('voyage-north').style.transform=`translate(-50%,-50%) rotate(${-cameraBearing()}deg) translateY(var(--north-offset)) rotate(${cameraBearing()}deg)`;
      $('voyage-stage').dataset.camera = headingUp ? 'heading' : 'north';
      if(previous&&N.distance(previous,state.position)>35)trail=[];
      if(moving&&(!previous||N.distance(previous,state.position)>.8)){
        const stern=58*art.shipScale(width,height,cx,cy,heading-cameraBearing(),state.ship,width<500)/scale,angle=heading*Math.PI/180;
        trail.push({x:state.position.x-Math.sin(angle)*stern,y:state.position.y+Math.cos(angle)*stern,at:stamp,speed:state.motion?.speed??0});previous={...state.position};
      }
      trail=trail.filter(p=>stamp-p.at<8000).slice(-140);
      // Integrate phase so changing wind cannot amplify hours of elapsed page time.
      if (!reduced.matches) animationTime += dt * (.45 + wind.strength * .75);
      const time=reduced.matches?0:animationTime;
      const gradient=ctx.createLinearGradient(0,0,width*.6,height);gradient.addColorStop(0,'#175571');gradient.addColorStop(.45,'#287f91');gradient.addColorStop(.72,'#248b94');gradient.addColorStop(1,'#164d70');ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
      const light=ctx.createRadialGradient(width*.22,height*.16,0,width*.22,height*.16,width*.8);
      light.addColorStop(0,'#c4efcd35');light.addColorStop(1,'#b7d9bc00');ctx.fillStyle=light;ctx.fillRect(0,0,width,height);
      ctx.save();worldTransform(ctx,state.position);
      ctx.lineWidth=.45;ctx.strokeStyle='#eef5d83b';
      const {left,top,right,bottom}=C.bounds(state.position,cameraView(),width,height);
      water({left,top,right,bottom},time,wind);
      ctx.fillStyle='#dcd8b8';ctx.fill(land,'evenodd');
      ctx.drawImage(scenery,0,0,N.G.width,N.G.height);
      harbor(state);
      art.shadows({left,top,right,bottom},time);
      ctx.save();ctx.clip(seaMask,'evenodd');wake(stamp);ctx.restore();
      ctx.restore();
      const visible=renderPorts(state);
      for(const {x,y} of visible){ctx.save();ctx.translate(x,y);ctx.fillStyle='#f4eacf';ctx.strokeStyle='#83765b';ctx.lineWidth=1;ctx.fillRect(-5,-18,10,21);ctx.strokeRect(-5,-18,10,21);ctx.fillStyle='#b07a55';ctx.beginPath();ctx.moveTo(-8,-18);ctx.lineTo(0,-28);ctx.lineTo(8,-18);ctx.fill();ctx.fillStyle='#efdb98';ctx.fillRect(-2,-14,4,6);ctx.restore();}
      for (const site of E.seaSightings(state)) {
        const { x, y } = C.project(site, state.position, cameraView());
        if (x < 22 || x > width - 22 || y < 100 || y > height - 75) continue;
        if (x < captionRight + 25 && y < captionBottom + 40) continue;
        const found = state.seaDiscoveries.includes(site.id), known = state.seaClues.includes(site.id);
        ctx.save(); ctx.translate(x, y);
        ctx.strokeStyle = '#e2eee0aa'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(0, 6, 23, 7, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = '#c8dbca'; ctx.fillStyle = '#c7b58a'; ctx.lineWidth = 2;
        if (site.id === 'seabirds') {
          for (const [bx, by] of [[-14, -4], [2, -13], [15, 0]]) {
            const wing = 4 + Math.sin(time * 2 + bx) * 1.5;
            ctx.beginPath(); ctx.moveTo(bx - 6, by - wing); ctx.quadraticCurveTo(bx - 2, by - wing, bx, by); ctx.quadraticCurveTo(bx + 2, by - wing, bx + 6, by - wing); ctx.stroke();
          }
        } else if (site.id === 'wreck') {
          ctx.fillStyle = '#8a6c4c'; ctx.fillRect(-17, 1, 34, 5);
          ctx.beginPath(); ctx.moveTo(-6, 4); ctx.lineTo(3, -22); ctx.stroke();
          ctx.fillStyle = '#e8ddbf'; ctx.beginPath(); ctx.moveTo(3, -22); ctx.lineTo(15, -11); ctx.lineTo(0, -7); ctx.fill();
        } else if (site.id === 'shoal') {
          ctx.fillStyle = '#7c9783'; ctx.beginPath(); ctx.moveTo(-20, 5); ctx.lineTo(-9, -8); ctx.lineTo(0, 2); ctx.lineTo(9, -14); ctx.lineTo(20, 5); ctx.closePath(); ctx.fill();
        } else if (site.id === 'dolphins') {
          ctx.beginPath(); ctx.moveTo(-20, 1); ctx.quadraticCurveTo(-4, -19, 10, -4); ctx.lineTo(15, 3); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-6, -8); ctx.lineTo(0, -19); ctx.lineTo(3, -7); ctx.stroke();
        } else {
          ctx.fillRect(-11, -10, 22, 17); ctx.strokeRect(-11, -10, 22, 17);
          ctx.beginPath(); ctx.moveTo(-11, -10); ctx.lineTo(11, 7); ctx.moveTo(11, -10); ctx.lineTo(-11, 7); ctx.stroke();
        }
        ctx.translate(23, -17);
        ctx.fillStyle = '#f3eddce8'; ctx.strokeStyle = found ? '#376c60' : '#9b7051'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#355d53'; ctx.textAlign = 'center'; ctx.font = '15px Georgia';
        ctx.fillText(found ? '+' : '?', 0, 5);
        ctx.font = `${compact.matches ? 9 : 10}px Georgia`;
        const caption = found ? site.name : known ? '해상 단서' : '수평선의 흔적';
        ctx.strokeStyle = '#28545dcc'; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeText(caption, -23, -18);
        ctx.fillStyle = '#f2eedb'; ctx.fillText(caption, -23, -18);
        ctx.restore();
      }
      ship(time,moving,state.ship,state.motion?.speed??1,wind);
      if(stamp-lastHUD>100||!dt){renderHUD(state,visible,wind);renderMini(state);lastHUD=stamp;}
    }
    canvas.addEventListener('pointerdown',event=>{if(event.button===0)press={id:event.pointerId,x:event.clientX,y:event.clientY};});
    canvas.addEventListener('pointercancel',()=>{press=null;});
    canvas.addEventListener('pointerup',event=>{
      if(!press||press.id!==event.pointerId)return;
      const moved=Math.hypot(event.clientX-press.x,event.clientY-press.y);press=null;if(moved>15)return;
      const rect=canvas.getBoundingClientRect(),dx=event.clientX-rect.left-cx,dy=event.clientY-rect.top-cy;
      if(Math.hypot(dx,dy)<18){notify('배에서 조금 떨어진 바다를 눌러 방향을 정해 주세요.');return;}
      steer(C.worldHeading(Math.atan2(dx,-dy)*180/Math.PI,cameraBearing()));
    });
    canvas.addEventListener('keydown',event=>{
      const angles={ArrowUp:0,ArrowRight:90,ArrowDown:180,ArrowLeft:270};
      if(event.key in angles){event.preventDefault();if(!event.repeat)steer(C.worldHeading(angles[event.key],cameraBearing()));}
      if(event.code==='Space'){event.preventDefault();if(!event.repeat&&read().navigation)toggle(read().navigation.running&&!read().navigation.stopping?'pause':'resume');}
    });
    $('voyage-pause').addEventListener('click',()=>toggle(read().navigation?.running&&!read().navigation.stopping?'pause':'resume'));
    function updateCameraControl() {
      text('voyage-camera-toggle',headingUp?'시점: 선수 고정':'시점: 북쪽 고정');
      $('voyage-camera-toggle').setAttribute('aria-pressed',String(headingUp));
      $('voyage-canvas').setAttribute('aria-label','바다 조타. 배 주변 클릭·터치와 방향키는 화면 기준 방향, 스페이스는 정지 또는 계속입니다. '+(headingUp?'배의 뱃머리가 위를 향하고 지도가 회전합니다.':'북쪽이 화면 위입니다.'));
    }
    $('voyage-camera-toggle').addEventListener('click',()=>{
      headingUp=!headingUp; press=null;
      try { localStorage.setItem('windward-camera',headingUp?'heading':'north'); } catch (_) {}
      updateCameraControl(); lastHUD=0; render();
    });
    updateCameraControl();
    $('voyage-ports').addEventListener('click',event=>{
      const button=event.target.closest('[data-voyage-port]');if(!button)return;
      const state=read(),id=button.dataset.voyagePort,p=E.portOf(id);
      if(E.nearbyPort(state)?.id===id&&!state.navigation?.running){notify('아래 입항 버튼으로 항구에 들어갈 수 있습니다.');return;}
      navigate(state.visited.includes(id)?{mode:'auto',destination:id}:{mode:'manual',point:{x:p.x,y:p.y}});
    });
    return {render,reset:()=>{trail=[];previous=null;heading=225;bank=0;animationTime=0;lastStamp=0;render();}};
  };
})(window);
