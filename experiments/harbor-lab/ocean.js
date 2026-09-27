import * as T from './vendor/three.module.min.js';

function waterTexture() {
  const size=128,heights=new Float32Array(size*size),data=new Uint8Array(size*size*4);
  let seed=4179;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  // Tileable multi-scale waves are baked once, instead of evaluated per screen pixel.
  for(const [cells,weight] of [[8,.55],[16,.27],[32,.13],[64,.05]]){
    const grid=Float32Array.from({length:cells*cells},random);
    const at=(x,y)=>grid[(y%cells)*cells+x%cells];
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const px=x/size*cells,py=y/size*cells,ix=Math.floor(px),iy=Math.floor(py),fx=px-ix,fy=py-iy;
      const u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
      heights[y*size+x]+=((at(ix,iy)*(1-u)+at(ix+1,iy)*u)*(1-v)+(at(ix,iy+1)*(1-u)+at(ix+1,iy+1)*u)*v)*weight;
    }
  }
  const at=(x,y)=>heights[((y+size)%size)*size+(x+size)%size];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4;
    data[i]=Math.round(at(x,y)*255);
    data[i+1]=Math.round(T.MathUtils.clamp(.5+(at(x-1,y)-at(x+1,y))*1.6,0,1)*255);
    data[i+2]=Math.round(T.MathUtils.clamp(.5+(at(x,y-1)-at(x,y+1))*1.6,0,1)*255);
    data[i+3]=255;
  }
  const texture=new T.DataTexture(data,size,size,T.RGBAFormat);
  texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.magFilter=T.LinearFilter;
  texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;
  return texture;
}

export function createOcean(scene, depth, extent,origin={x:0,z:0},waterMap=waterTexture()) {
  const uniforms = {time:{value:0},depthMap:{value:depth},waterMap:{value:waterMap},depthOrigin:{value:new T.Vector2(origin.x,origin.z)},extent:{value:extent},eye:{value:new T.Vector3()},ship:{value:new T.Vector2()},direction:{value:new T.Vector2(0,-1)},speed:{value:0},hullScale:{value:1}};
  const material = new T.ShaderMaterial({
    uniforms,
    vertexShader:`varying vec3 worldPosition;
      void main(){vec4 p=modelMatrix*vec4(position,1.);worldPosition=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,
    fragmentShader:`
      precision highp float;
      varying vec3 worldPosition;
      uniform float time,extent,speed,hullScale;
      uniform sampler2D depthMap,waterMap;
      uniform vec3 eye;
      uniform vec2 ship,direction,depthOrigin;
      void main(){
        vec2 p=worldPosition.xz;
        vec2 uv=(p-depthOrigin+extent)/(2.*extent);
        float distanceToShore=texture2D(depthMap,uv).r*48.;
        vec3 waves=texture2D(waterMap,p*.045+vec2(time*.003,-time*.002)).rgb;
        vec3 crossWaves=texture2D(waterMap,p*.071+vec2(-time*.002,time*.003)).rgb;
        float swell=texture2D(waterMap,p*.005+vec2(time*.0006,0.)).r;
        vec3 deep=vec3(.006,.051,.078),shallow=vec3(.025,.24,.18);
        vec3 color=mix(shallow,deep,smoothstep(0.,30.,distanceToShore));
        color*=.83+swell*.48;
        vec2 slope=(waves.gb+crossWaves.gb-1.)*.48;
        vec3 normal=normalize(vec3(slope.x,1.,slope.y));
        vec3 sun=normalize(vec3(-.55,1.,-.6)),view=normalize(eye-worldPosition);
        float spec=pow(max(0.,dot(normal,normalize(sun+view))),90.);
        float glitter=smoothstep(.73,.94,crossWaves.r);
        color+=vec3(1.,.91,.65)*(spec*.14+glitter*.025);
        float swellLine=sin(distanceToShore*2.1-time*1.35+waves.r*3.);
        float foam=(1.-smoothstep(.1,4.,distanceToShore))*smoothstep(.18,.9,swellLine)*(.45+crossWaves.r*.4);
        vec2 relative=p-ship;float along=dot(relative,direction),side=dot(relative,vec2(-direction.y,direction.x));
        // Follow the 1.5-scale hull: the prow is 7.95 units ahead of its origin.
        along/=hullScale;side/=hullScale;
        float behindBow=8.05-along;
        float spread=sqrt(max(behindBow,0.))*1.15;
        float bowEdge=1.-smoothstep(.12,.52,abs(abs(side)-spread));
        float bowLength=smoothstep(-.15,.35,behindBow)*(1.-smoothstep(8.,15.,behindBow));
        float bow=bowEdge*bowLength*clamp(speed,0.,1.)*(.46+waves.r*.54);
        color=mix(color,vec3(.72,.88,.77),clamp(foam*.75+bow*.55,0.,.8));
        float cloud=smoothstep(.55,.82,swell);
        color*=1.-cloud*.16;
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new T.Mesh(new T.PlaneGeometry(extent*2,extent*2),material);
  mesh.rotation.x=-Math.PI/2;mesh.position.set(origin.x,0,origin.z);scene.add(mesh);
  return {update(time, camera, position, heading, speed, hullScale=1) {
    uniforms.time.value=time;uniforms.eye.value.copy(camera.position);uniforms.ship.value.set(position.x,position.z);
    uniforms.direction.value.set(Math.sin(heading),-Math.cos(heading));uniforms.speed.value=speed;uniforms.hullScale.value=hullScale;
  }, material,mesh};
}

const clamp01=x=>Math.min(1,Math.max(0,x));
const smooth=(a,b,x)=>{const t=clamp01((x-a)/(b-a));return t*t*(3-2*t);};
export const WAKE_LIFETIME=14;
export function wakeOpacity(age,speed){return smooth(0,.25,age)*(1-smooth(2,WAKE_LIFETIME,age))*clamp01(speed);}

export function createWakeHistory(){
  let samples=[],lastEmission=-Infinity,lastPosition=null;
  return {
    get samples(){return samples;},
    clear(){samples=[];lastEmission=-Infinity;lastPosition=null;},
    update(time,position,heading,speed,hullScale=1){
      samples=samples.filter(p=>time-p.time<WAKE_LIFETIME);
      const moved=lastPosition?Math.hypot(position.x-lastPosition.x,position.z-lastPosition.z):0;
      if(moved>20){samples=[];lastEmission=-Infinity;}
      // At most ten samples/second keeps the complete fade inside the fixed buffer.
      if(lastPosition&&moved>.0001&&moved<=20&&speed>.015&&time-lastEmission>=.1-1e-6){
        const dx=Math.sin(heading),dz=-Math.cos(heading);
        samples.push({x:position.x-dx*6.75*hullScale,z:position.z-dz*6.75*hullScale,dx,dz,time,speed:clamp01(speed),hullScale});lastEmission=time;
      }
      lastPosition={x:position.x,z:position.z};return samples;
    }
  };
}

export function createShipWake(scene,waterMap){
  const history=createWakeHistory(),capacity=160*6;
  const geometry=new T.BufferGeometry(),positions=new Float32Array(capacity*3),sides=new Float32Array(capacity),opacity=new Float32Array(capacity);
  for(const [name,data,size] of [['position',positions,3],['wakeSide',sides,1],['wakeOpacity',opacity,1]])geometry.setAttribute(name,new T.BufferAttribute(data,size).setUsage(T.DynamicDrawUsage));
  geometry.setDrawRange(0,0);
  const material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,
    uniforms:{waterMap:{value:waterMap},time:{value:0}},
    vertexShader:`attribute float wakeSide,wakeOpacity;varying float sideValue,alphaValue;varying vec2 seaPosition;
      void main(){sideValue=wakeSide;alphaValue=wakeOpacity;seaPosition=position.xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform sampler2D waterMap;uniform float time;varying float sideValue,alphaValue;varying vec2 seaPosition;
      void main(){
        float grain=texture2D(waterMap,seaPosition*.12+vec2(time*.008,-time*.006)).r;
        float edge=1.-smoothstep(.7,1.,abs(sideValue));
        float crest=1.-smoothstep(.04,.25,abs(abs(sideValue)-(.60+(grain-.5)*.28)));
        float wash=(1.-smoothstep(0.,.65,abs(sideValue)))*(.4+grain*.6);
        float foam=(crest*smoothstep(.27,.68,grain)*.28+wash*.24)*edge;
        gl_FragColor=vec4(vec3(.55,.79,.75),alphaValue*foam);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  const mesh=new T.Mesh(geometry,material);mesh.frustumCulled=false;scene.add(mesh);
  return {
    get active(){return history.samples.length>0;},
    clear(){history.clear();geometry.setDrawRange(0,0);},
    update(time,position,heading,speed,reduced=false,hullScale=1){
      const samples=history.update(time,position,heading,speed,hullScale);let count=0;
      const point=(p,side)=>{const age=time-p.time,width=1.65*p.hullScale+age*.32;return {x:p.x-p.dz*width*side,z:p.z+p.dx*width*side,side,alpha:wakeOpacity(age,p.speed)};};
      for(let i=1;i<samples.length;i++){
        const a=samples[i-1],b=samples[i];
        if(b.time-a.time>.45||Math.hypot(b.x-a.x,b.z-a.z)>12)continue;
        const leftA=point(a,-1),rightA=point(a,1),leftB=point(b,-1),rightB=point(b,1);
        for(const p of [leftA,rightA,leftB,leftB,rightA,rightB]){
          if(count>=capacity)break;positions[count*3]=p.x;positions[count*3+1]=.055;positions[count*3+2]=p.z;sides[count]=p.side;opacity[count]=p.alpha;count++;
        }
      }
      geometry.attributes.position.needsUpdate=true;geometry.attributes.wakeSide.needsUpdate=true;geometry.attributes.wakeOpacity.needsUpdate=true;geometry.setDrawRange(0,count);material.uniforms.time.value=reduced?0:time;
    }
  };
}
