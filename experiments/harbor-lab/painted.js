import * as T from './vendor/three.module.min.js';

const noise=(x,y)=>{const n=Math.sin(x*12.9898+y*78.233)*43758.5453;return n-Math.floor(n);};
const box=new T.BoxGeometry(1,1,1);

// Paint surface detail once. Navigation and camera rotation still use real geometry.
export async function loadPaintedMaterials(){
  const image=new Image();image.src=new URL('./painted-materials.webp',import.meta.url).href;await image.decode();
  function swatch(x,y){const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');g.drawImage(image,x*image.width/2,y*image.height/2,image.width/2,image.height/2,0,0,512,512);return c;}
  function texture(c){const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=2;return t;}
  function material(color,map){return new T.MeshLambertMaterial({color,map,vertexColors:true});}
  const plaster=swatch(0,0),wood=swatch(0,1),roof=swatch(1,0),linen=swatch(1,1);
  function facade(warehouse=false){
    const c=swatch(0,0),g=c.getContext('2d');
    g.fillStyle='#b09a7455';g.fillRect(0,465,512,47);g.fillStyle='#51483644';g.fillRect(0,0,512,27);
    for(const y of warehouse?[94]:[74,248])for(const x of [66,218,370]){
      g.fillStyle='#826c4f';g.fillRect(x-7,y-8,86,112);g.fillStyle='#e4d2ab';g.fillRect(x-3,y-4,78,104);
      g.fillStyle='#303c39';g.fillRect(x+6,y+6,60,87);g.fillStyle='#6d7b68';g.fillRect(x+7,y+9,25,81);
      g.fillStyle='#26322e';for(let line=0;line<7;line++)g.fillRect(x+8,y+14+line*10,23,2);
      g.fillStyle='#d1b282';g.fillRect(x+35,y+6,4,88);g.fillRect(x+6,y+49,60,4);
      g.fillStyle='#75613e88';g.fillRect(x-12,y+107,99,11);g.fillStyle='#ead8b8';g.fillRect(x-14,y+101,101,7);
    }
    const dx=warehouse?120:216,dw=warehouse?272:83,dy=warehouse?250:387,dh=512-dy;
    g.fillStyle='#6d5940';g.fillRect(dx-9,dy-8,dw+18,dh+8);g.drawImage(wood,dx,dy,dw,dh);g.fillStyle='#172b2899';g.fillRect(dx+dw*.49,dy,3,dh);
    g.fillStyle='#2d322a';g.fillRect(dx,dy+dh*.35,dw,5);g.fillRect(dx,dy+dh*.78,dw,5);
    return material('#f5eedb',texture(c));
  }
  const shade=document.createElement('canvas');shade.width=shade.height=64;const g=shade.getContext('2d'),gradient=g.createRadialGradient(32,32,8,32,32,32);gradient.addColorStop(0,'#14271dcc');gradient.addColorStop(1,'#14271d00');g.fillStyle=gradient;g.fillRect(0,0,64,64);
  const shadow=new T.MeshBasicMaterial({map:texture(shade),transparent:true,opacity:.32,depthWrite:false,vertexColors:true});
  return {wall:material('#eee6d2',texture(plaster)),facade:facade(),warehouse:facade(true),roof:material('#d5b09a',texture(roof)),wood:material('#c9a475',texture(wood)),hull:material('#8c5b36',texture(wood)),sail:material('#fff3d5',texture(linen)),trim:material('#d8b875'),dark:material('#3e4c43'),red:material('#914a34'),leaf:material('#657257'),stone:material('#c6bd9e',texture(plaster)),shadow};
}

// Merge static details by material, keeping hundreds of small details to a few draws.
export function batchGeometry(parent){
  const buckets=new Map(),dummy=new T.Object3D(),normalMatrix=new T.Matrix3(),v=new T.Vector3(),n=new T.Vector3();
  function add(geometry,materials,position=[0,0,0],scale=[1,1,1],rotation=[0,0,0],tint='#ffffff'){
    dummy.position.fromArray(position);dummy.scale.fromArray(scale);dummy.rotation.set(...rotation);dummy.updateMatrix();normalMatrix.getNormalMatrix(dummy.matrix);
    const p=geometry.attributes.position,normal=geometry.attributes.normal,uv=geometry.attributes.uv,index=geometry.index,color=new T.Color(tint);
    const groups=Array.isArray(materials)?geometry.groups:[{start:0,count:index?index.count:p.count,materialIndex:0}];
    for(const group of groups){const material=Array.isArray(materials)?materials[group.materialIndex]:materials;let b=buckets.get(material);if(!b){b={p:[],n:[],uv:[],c:[]};buckets.set(material,b);}
      for(let i=group.start;i<group.start+group.count;i++){const j=index?index.getX(i):i;v.fromBufferAttribute(p,j).applyMatrix4(dummy.matrix);n.fromBufferAttribute(normal,j).applyMatrix3(normalMatrix).normalize();b.p.push(v.x,v.y,v.z);b.n.push(n.x,n.y,n.z);b.uv.push(uv?uv.getX(j):0,uv?uv.getY(j):0);b.c.push(color.r,color.g,color.b);}
    }
  }
  function finish(){for(const [material,b] of buckets){const geometry=new T.BufferGeometry();for(const [name,data,size] of [['position',b.p,3],['normal',b.n,3],['uv',b.uv,2],['color',b.c,3]])geometry.setAttribute(name,new T.Float32BufferAttribute(data,size));geometry.computeBoundingSphere();const mesh=new T.Mesh(geometry,material);mesh.castShadow=!material.transparent;mesh.receiveShadow=!material.transparent;parent.add(mesh);}return buckets.size;}
  return {add,finish,box:(material,p,s,r=[0,0,0],tint)=>add(box,material,p,s,r,tint)};
}

function gableGeometry(){
  const geo=new T.BufferGeometry(),p=[],uv=[];
  const a=[-.5,0,-.5],b=[.5,0,-.5],c=[0,1,-.5],d=[-.5,0,.5],e=[.5,0,.5],f=[0,1,.5];
  const triangles=[[a,d,c],[c,d,f],[b,c,e],[c,f,e],[a,c,b],[d,e,f]],coords=[[0,0,0,1,1,0],[1,0,0,1,1,1],[0,0,1,0,0,1],[1,0,1,1,0,1],[0,0,.5,1,1,0],[0,0,1,0,.5,1]];
  triangles.forEach((tri,i)=>{for(const point of tri)p.push(...point);uv.push(...coords[i]);});
  geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.computeVertexNormals();return geo;
}

export function createPaintedTown(scene,terrain,art){
  const {isLand,coastDistance,elevation}=terrain,root=new T.Group();root.name='painted-town';scene.add(root);
  const b=batchGeometry(root),roofGeo=gableGeometry(),buildings=[],shadowGeo=new T.PlaneGeometry(1,1);
  function footprint(x,z,sx,sz,angle){return [[-sx/2,-sz/2],[sx/2,-sz/2],[-sx/2,sz/2],[sx/2,sz/2],[0,0]].every(([dx,dz])=>isLand(x+dx*Math.cos(angle)+dz*Math.sin(angle),z-dx*Math.sin(angle)+dz*Math.cos(angle)));}
  for(let z=-72;z<17;z+=8)for(let x=-19;x<64;x+=7){
    const n=noise(x,z),px=x+(n-.5)*1.4,pz=z+(noise(z,x)-.5)*2;
    if(n<.13||!isLand(px,pz)||coastDistance(px,pz)<3||coastDistance(px,pz)>34)continue;
    const warehouse=coastDistance(px,pz)<10,sx=warehouse?4.9:3.3+n*1.2,sz=warehouse?6:3.9+noise(x,3)*1.1,h=warehouse?3.4:4+noise(z,7)*2.5,angle=Math.round(noise(x,8)*3-1)*.14;
    if(!footprint(px,pz,sx+1,sz+1,angle))continue;
    buildings.push({x:px,z:pz,y:elevation(px,pz),sx,sz,h,angle,warehouse,n});
  }
  const towerPoint=buildings.reduce((best,p)=>Math.hypot(p.x,p.z)<Math.hypot(best.x,best.z)?p:best,{x:20,z:-30,y:elevation(20,-30)});
  for(const house of buildings){if(house===towerPoint)continue;const {x,z,y,sx,sz,h,angle,n,warehouse}=house,r=[0,angle,0];
    const point=(dx,dy,dz)=>[x+dx*Math.cos(angle)+dz*Math.sin(angle),y+dy,z-dx*Math.sin(angle)+dz*Math.cos(angle)];
    const facade=warehouse?art.warehouse:art.facade,facades=[facade,facade,art.wall,art.stone,facade,facade],tint=['#ffffff','#ded2b9','#e3c7b0','#cbd2ba'][Math.floor(n*4)];
    b.box(art.stone,point(0,.22,0),[sx+.35,.45,sz+.35],r);b.box(facades,point(0,h/2,0),[sx,h,sz],r,tint);
    b.box(art.hull,point(0,h+.02,0),[sx+.5,.16,sz+.4],r);b.add(roofGeo,art.roof,point(0,h+.1,0),[sx+.6,warehouse?1.6:2,sz+.5],r);
    b.box(art.wall,point(sx*.27,h+1.2,-sz*.25),[.55,1.5,.65],r);b.box(art.stone,point(sx*.27,h+2,-sz*.25),[.75,.14,.84],r);
    b.add(shadowGeo,art.shadow,point(.5,.035,.6),[sx*1.8,sz*1.7,1],[-Math.PI/2,0,-angle]);
    if(warehouse){
      b.box(art.sail,point(0,2.3,sz*.5+.65),[sx*.72,.07,1.4],[.18,angle,0],'#c6b697');
      for(const dx of [-sx*.36,sx*.36])b.box(art.wood,point(dx,1.1,sz*.5+1.1),[.1,2.2,.1],r);
      for(let i=0;i<3;i++){const p=point(sx*.5+.4,.35,-sz*.2+i*.8);if(isLand(p[0],p[2]))b.box(art.wood,p,[.65,.7,.65],r);}
    }
  }
  // Stone lanes are short ground patches, so they follow relief instead of floating across it.
  for(let i=0;i<buildings.length;i++){const a=buildings[i],c=buildings.slice(i+1).filter(p=>Math.hypot(p.x-a.x,p.z-a.z)<10).sort((p,q)=>Math.hypot(p.x-a.x,p.z-a.z)-Math.hypot(q.x-a.x,q.z-a.z))[0];if(!c)continue;
    for(let t=0;t<=1;t+=.12){const x=a.x+(c.x-a.x)*t,z=a.z+(c.z-a.z)*t;if(footprint(x,z,1.1,1.1,0))b.box(art.stone,[x,elevation(x,z)+.035,z],[1.05,.06,1.1]);}
  }
  const {x:tx,z:tz,y:ty}=towerPoint;
  const tower=(mat,x,y,z,sx,sy,sz)=>b.box(mat,[tx+x,ty+y,tz+z],[sx,sy,sz]);
  tower(art.stone,0,.4,0,5.6,.8,5.6);tower(art.wall,0,4.3,0,4.1,8,4.1);
  for(const y of [2,5.4,8.5])tower(art.stone,0,y,0,4.6,.22,4.6);
  for(const x of [-1.9,1.9])for(const z of [-1.9,1.9])tower(art.stone,x,4.4,z,.5,8.4,.5);
  tower(art.wall,0,9.3,0,3.1,2.1,3.1);
  for(const x of [-.65,.65]){tower(art.dark,x,9.5,1.58,.55,1.2,.06);tower(art.trim,x,9.08,1.63,.68,.1,.1);}
  b.add(roofGeo,art.roof,[tx,ty+10.5,tz],[4,2.1,4]);
  for(let i=0;i<4;i++)tower(art.stone,-2+i*1.34,8.9,2.2,.55,.6,.45);
  b.add(shadowGeo,art.shadow,[tx+.7,ty+.025,tz+1.3],[9,9,1],[-Math.PI/2,0,0]);
  const crown=new T.IcosahedronGeometry(1,1),trunk=new T.CylinderGeometry(.1,.16,1,5);
  let trees=0;
  for(let i=0;i<700&&trees<115;i++){const x=(noise(i,11)*2-1)*150,z=(noise(i,12)*2-1)*150;if(!isLand(x,z)||coastDistance(x,z)<4||buildings.some(p=>Math.hypot(x-p.x,z-p.z)<5))continue;const y=elevation(x,z),h=2+noise(i,13)*2;
    b.add(trunk,art.wood,[x,y+h*.35,z],[1,h*.7,1]);
    for(let j=0;j<3;j++)b.add(crown,art.leaf,[x+Math.sin(j*2)*.7,y+h+j*.35,z+Math.cos(j*2)*.5],[1.1,h*.48,1], [0,i,0],['#adb48b','#899979','#c4c59c'][j]);trees++;
  }
  const rock=new T.DodecahedronGeometry(1,0);let rocks=0;
  for(let i=0;i<1600&&rocks<150;i++){const x=(noise(i,21)*2-1)*130,z=(noise(i,22)*2-1)*130,d=coastDistance(x,z);if(!isLand(x,z)||d<.5||d>5)continue;const r=Math.min(d*.75,.7+noise(i,23)*1.7);b.add(rock,art.stone,[x,.6,z],[r,1+noise(i,24)*2,r*.8],[0,i,0]);rocks++;}
  b.finish();root.userData.buildings=buildings.length;return new T.Vector3(tx,ty+13,tz);
}

export function createPaintedShip(scene,art){
  const root=new T.Group(),body=new T.Group();root.name='painted-merchant-ship';root.add(body);scene.add(root);const b=batchGeometry(body);
  const ribs=[[-5.3,.03],[-4.4,.76],[-3,1.44],[-1.2,1.84],[1,1.9],[2.8,1.66],[4.2,1.22],[4.5,1.08]];
  const p=[],uv=[],indices=[],rings=12;
  for(let i=0;i<ribs.length;i++){const [z,w]=ribs[i];for(let j=0;j<=rings;j++){const a=j/rings*Math.PI;p.push(Math.cos(a)*w,1.45-Math.sin(a)*1.7+(i>5?(i-5)*.16:0),z);uv.push(j/rings,i/(ribs.length-1));}}
  for(let i=0;i<ribs.length-1;i++)for(let j=0;j<rings;j++){const a=i*(rings+1)+j,c=a+rings+1;indices.push(a,c,a+1,a+1,c,c+1);}
  const hull=new T.BufferGeometry();hull.setAttribute('position',new T.Float32BufferAttribute(p,3));hull.setAttribute('uv',new T.Float32BufferAttribute(uv,2));hull.setIndex(indices);hull.computeVertexNormals();b.add(hull,art.hull);
  const outline=new T.Shape();ribs.forEach(([z,w],i)=>i?outline.lineTo(w,-z):outline.moveTo(w,-z));[...ribs].reverse().forEach(([z,w])=>outline.lineTo(-w,-z));outline.closePath();
  const deck=new T.ShapeGeometry(outline);deck.rotateX(-Math.PI/2);const dp=deck.attributes.position,du=deck.attributes.uv;for(let i=0;i<dp.count;i++)du.setXY(i,(dp.getX(i)+2)/4,(dp.getZ(i)+5.3)/9.8);b.add(deck,art.wood,[0,1.45,0]);
  function rope(points,mat=art.trim,r=.023){const geo=new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),Math.max(6,points.length*4),r,4,false);b.add(geo,mat);}
  const gunwale=side=>ribs.map(([z,w],i)=>[w*side,1.6+(i>5?(i-5)*.16:0),z]);
  for(const side of [-1,1]){
    rope(gunwale(side),art.trim,.075);rope(gunwale(side).map(([x,y,z])=>[x,y+.38,z]),art.hull,.045);
    for(const [z,w] of ribs.slice(1)){b.box(art.trim,[side*w,1.74+(z>2.8?.23:0),z],[.055,.55,.065]);}
    for(const y of [.45,.92])rope(ribs.map(([z,w])=>[side*w*(y===.45?.86:.97),y,z]),art.trim,.033);
    for(let z=-2.8;z<3;z+=.78){b.box(art.dark,[side*(1.76-Math.abs(z)*.08),1.05,z],[.06,.22,.28]);}
  }
  b.box(art.hull,[0,1.94,3.2],[2.55,.95,2.15]);b.box(art.wood,[0,2.45,3.2],[2.75,.12,2.3]);
  for(const x of [-.78,-.26,.26,.78]){b.box(art.dark,[x,1.98,4.29],[.35,.43,.06]);b.box(art.trim,[x,1.98,4.34],[.035,.46,.03]);}
  for(const y of [1.66,2.24,2.49])b.box(art.trim,[0,y,4.35],[2.62,.055,.07]);
  for(const x of [-1.3,1.3])rope([[x,2.6,2.2],[x,2.6,4.3]],art.trim,.045);
  b.box(art.dark,[0,1.48,.4],[1.05,.1,1.3]);for(let z=-.15;z<1;z+=.15)b.box(art.wood,[0,1.55,z],[1.1,.04,.04]);
  for(let i=0;i<4;i++)b.box(art.wood,[.92,1.51+i*.17,1.46+i*.17],[.6,.1,.25]);
  const barrel=new T.CylinderGeometry(.22,.22,.55,8);for(const [x,z] of [[-1,1.5],[-.9,2.1],[1,-2.9]])b.add(barrel,art.hull,[x,1.76,z]);
  const sails=[];
  function sail(z,y,width,height,skew=0){
    const geo=new T.PlaneGeometry(width,height,12,8),p=geo.attributes.position,base=[];
    for(let i=0;i<p.count;i++){const x=p.getX(i),py=p.getY(i),u=x/width+.5,v=py/height+.5,billow=Math.sin(u*Math.PI)*Math.sin(v*Math.PI);p.setXYZ(i,x*(.83+v*.17)+skew*(1-v),py,-billow*.95);base.push(p.getZ(i));}
    geo.computeVertexNormals();const mat=art.sail.clone();mat.side=T.DoubleSide;mat.vertexColors=false;const mesh=new T.Mesh(geo,mat);mesh.position.set(0,y-height/2,z);mesh.castShadow=true;body.add(mesh);sails.push({mesh,base});
    rope([[-width/2,y,z],[0,y+.05,z],[width/2,y,z]],art.hull,.065);
    rope([[-width*.42,y-height,z],[0,y-height-.06,z],[width*.42,y-height,z]],art.trim,.027);
    for(const side of [-1,1])rope([[side*width/2,y,z],[side*1.55,1.7,z+1.25]],art.dark,.016);
  }
  for(const [z,h] of [[-1.1,8],[2.1,6.3]]){
    b.add(new T.CylinderGeometry(.055,.13,h,8),art.wood,[0,1.45+h/2,z]);
    for(const side of [-1,1]){rope([[0,h+1.25,z],[side*1.62,1.7,z+.6]],art.dark,.018);rope([[0,h+1.25,z],[side*1.5,1.7,z+1.4]],art.dark,.018);
      for(let i=1;i<9;i++){const t=i/10;rope([[side*1.62*(1-t),1.7+(h-.45)*t,z+.6*(1-t)],[side*1.5*(1-t),1.7+(h-.45)*t,z+1.4*(1-t)]],art.dark,.012);}}
    b.add(new T.CylinderGeometry(.42,.29,.28,10),art.hull,[0,h-.9,z]);
  }
  sail(-1.1,7.1,5.5,3.1);sail(-1.1,9.1,3.6,1.7);sail(2.1,6.8,4.4,2.9,.22);
  rope([[0,1.65,-4.4],[0,2.5,-6.35]],art.wood,.075);rope([[0,9.4,-1.1],[0,2.5,-6.35]],art.dark,.018);
  const jib=new T.BufferGeometry();jib.setAttribute('position',new T.Float32BufferAttribute([0,7.8,-1.3,0,2.55,-6.25,-.22,2.8,-1.9],3));jib.setAttribute('uv',new T.Float32BufferAttribute([.5,1,0,0,1,0],2));jib.computeVertexNormals();const jibMat=art.sail.clone();jibMat.side=T.DoubleSide;b.add(jib,jibMat);
  b.finish();
  const flag=new T.Mesh(new T.PlaneGeometry(1.15,.4,6,1),art.red);flag.material=art.red.clone();flag.material.side=T.DoubleSide;flag.material.vertexColors=false;flag.position.set(.56,9.55,-1.1);body.add(flag);
  root.userData.sailPanels=sails.length;
  return {root,body,update(time,heading,speed,reduced){root.rotation.y=-heading;body.rotation.z=reduced?0:Math.sin(time*1.3)*(.018+speed*.012);body.rotation.x=reduced?0:Math.sin(time*.9)*.013;body.position.y=reduced?0:Math.sin(time*1.1)*.1;
    for(const {mesh,base} of sails){const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++)p.setZ(i,base[i]+(reduced?0:Math.sin(time*2+p.getX(i)*2)*.065*Math.abs(base[i])));p.needsUpdate=true;}flag.rotation.y=reduced?0:Math.sin(time*2.3)*.18;
  }};
}
