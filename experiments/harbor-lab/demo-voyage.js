import * as T from './vendor/three.module.min.js';
import {createWorld} from './world.js';
import {loadPaintedMaterials,createPaintedShip} from './painted.js';
import {createOcean,createShipWake} from './ocean.js';
import {createTerrainLoader} from './terrain-loader.js';

export async function installPaintedVoyage(){
  const art=await loadPaintedMaterials(),fallback=window.createVoyageUI;
  window.createVoyageUI=options=>{
    try{return createIntegratedVoyage(options,art);}
    catch(error){
      console.warn('Using the original voyage renderer',error);
      const canvas=document.getElementById('voyage-canvas');canvas.replaceWith(canvas.cloneNode());
      document.getElementById('demo-note').textContent='이 기기에서는 기존 항해 화면으로 실행합니다. 교역·탐험·저장은 동일하게 사용할 수 있습니다.';
      window.windwardDemo=Object.freeze({snapshot:()=>({mode:'fallback',state:JSON.parse(JSON.stringify(options.read()))})});
      return fallback(options);
    }
  };
}

function createIntegratedVoyage({read,steer,navigate,toggle,notify},art){
  const E=window.Windward,N=E.N,$=id=>document.getElementById(id),canvas=$('voyage-canvas');
  const renderer=new T.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance'});
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  const scene=new T.Scene();scene.background=new T.Color('#12566b');scene.add(new T.HemisphereLight('#fff6e4','#607a83',1.7));
  const sun=new T.DirectionalLight('#fff3d8',2.1);sun.position.set(-80,140,-70);scene.add(sun);
  const camera=new T.OrthographicCamera(-60,60,69,-69,.1,1000),ship=createPaintedShip(scene,art);
  const scale=4,origin=E.portOf('lume'),local=p=>({x:(p.x-origin.x)*scale,z:(p.y-origin.y)*scale});
  // Keep the accepted coastal study's proportions, but never advance its test simulation.
  // app.js is the single owner of gameplay, travel time, saves and sound.
  const mobile=matchMedia('(max-width:900px)'),compact=mobile.matches,terrainLoader=createTerrainLoader(N);
  const chunks=new Map();let chunk,pendingChunk=null,headingUp=true,high=false,width=0,height=0,lastDraw=0,lastStamp=0,time=0,lastHUD=0,press=null,failed=false,draws=0,dirty=true,tier=-1,lastPose='',siteKey='';
  const deep=new T.DataTexture(new Uint8Array([255,255,0,255]),1,1,T.RGBAFormat);deep.needsUpdate=true;
  const openSea=createOcean(scene,deep,10000);openSea.mesh.position.y=-.05;
  const waterMap=openSea.material.uniforms.waterMap.value,wake=createShipWake(scene,waterMap);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  try{headingUp=localStorage.getItem('windward-demo-camera')!=='north';}catch(_){}
  const ray=new T.Raycaster(),seaPlane=new T.Plane(new T.Vector3(0,1,0),0),hit=new T.Vector3();
  const mini=$('voyage-minimap').getContext('2d'),land=new Path2D(N.G.rings.map(r=>'M'+r.map(p=>p.join(',')).join('L')+'Z').join(''));
  const sites=document.createElement('div');sites.className='demo-sites';$('voyage-stage').append(sites);
  const quality=document.createElement('button');quality.className='secondary demo-quality';quality.type='button';quality.textContent='화질 · 경량';quality.setAttribute('aria-pressed','false');document.querySelector('.helm-help summary').after(quality);
  quality.after($('voyage-camera-toggle'));
  $('voyage-screen').classList.add('painted-mode');
  const note=document.createElement('p');note.className='demo-render-note';note.hidden=true;note.setAttribute('role','status');$('voyage-stage').append(note);
  const sharedMaterials=new Set(Object.values(art)),sharedTextures=new Set(Object.values(art).map(m=>m.map).filter(Boolean));
  function disposeChunk(value){
    const materials=new Set(),textures=new Set();value.group.traverse(m=>{m.geometry?.dispose();if(m.material)for(const a of Array.isArray(m.material)?m.material:[m.material])if(!sharedMaterials.has(a))materials.add(a);});
    for(const m of materials){if(m.map&&!sharedTextures.has(m.map))textures.add(m.map);m.dispose();}for(const t of textures)t.dispose();value.world.depth.dispose();scene.remove(value.group);
  }
  function updateChunk(state){
    const near=E.PORTS.reduce((a,p)=>N.distance(state.position,p)<N.distance(state.position,a)?p:a);
    const center=N.distance(state.position,near)<24?near:{x:Math.round(state.position.x/32)*32,y:Math.round(state.position.y/32)*32};
    const key=`${center.x}:${center.y}`;if(chunk?.key===key)return;
    let next=chunks.get(key);
    if(next){activate(next);return;}
    if(pendingChunk||failed)return;
    pendingChunk=key;
    terrainLoader.load(center,scale,320,compact?8:4).then(prepared=>{
      if(failed)return;
      const group=new T.Group(),terrain=new T.Group(),offset=local(center);terrain.position.set(offset.x,0,offset.z);group.add(terrain);
      const M={E,local:p=>({x:(p.x-center.x)*scale,z:(p.y-center.y)*scale}),world:p=>({x:p.x/scale+center.x,y:p.z/scale+center.y})};
      const town=N.distance(center,near)<40;
      const world=createWorld(terrain,M,art,{extent:320,town,townCenter:M.local(near),prepared,compact});
      const ocean=createOcean(group,world.depth,world.extent,offset,waterMap);
      scene.add(group);next={key,group,world,ocean};activate(next);dirty=true;
    }).catch(error=>{console.warn('Terrain could not be prepared',error);failed=true;if(read().navigation?.running)toggle('pause');note.hidden=false;note.textContent='해안을 준비하지 못했습니다. 해도로 이동하거나 새로고침해 주세요.';}).finally(()=>pendingChunk=null);
  }
  function activate(next){
    if(chunk)chunk.group.visible=false;
    chunks.delete(next.key);chunks.set(next.key,next);next.group.visible=true;chunk=next;
    while(chunks.size>3){const [oldKey,old]=chunks.entries().next().value;disposeChunk(old);chunks.delete(oldKey);}
  }
  function fit(){const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return false;
    if(width!==r.width||height!==r.height||dirty){width=r.width;height=r.height;renderer.setPixelRatio(Math.min(devicePixelRatio||1,high?1.5:1,Math.sqrt((high?1400000:700000)/(width*height))));renderer.setSize(width,height,false);
      const span=height<350?82:width<600?120:138;camera.left=-span*width/height/2;camera.right=-camera.left;camera.top=span/2;camera.bottom=-camera.top;camera.updateProjectionMatrix();}
    return true;
  }
  function pose(state){const p=local(state.position),a=headingUp?state.motion.heading*Math.PI/180:0,focus=new T.Vector3(p.x+Math.sin(a)*12,0,p.z-Math.cos(a)*12);
    camera.position.set(focus.x-Math.sin(a)*100,105,focus.z+Math.cos(a)*100);camera.lookAt(focus);camera.updateMatrixWorld();ship.root.position.set(p.x,0,p.z);
  }
  function project(point){const p=local(point),v=new T.Vector3(p.x,0,p.z).project(camera);return{x:(v.x*.5+.5)*width,y:(-.5*v.y+.5)*height,z:v.z};}
  const text=(id,value)=>{if($(id).textContent!==value)$(id).textContent=value;};
  function hud(state){
    const near=E.nearbyPort(state),nav=state.navigation,wind=E.windAt(state),bearing=headingUp?state.motion.heading:0,directions=['북','북동','동','남동','남','남서','서','북서'];
    text('voyage-wind-label',`${directions[Math.round(wind.from/45)%8]}풍 · ${Math.round(wind.knots)} kn`);text('voyage-wind-effect',`${wind.kind} · 순항 목표 ${Math.round(wind.factor*100)}%`);
    $('voyage-wind-arrow').style.transform=`rotate(${wind.from+180-bearing}deg)`;$('voyage-needle').style.transform=`rotate(${-bearing}deg)`;
    $('voyage-north').style.transform=`translate(-50%,-50%) rotate(${-bearing}deg) translateY(var(--north-offset)) rotate(${bearing}deg)`;
    $('voyage-stage').dataset.camera=headingUp?'heading':'north';
    text('voyage-bearing',`${directions[Math.round(state.motion.heading/45)%8]} · ${Math.round(state.motion.heading)%360}°`);
    const coord=N.unproject(state.position);text('voyage-position',`${coord.lat.toFixed(2)}° N · ${Math.abs(coord.lon).toFixed(2)}° ${coord.lon<0?'W':'E'}`);
    text('voyage-motion',nav?.stopping?'돛을 내리고 감속 중':nav?.running?nav.mode==='auto'?'자동항해 중':'직접 조타 · 항해 중':'정지 중');
    text('voyage-speed',`${E.SHIPS[state.ship].name} · ${Math.round(state.motion.speed*100)}%`);
    text('voyage-mood',near?`${E.portLabel(state,near.id)} 앞바다`:'바람을 따라, 더 먼 바다로');
    text('voyage-status',nav?.running?nav.stopping?'서서히 정지하고 있습니다.':nav.mode==='auto'?`${E.portLabel(state,nav.targetPort)}(으)로 향하고 있습니다.`:'바다를 누르면 그 방향으로 계속 항해합니다.':near?'가까운 항구로 입항하거나 다시 출항할 수 있습니다.':'정지 중입니다. 바다를 눌러 항로를 정하세요.');
    $('voyage-pause').disabled=!nav;text('voyage-pause',nav&&(!nav.running||nav.stopping)?'계속':'정지');
    const arrival=near&&!nav?.running?`<div><p class="eyebrow">READY TO GO ASHORE</p><h3>${E.portLabel(state,near.id)} · 입항 가능</h3></div><button class="primary" id="voyage-enter-port">입항 →</button>`:`<div><p>미확인 항구는 가까이 접근해 입항하세요.</p></div>${!state.port?'<button class="secondary rescue-button" id="voyage-rescue"><span>귀환 지원</span><small>3일 / 최대 40 G</small></button>':''}`;
    if($('voyage-arrival').innerHTML!==arrival)$('voyage-arrival').innerHTML=arrival;
    const visible=E.PORTS.map(p=>{const v=project(p);return{p,...v,y:v.y-(width<600?72:48)};}).filter(v=>v.z>-1&&v.z<1&&v.x>42&&v.x<width-42&&v.y>120&&v.y<height-100&&!(v.x>width-140&&v.y<180)&&!(v.x<240&&v.y<180));
    const key=visible.map(({p})=>p.id+state.visited.includes(p.id)).join(',');
    if($('voyage-ports').dataset.key!==key){$('voyage-ports').dataset.key=key;$('voyage-ports').innerHTML=visible.map(({p})=>`<button class="voyage-port" data-voyage-port="${p.id}">${E.portLabel(state,p.id)}</button>`).join('');}
    for(const {p,x,y} of visible){const el=$('voyage-ports').querySelector(`[data-voyage-port="${p.id}"]`);el.style.left=x+'px';el.style.top=y+'px';}
    const sightings=E.seaSightings(state).map(s=>({s,...project(s)})).filter(v=>v.x>24&&v.x<width-24&&v.y>100&&v.y<height-80),nextSiteKey=sightings.map(({s})=>s.id+state.seaDiscoveries.includes(s.id)).join(',');
    if(nextSiteKey!==siteKey){siteKey=nextSiteKey;sites.innerHTML=sightings.map(({s})=>`<span class="demo-site" data-site="${s.id}"><i>${state.seaDiscoveries.includes(s.id)?'◇':'?'}</i>${state.seaDiscoveries.includes(s.id)?s.name:'해상 단서'}</span>`).join('');}
    for(const {s,x,y} of sightings){const el=sites.querySelector(`[data-site="${s.id}"]`);el.style.left=x+'px';el.style.top=y+'px';}
    if(mobile.matches)return;
    mini.fillStyle='#adc9bd';mini.fillRect(0,0,150,110);mini.save();mini.translate(75-state.position.x*.5,55-state.position.y*.5);mini.scale(.5,.5);mini.fillStyle='#e2dcc0';mini.fill(land,'evenodd');mini.restore();
    for(const p of E.PORTS){const x=75+(p.x-state.position.x)*.5,y=55+(p.y-state.position.y)*.5;if(x<3||x>147||y<3||y>107)continue;mini.fillStyle=state.visited.includes(p.id)?'#386957':'#a68453';mini.beginPath();mini.arc(x,y,2,0,Math.PI*2);mini.fill();}
    mini.save();mini.translate(75,55);mini.rotate(state.motion.heading*Math.PI/180);mini.fillStyle='#a45c42';mini.beginPath();mini.moveTo(0,-6);mini.lineTo(4,5);mini.lineTo(-4,5);mini.closePath();mini.fill();mini.restore();mini.fillStyle='#385d51';mini.fillText('N',7,13);
  }
  function render(stamp=performance.now()){
    if($('voyage-screen').hidden||document.hidden){lastStamp=0;return;}
    if(!fit())return;const state=read(),dt=lastStamp?Math.min(.1,Math.max(0,(stamp-lastStamp)/1000)):0;lastStamp=stamp;pose(state);
    if(!document.querySelector('dialog[open]'))time+=dt;
    if(stamp-lastHUD>180||dirty){hud(state);lastHUD=stamp;}
    if(failed||document.querySelector('dialog[open]'))return;
    const poseKey=[state.position.x,state.position.y,state.motion.heading,state.motion.speed,state.ship].join(':');
    if(reduced.matches&&!dirty&&poseKey===lastPose&&!wake?.active)return;
    const interval=1000/(high?60:30);if(!dirty&&stamp-lastDraw<interval-.1)return;
    lastDraw=stamp-Math.max(0,(stamp-lastDraw)%interval);lastPose=poseKey;updateChunk(state);
    if(tier!==state.ship){tier=state.ship;ship.root.scale.setScalar(1.5+Math.min(tier,6)*.08);ship.root.userData.tier=tier;
      ship.body.children.filter(m=>m.geometry?.type==='PlaneGeometry'&&m.material?.map).forEach(m=>m.material.color.set(['#fff3d5','#f1e9cc','#f3dab2','#ddd6bc','#f4e5bf','#e7d2aa','#faf0d4'][tier]));}
    const angle=state.motion.heading*Math.PI/180,hullScale=ship.root.scale.x/1.5;ship.update(reduced.matches?0:time,angle,state.motion.speed,reduced.matches);openSea.update(reduced.matches?0:time,camera,ship.root.position,angle,state.motion.speed,hullScale);chunk?.ocean.update(reduced.matches?0:time,camera,ship.root.position,angle,state.motion.speed,hullScale);wake.update(time,ship.root.position,angle,state.motion.speed,reduced.matches,hullScale);
    renderer.render(scene,camera);draws++;dirty=false;
  }
  function cameraControl(){text('voyage-camera-toggle',headingUp?'시점: 선수 고정':'시점: 북쪽 고정');$('voyage-camera-toggle').setAttribute('aria-label',headingUp?'선수 고정 시점':'북쪽 고정 시점');$('voyage-camera-toggle').setAttribute('aria-pressed',String(headingUp));}
  canvas.addEventListener('pointerdown',e=>{if(e.button===0)press={id:e.pointerId,x:e.clientX,y:e.clientY};});canvas.addEventListener('pointercancel',()=>press=null);
  canvas.addEventListener('pointerup',e=>{if(!press||press.id!==e.pointerId)return;const start=press;press=null;if(Math.hypot(start.x-e.clientX,start.y-e.clientY)>15)return;const r=canvas.getBoundingClientRect();ray.setFromCamera(new T.Vector2((e.clientX-r.left)/width*2-1,-(e.clientY-r.top)/height*2+1),camera);if(!ray.ray.intersectPlane(seaPlane,hit))return;const p=local(read().position),dx=hit.x-p.x,dz=hit.z-p.z;if(Math.hypot(dx,dz)<2){notify('배에서 조금 떨어진 바다를 눌러 주세요.');return;}steer((Math.atan2(dx,-dz)*180/Math.PI+360)%360);});
  canvas.addEventListener('keydown',e=>{const angles={ArrowUp:0,ArrowRight:90,ArrowDown:180,ArrowLeft:270};if(e.key in angles){e.preventDefault();if(!e.repeat)steer(((headingUp?read().motion.heading:0)+angles[e.key])%360);}if(e.code==='Space'){e.preventDefault();if(!e.repeat&&read().navigation)toggle(read().navigation.running&&!read().navigation.stopping?'pause':'resume');}});
  $('voyage-pause').addEventListener('click',()=>toggle(read().navigation?.running&&!read().navigation.stopping?'pause':'resume'));
  $('voyage-camera-toggle').addEventListener('click',()=>{headingUp=!headingUp;try{localStorage.setItem('windward-demo-camera',headingUp?'heading':'north');}catch(_){}dirty=true;cameraControl();render();});cameraControl();
  quality.addEventListener('click',()=>{high=!high;quality.textContent=`화질 · ${high?'선명':'경량'}`;quality.setAttribute('aria-pressed',String(high));dirty=true;render();});
  $('voyage-ports').addEventListener('click',e=>{const b=e.target.closest('[data-voyage-port]');if(!b)return;const state=read(),id=b.dataset.voyagePort,p=E.portOf(id);if(E.nearbyPort(state)?.id===id&&!state.navigation?.running){notify('아래 입항 버튼으로 들어가세요.');return;}navigate(state.visited.includes(id)?{mode:'auto',destination:id}:{mode:'manual',point:{x:p.x,y:p.y}});});
  window.addEventListener('resize',()=>dirty=true);document.addEventListener('visibilitychange',()=>{lastStamp=0;dirty=true;});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();failed=true;if(read().navigation?.running)toggle('pause');note.hidden=false;note.textContent='그래픽 연결이 끊겼습니다. 해도로 이동하거나 저장 후 새로고침해 주세요.';});
  const reset=()=>{wake?.clear();time=0;lastStamp=0;dirty=true;render();};
  window.windwardDemo=Object.freeze({snapshot:()=>({mode:failed?'context-lost':'painted',state:JSON.parse(JSON.stringify(read())),tier,draws,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,chunk:chunk?.key,chunkCount:chunks.size,loading:!!pendingChunk,terrainMode:terrainLoader.mode,compact,headingUp,pixels:canvas.width*canvas.height}),project:point=>project(point)});
  return {render,reset};
}
