(function (root) {
  'use strict';
  root.createVoyageUI = function ({ read, steer, navigate, toggle, notify }) {
    const E = root.Windward, N = E.N, C = root.VoyageCamera, $ = id => document.getElementById(id);
    const canvas = $('voyage-canvas'), ctx = canvas.getContext('2d');
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
    for (const [size, color] of [[26, '#50988a18'], [21, '#50988a22'], [16, '#66a59333'], [11, '#79b59b44'], [6, '#99c5a56b'], [2, '#e2d6a6']]) {
      sc.lineWidth = size; sc.strokeStyle = color; sc.stroke(land);
    }
    sc.fillStyle = '#dcd8b8'; sc.fill(land, 'evenodd');
    const noise = (x, y) => { const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return n - Math.floor(n); };
    sc.save(); sc.clip(land, 'evenodd');
    for (let y = 0; y < N.G.height; y += 12) for (let x = 0; x < N.G.width; x += 15) {
      const n = noise(x, y), px = x + n * 14, py = y + noise(y, x) * 10;
      sc.fillStyle = n > .5 ? '#82957418' : '#f5e5bc38';
      sc.beginPath(); sc.ellipse(px, py, 5 + n * 9, 3 + n * 3, -.35, 0, Math.PI * 2); sc.fill();
      if (n > .55) {
        sc.fillStyle = '#627f6238';
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
    let trail = [], previous = null, press = null, lastHUD = 0, bank = 0;
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
    }
    function worldTransform(context, position, x = cx, y = cy, zoom = scale, bearing = cameraBearing()) {
      C.transform(context, position, { x, y, zoom, bearing });
    }
    function water(bounds, time) {
      const { left, top, right, bottom } = bounds;
      // World-anchored, irregular wavelets do not slide around when the camera turns.
      const step = compact.matches ? 21 : 17;
      for(let gy=Math.floor(top/14)*14;gy<bottom+14;gy+=14)for(let gx=Math.floor(left/step)*step;gx<right+step;gx+=step){
        const n=noise(gx,gy), x=gx+n*step, y=gy+noise(gy,gx)*14;
        const phase=time*.8+n*6.28, drift=Math.sin(phase)*1.1;
        ctx.strokeStyle=`rgba(209,233,216,${.06+.09*(.5+.5*Math.sin(phase))})`;ctx.lineWidth=.25+n*.18;
        ctx.beginPath();ctx.moveTo(x,y+drift);ctx.bezierCurveTo(x+1,y-.8+drift,x+3,y+.7+drift,x+3+n*4,y+drift);ctx.stroke();
        if(n>.77){ctx.strokeStyle=`rgba(246,239,199,${.09+.11*Math.max(0,Math.sin(phase+1))})`;ctx.lineWidth=.35;ctx.beginPath();ctx.moveTo(x+2,y+2);ctx.lineTo(x+4+n*2,y+2);ctx.stroke();}
      }
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
        ctx.fillStyle=`rgba(203,231,212,${strength*.16})`;
        ctx.beginPath();ctx.moveTo(a.x+px,a.y+py);ctx.lineTo(b.x+px,b.y+py);ctx.lineTo(b.x-px,b.y-py);ctx.lineTo(a.x-px,a.y-py);ctx.closePath();ctx.fill();
        if(i%2===0){ctx.strokeStyle=`rgba(231,242,221,${strength*.35})`;ctx.lineWidth=.35;ctx.beginPath();ctx.moveTo(b.x-px*.8,b.y-py*.8);ctx.quadraticCurveTo(b.x-dx*.5,b.y-dy*.5,b.x+px*.8,b.y+py*.8);ctx.stroke();}
      }
    }
    function ship(time, moving, tier, speed) {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate((heading - cameraBearing()) * Math.PI / 180);
      const size = (width < 500 ? .8 : 1) * (1 + tier * .035); ctx.scale(size, size);
      ctx.fillStyle = '#123e493d'; ctx.beginPath(); ctx.ellipse(8, 9, 29, 55, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#d4ead335'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(0, 5, 30 + Math.sin(time) * 2, 57, 0, 0, Math.PI * 2); ctx.stroke();
      if (moving) {
        for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
          ctx.strokeStyle = `rgba(237,246,225,${(.44 - i * .11) * speed})`; ctx.lineWidth = 2.8 - i * .6;
          ctx.beginPath();ctx.moveTo(side*(8+i*2),-43+i*5);ctx.quadraticCurveTo(side*(28+i*5),5,side*(30+i*8),45+i*10);ctx.stroke();
        }
      }
      ctx.save();
      if (!reduced.matches) { ctx.translate(0, Math.sin(time * 1.5) * (1.1 + speed * .6)); ctx.rotate(Math.sin(time * 1.4) * (.018 + speed * .012) + bank * .035); }
      ctx.beginPath();ctx.moveTo(0,-53);ctx.bezierCurveTo(30,-24,27,32,13,48);ctx.lineTo(-13,48);ctx.bezierCurveTo(-27,32,-30,-24,0,-53);ctx.closePath();
      ctx.fillStyle='#81583c';ctx.strokeStyle='#e3c992';ctx.lineWidth=3;ctx.fill();ctx.stroke();
      ctx.beginPath();ctx.moveTo(0,-42);ctx.bezierCurveTo(20,-16,20,23,11,37);ctx.lineTo(-11,37);ctx.bezierCurveTo(-20,23,-20,-16,0,-42);ctx.fillStyle='#c4a674';ctx.fill();
      ctx.strokeStyle='#92764f';ctx.lineWidth=1;
      for(let y=-21;y<33;y+=9){ctx.beginPath();ctx.moveTo(-14,y);ctx.lineTo(14,y);ctx.stroke();}
      ctx.fillStyle='#70543b';ctx.fillRect(-11,27,22,14);ctx.fillStyle='#d6bb83';ctx.fillRect(-8,30,16,7);
      ctx.strokeStyle='#72533a';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,-56);ctx.lineTo(0,34);ctx.stroke();
      for(const [y,spread] of [[-19,29],[13,24]]) {
        const billow = speed * 5 + (reduced.matches ? 0 : Math.sin(time * (2 + Math.abs(bank)*3) + y) * (1.2 + Math.abs(bank)*2));
        ctx.beginPath();ctx.moveTo(-spread,y-5);ctx.quadraticCurveTo(0,y-20-billow,spread,y-5);ctx.lineTo(spread-4,y+16);ctx.quadraticCurveTo(0,y+25+billow,-spread+4,y+16);ctx.closePath();
        const cloth = ctx.createLinearGradient(-spread, y-20, spread, y+22);
        cloth.addColorStop(0, '#d6c9a5'); cloth.addColorStop(.42, '#fff8de'); cloth.addColorStop(.7, '#f3e7c6'); cloth.addColorStop(1, '#b7a37b');
        ctx.fillStyle=cloth;ctx.strokeStyle='#b79f78';ctx.lineWidth=1;ctx.fill();ctx.stroke();
        ctx.strokeStyle='#a18b6144';ctx.lineWidth=.6;
        for (const seam of [-.45, 0, .45]) { ctx.beginPath();ctx.moveTo(spread*seam,y-10);ctx.quadraticCurveTo(spread*seam+2,y+3,spread*seam,y+19);ctx.stroke(); }
        ctx.beginPath();ctx.moveTo(-spread,y-5);ctx.lineTo(spread,y-5);ctx.strokeStyle='#7e6144';ctx.lineWidth=2;ctx.stroke();
      }
      ctx.strokeStyle='#674e3970';ctx.lineWidth=.7;
      for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(0,-47);ctx.lineTo(side*21,25);ctx.lineTo(0,13);ctx.stroke();}
      ctx.beginPath();ctx.moveTo(1,-47);ctx.lineTo(18,-43);ctx.lineTo(1,-36);ctx.closePath();ctx.fillStyle='#b56e50';ctx.fill();
      ctx.restore();ctx.restore();
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
        .filter(v=>!(v.x>width-135&&v.y<205));
      const key=visible.map(v=>v.p.id+state.visited.includes(v.p.id)).join(',');
      if(key!==portKey){
        portKey=key;
        $('voyage-ports').innerHTML=visible.map(({p})=>`<button class="voyage-port" data-voyage-port="${p.id}" aria-label="${E.portLabel(state,p.id)} 접근"><svg class="icon" aria-hidden="true"><use href="#i-anchor"/></svg>${E.portLabel(state,p.id)}</button>`).join('');
      }
      for(const {p,x,y} of visible){const b=$('voyage-ports').querySelector(`[data-voyage-port="${p.id}"]`);b.style.left=x+'px';b.style.top=(y-38)+'px';}
      return visible;
    }
    function renderHUD(state, visible) {
      const nav=state.navigation, near=E.nearbyPort(state), coordinate=N.unproject(state.position);
      const degree=(Math.round(heading)%360+360)%360;
      const directions=['북','북동','동','남동','남','남서','서','북서'];
      text('voyage-bearing',`${directions[Math.round(degree/45)%8]} · ${degree}°`);
      text('voyage-position',`${Math.abs(coordinate.lat).toFixed(2)}° N · ${Math.abs(coordinate.lon).toFixed(2)}° ${coordinate.lon>=0?'E':'W'}`);
      text('voyage-motion',nav?.stopping?'돛을 내리고 감속 중':nav?.running?(nav.mode==='auto'?'자동항해 중':'직접 조타 · 항해 중'):nav?'돛을 내리고 정지 중':near?'항구 앞바다':'잔잔한 바다 · 정지');
      const speed = nav?.running ? state.motion?.speed ?? 1 : 0;
      text('voyage-speed',`${E.SHIPS[state.ship].name} · ${Math.round(speed*100)}% · ${speed===0?'정지':state.motion?.braking?'감속 중':state.motion?.turning?'선회 중':speed<.95?'가속 중':'순항'}`);
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
      // The compass points to world north, not the ship's bow. No CSS interpolation across 0/360.
      $('voyage-needle').style.transform=`rotate(${-cameraBearing()}deg)`;
      $('voyage-north').style.transform=`translate(-50%,-50%) rotate(${-cameraBearing()}deg) translateY(var(--north-offset)) rotate(${cameraBearing()}deg)`;
      $('voyage-stage').dataset.camera = headingUp ? 'heading' : 'north';
      if(previous&&N.distance(previous,state.position)>35)trail=[];
      if(moving&&(!previous||N.distance(previous,state.position)>.8)){
        const stern=43*(width<500?.8:1)*(1+state.ship*.035)/scale,angle=heading*Math.PI/180;
        trail.push({x:state.position.x-Math.sin(angle)*stern,y:state.position.y+Math.cos(angle)*stern,at:stamp,speed:state.motion?.speed??0});previous={...state.position};
      }
      trail=trail.filter(p=>stamp-p.at<8000).slice(-140);
      const time=reduced.matches?0:stamp/1000;
      const gradient=ctx.createLinearGradient(0,0,width*.6,height);gradient.addColorStop(0,'#326b78');gradient.addColorStop(.5,'#397f83');gradient.addColorStop(1,'#285c6a');ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
      const light=ctx.createRadialGradient(width*.22,height*.16,0,width*.22,height*.16,width*.8);
      light.addColorStop(0,'#c8dfb32a');light.addColorStop(1,'#b7d9bc00');ctx.fillStyle=light;ctx.fillRect(0,0,width,height);
      ctx.save();worldTransform(ctx,state.position);
      ctx.lineWidth=.45;ctx.strokeStyle='#eef5d83b';
      const {left,top,right,bottom}=C.bounds(state.position,cameraView(),width,height);
      water({left,top,right,bottom},time);
      ctx.fillStyle='#dcd8b8';ctx.fill(land,'evenodd');
      ctx.drawImage(scenery,0,0,N.G.width,N.G.height);
      harbor(state);
      ctx.save();ctx.clip(seaMask,'evenodd');wake(stamp);ctx.restore();
      ctx.restore();
      const visible=renderPorts(state);
      for(const {x,y} of visible){ctx.save();ctx.translate(x,y);ctx.fillStyle='#f4eacf';ctx.strokeStyle='#83765b';ctx.lineWidth=1;ctx.fillRect(-5,-18,10,21);ctx.strokeRect(-5,-18,10,21);ctx.fillStyle='#b07a55';ctx.beginPath();ctx.moveTo(-8,-18);ctx.lineTo(0,-28);ctx.lineTo(8,-18);ctx.fill();ctx.fillStyle='#efdb98';ctx.fillRect(-2,-14,4,6);ctx.restore();}
      for (const site of E.seaSightings(state)) {
        const { x, y } = C.project(site, state.position, cameraView());
        if (x < 22 || x > width - 22 || y < 100 || y > height - 75) continue;
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
      ship(time,moving,state.ship,state.motion?.speed??1);
      if(stamp-lastHUD>100||!dt){renderHUD(state,visible);renderMini(state);lastHUD=stamp;}
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
    return {render,reset:()=>{trail=[];previous=null;heading=225;bank=0;lastStamp=0;render();}};
  };
})(window);
