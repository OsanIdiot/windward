import * as T from './vendor/three.module.min.js';
import {createWorld} from './world.js';
import {loadPaintedMaterials,createPaintedShip} from './painted.js';
import {createOcean,createShipWake} from './ocean.js';

if(document.readyState==='loading')await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
const $=id=>document.getElementById(id),canvas=$('scene'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
let renderer,raf=0,failed=false;
function fail(message){failed=true;cancelAnimationFrame(raf);$('loading').hidden=true;$('failure').hidden=false;$('failure-message').textContent=message;}
$('retry').addEventListener('click',()=>location.reload());
try {
  const M=window.HarborModel,E=M.E;
  let state=M.initial(),headingUp=true,high=false,lookout=false,last=0,time=0,press=null,noticeUntil=0,lastHUD=0,frameCount=0,fps=0,lastShadow=0;
  let dirty=true,lastDraw=0,fpsWindow=performance.now(),simulationDebt=0,renderedFrames=0;
  const simulationStep=1/60;
  const scene=new T.Scene();scene.background=new T.Color('#12566b');
  renderer=new T.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance'});
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  renderer.shadowMap.enabled=false;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
  const camera=new T.OrthographicCamera(-50,50,60,-60,.1,850);
  scene.add(new T.HemisphereLight('#fff6e4','#607a83',1.7));
  const sun=new T.DirectionalLight('#fff3d8',2.1);sun.position.set(-80,140,-70);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=sun.shadow.camera.bottom=-140;sun.shadow.camera.right=sun.shadow.camera.top=140;sun.shadow.camera.far=400;sun.shadow.bias=-.001;sun.shadow.normalBias=.3;scene.add(sun);
  const art=await loadPaintedMaterials();
  const world=createWorld(scene,M,art),ocean=createOcean(scene,world.depth,world.extent),ship=createPaintedShip(scene,art);
  ship.root.scale.setScalar(1.5);
  const shadowPlane=new T.Mesh(new T.PlaneGeometry(520,520),new T.ShadowMaterial({opacity:.13}));shadowPlane.rotation.x=-Math.PI/2;shadowPlane.position.y=.018;shadowPlane.receiveShadow=true;scene.add(shadowPlane);
  const targetMarker=new T.Mesh(new T.RingGeometry(1.1,1.3,40),new T.MeshBasicMaterial({color:'#f5ddb1',transparent:true,opacity:.75,depthWrite:false}));targetMarker.rotation.x=-Math.PI/2;targetMarker.position.y=.1;targetMarker.visible=false;scene.add(targetMarker);
  const wake=createShipWake(scene,ocean.material.uniforms.waterMap.value);
  const ray=new T.Raycaster(),seaPlane=new T.Plane(new T.Vector3(0,1,0),0),hit=new T.Vector3(),label=new T.Vector3();
  const flock=new T.Group();scene.add(flock);const birds=[];
  const wingGeo=new T.BufferGeometry();wingGeo.setAttribute('position',new T.Float32BufferAttribute([-.9,0,.12,-.2,.08,-.12,0,0,.1,.2,.08,-.12,.9,0,.12],3));
  for(let i=0;i<5;i++){const bird=new T.Line(wingGeo,new T.LineBasicMaterial({color:'#f1eee0',transparent:true,opacity:.85}));flock.add(bird);birds.push(bird);}
  function notify(message){$('notice').textContent=message;$('notice').classList.remove('quiet');noticeUntil=performance.now()+5000;}
  function fit(){const w=innerWidth,h=$('experience').clientHeight;const ratio=Math.min(devicePixelRatio||1,high?1.5:1,Math.sqrt((high?1400000:700000)/(w*h)));renderer.setPixelRatio(ratio);renderer.setSize(w,h,false);const span=(h<500?82:138)*(lookout?1.35:1);camera.left=-span*w/h/2;camera.right=-camera.left;camera.top=span/2;camera.bottom=-camera.top;camera.updateProjectionMatrix();renderer.shadowMap.enabled=high;shadowPlane.visible=high;renderer.shadowMap.needsUpdate=high;dirty=true;}
  function updateCamera(){const p=M.local(state.position),a=headingUp?state.motion.heading*Math.PI/180:0;
    const focus=new T.Vector3(p.x+Math.sin(a)*12,0,p.z-Math.cos(a)*12);
    camera.position.set(focus.x-Math.sin(a)*100,105,focus.z+Math.cos(a)*100);camera.up.set(0,1,0);camera.lookAt(focus);camera.updateMatrixWorld();
    ship.root.position.set(p.x,0,p.z);$('compass-rose').style.transform=`rotate(${-a*180/Math.PI}deg)`;
  }
  function hud(stamp){
    $('gold').textContent=state.gold.toLocaleString('ko-KR');
    const w=E.windAt(state),names=['북','북동','동','남동','남','남서','서','북서'];$('wind').textContent=`${names[Math.round(w.from/45)%8]}풍 · ${w.kind}`;
    $('motion').textContent=state.navigation?.running?(state.navigation.stopping?'감속 중':state.motion.turning?'선회 중':state.motion.speed<w.factor-.04?'돛을 펼치는 중':'순항'):'정박 중';
    $('bearing').textContent=`${String(Math.round(state.motion.heading)%360).padStart(3,'0')}° · ${Math.round(state.motion.speed*100)}%`;
    $('stop-label').textContent=state.navigation&&!state.navigation.running?'계속':'정지';$('stop').disabled=!state.navigation;
    label.copy(world.portPosition).project(camera);const x=(label.x*.5+.5)*innerWidth,y=(-label.y*.5+.5)*$('experience').clientHeight;
    const overlaps=[document.querySelector('.location'),document.querySelector('.instruments')].some(el=>{const r=el.getBoundingClientRect();return x+60>r.left&&x-60<r.right&&y>r.top&&y-58<r.bottom;});
    const inside=!overlaps&&label.z>-1&&label.z<1&&x>55&&x<innerWidth-55&&y>150&&y<$('experience').clientHeight-210;
    $('port-label').hidden=!inside;if(inside){$('port-label').style.left=x+'px';$('port-label').style.top=y+'px';}
    if(stamp>noticeUntil)$('notice').classList.add('quiet');
    $('diagnostics').textContent=`${fps} FPS (실제 그리기 횟수) · ${renderer.info.render.calls} draw calls · ${renderer.info.render.triangles.toLocaleString()} triangles · DPR ${renderer.getPixelRatio().toFixed(2)} · ${high?'선명 / 최대 60 FPS':'경량 / 최대 30 FPS'}. 팝업·배경 탭에서는 그리기를 멈춥니다. 다른 휴대폰 성능을 보장하지 않습니다.`;
  }
  function tick(stamp){
    if(failed||document.hidden)return;
    raf=requestAnimationFrame(tick);
    const dt=last?Math.min(.1,Math.max(0,(stamp-last)/1000)):0,dialogOpen=!!document.querySelector('dialog[open]');
    last=stamp;
    if(dialogOpen){simulationDebt=0;fpsWindow=stamp;frameCount=0;return;}
    // Physics stays at 60 Hz regardless of the selected drawing rate.
    if(state.navigation?.running){simulationDebt+=dt;try{
      while(simulationDebt>=simulationStep&&state.navigation?.running){state=E.advance(state,simulationStep*M.SIMULATION_RATE);simulationDebt-=simulationStep;dirty=true;
        if(!M.within(state.position)){state=E.act(state,{type:'pause',immediate:true});notify('시험 해역 끝입니다. 출발 위치로 돌아가세요.');}}
    }catch(error){state=E.act(state,{type:'pause',immediate:true});notify(error.message);}}else simulationDebt=0;
    time+=dt;
    // Keep picking/projection aligned with physics between the less frequent draws.
    updateCamera();
    if(stamp-fpsWindow>=1000){fps=Math.round(frameCount*1000/(stamp-fpsWindow));frameCount=0;fpsWindow=stamp;}
    if(stamp-lastHUD>250){hud(stamp);lastHUD=stamp;}
    const interval=1000/(high?60:30),elapsed=stamp-lastDraw;
    if(elapsed<interval-.1||reduced.matches&&!dirty&&!wake.active)return;
    lastDraw+=Math.floor((elapsed+.1)/interval)*interval;dirty=false;
    const angle=state.motion.heading*Math.PI/180;
    ship.update(reduced.matches?0:time,angle,state.motion.speed,reduced.matches);ocean.update(reduced.matches?0:time,camera,ship.root.position,angle,state.motion.speed);
    wake.update(time,ship.root.position,angle,state.motion.speed,reduced.matches);
    for(let i=0;i<birds.length;i++){const t=reduced.matches?0:time*.13;birds[i].position.set(-15+Math.cos(t+i*.5)*12,10+i*.7,-17+Math.sin(t+i*.5)*8);birds[i].rotation.y=-t-i*.5;birds[i].scale.y=reduced.matches?1:1+Math.sin(time*3+i)*2;}
    if(high&&stamp-lastShadow>1000){renderer.shadowMap.needsUpdate=true;lastShadow=stamp;}
    renderer.render(scene,camera);
    renderedFrames++;frameCount++;
  }
  function change(next){state=next;dirty=true;targetMarker.visible=!!state.navigation?.running;if(targetMarker.visible){const p=M.local(state.navigation.points.at(-1));targetMarker.position.set(p.x,.1,p.z);}notify('돛을 펼칩니다. 다시 바다를 누르면 항로를 바꿉니다.');}
  function pause(){if(!state.navigation)return;state=E.act(state,{type:state.navigation.running&&!state.navigation.stopping?'pause':'resume'});dirty=true;hud(performance.now());}
  canvas.addEventListener('pointerdown',e=>{if(e.button===0)press={id:e.pointerId,x:e.clientX,y:e.clientY};});
  canvas.addEventListener('pointercancel',()=>press=null);
  canvas.addEventListener('pointerup',e=>{if(!press||e.pointerId!==press.id)return;const start=press;press=null;if(Math.hypot(start.x-e.clientX,start.y-e.clientY)>12)return;
    const r=canvas.getBoundingClientRect();ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);
    if(!ray.ray.intersectPlane(seaPlane,hit))return;
    try{change(M.move(state,M.world({x:hit.x,z:hit.z})));}catch(error){notify(error.message);}
  });
  canvas.addEventListener('keydown',e=>{const angles={ArrowUp:0,ArrowRight:90,ArrowDown:180,ArrowLeft:270};if(e.key in angles){e.preventDefault();if(!e.repeat)try{change(M.steer(state,(headingUp?state.motion.heading:0)+angles[e.key]));}catch(error){notify(error.message);}}if(e.code==='Space'){e.preventDefault();if(!e.repeat)pause();}});
  $('stop').addEventListener('click',pause);
  $('camera').addEventListener('click',()=>{headingUp=!headingUp;dirty=true;$('camera').textContent=headingUp?'선수 고정':'북쪽 고정';$('camera').setAttribute('aria-pressed',String(headingUp));updateCamera();});
  $('quality').addEventListener('click',()=>{high=!high;$('quality').textContent=`화질 · ${high?'선명':'경량'}`;$('quality').setAttribute('aria-pressed',String(high));fit();});
  $('lookout').addEventListener('click',()=>{lookout=!lookout;$('lookout').setAttribute('aria-pressed',String(lookout));fit();notify(lookout?'망원경으로 더 넓은 해안을 살펴봅니다.':'기본 항해 시야로 돌아왔습니다.');});
  $('reset').addEventListener('click',()=>{state=M.initial();simulationDebt=0;dirty=true;wake.clear();time=0;targetMarker.visible=false;updateCamera();notify('새 시험 항해입니다. 본 게임 기록은 변경하지 않았습니다.');});
  function drawChart(){const c=$('chart-canvas'),g=c.getContext('2d'),s=5.2;g.fillStyle='#96b9b1';g.fillRect(0,0,600,600);g.save();g.translate(300,300);g.scale(s,s);g.beginPath();for(const ring of E.N.G.rings){ring.forEach(([x,y],i)=>{const p={x:x-M.port.x,y:y-M.port.y};if(i)g.lineTo(p.x,p.y);else g.moveTo(p.x,p.y);});g.closePath();}g.fillStyle='#d9d4ad';g.fill('evenodd');g.strokeStyle='#778b76';g.lineWidth=.2;g.stroke();g.strokeStyle='#d8c392';g.lineWidth=.4;g.beginPath();g.arc(0,0,M.RADIUS,0,Math.PI*2);g.stroke();const p={x:state.position.x-M.port.x,y:state.position.y-M.port.y};g.translate(p.x,p.y);g.rotate(state.motion.heading*Math.PI/180);g.fillStyle='#a45237';g.beginPath();g.moveTo(0,-1.7);g.lineTo(1.1,1.2);g.lineTo(0,.6);g.lineTo(-1.1,1.2);g.closePath();g.fill();g.restore();g.fillStyle='#254c48';g.font='14px Georgia';g.fillText('N',16,24);g.fillText('LISBON',308,295);}
  $('chart').addEventListener('click',()=>{drawChart();$('chart-dialog').showModal();});
  $('about').addEventListener('click',()=>{$('about-dialog').showModal();});
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
  document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('close',()=>{dirty=true;last=0;}));
  reduced.addEventListener('change',()=>{dirty=true;});
  window.addEventListener('resize',fit);
  document.addEventListener('visibilitychange',()=>{last=0;simulationDebt=0;dirty=true;press=null;cancelAnimationFrame(raf);if(!document.hidden&&!failed)raf=requestAnimationFrame(tick);});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fail('그래픽 연결이 중단되었습니다. 다시 불러오면 시험 항해를 처음부터 시작합니다. 본 게임 저장에는 영향이 없습니다.');});
  const boot = performance.now();fit();updateCamera();renderer.render(scene,camera);renderedFrames++;$('loading').hidden=true;notify('바다를 눌러 첫 항로를 그려보세요');raf=requestAnimationFrame(tick);
  // Read-only diagnostics for reproducible visual and isolation tests; no state setter or save API.
  window.harborLab=Object.freeze({snapshot:()=>({state:JSON.parse(JSON.stringify(state)),headingUp,high,lookout,fps,renderedFrames,frameLimit:high?60:30,shadows:renderer.shadowMap.enabled,renderPixels:canvas.width*canvas.height,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,pixelRatio:renderer.getPixelRatio(),camera:{x:camera.position.x,y:camera.position.y,z:camera.position.z},readyAt:boot}),project:point=>{const p=M.local(point),v=new T.Vector3(p.x,0,p.z).project(camera);return {x:(v.x*.5+.5)*innerWidth,y:(-.5*v.y+.5)*$('experience').clientHeight};}});
} catch(error){console.error(error);renderer?.dispose();fail('WebGL 2를 사용할 수 없거나 그래픽 준비에 실패했습니다. 최신 브라우저와 하드웨어 가속 설정을 확인해 주세요.');}
