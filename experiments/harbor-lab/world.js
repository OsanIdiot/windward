import * as T from './vendor/three.module.min.js';
import {createPaintedTown} from './painted.js';
export const noise=(x,y)=>{const n=Math.sin(x*12.9898+y*78.233)*43758.5453;return n-Math.floor(n);};
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export function createWorld(scene,M,art,options={}) {
  const extent=options.extent||260,segments=[];
  const rings=M.E.N.G.rings.map(r=>r.map(([x,y])=>M.local({x,y})));
  for(const ring of rings) for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length];
    if(Math.min(a.x,b.x)>extent+50||Math.max(a.x,b.x)<-extent-50||Math.min(a.z,b.z)>extent+50||Math.max(a.z,b.z)<-extent-50)continue;
    segments.push([a,b]);
  }
  function coastDistance(x,z) {
    let d=1000;
    for(const [a,b] of segments){const dx=b.x-a.x,dz=b.z-a.z,l=dx*dx+dz*dz,t=l?clamp(((x-a.x)*dx+(z-a.z)*dz)/l,0,1):0;d=Math.min(d,Math.hypot(x-a.x-dx*t,z-a.z-dz*t));}
    return d;
  }
  const isLand=(x,z)=>!M.E.N.isSea(M.world({x,z}));
  const elevation=(x,z)=>1.2+Math.min(9,coastDistance(x,z)*.09)*( .65+.35*Math.sin(x*.027+z*.015)**2);
  const size=256,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const px=(x/(size-1)*2-1)*extent,pz=(y/(size-1)*2-1)*extent,k=(y*size+x)*4;
    data[k]=Math.round(clamp(coastDistance(px,pz)/48,0,1)*255);data[k+1]=isLand(px,pz)?0:255;data[k+2]=0;data[k+3]=255;
  }
  const depth=new T.DataTexture(data,size,size,T.RGBAFormat);depth.minFilter=depth.magFilter=T.LinearFilter;depth.needsUpdate=true;
  function texture(kind) {
    const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');
    g.fillStyle={land:'#b4b290',wall:'#eee4d2',roof:'#a97055',wood:'#aa8053',sail:'#f7efdb'}[kind];g.fillRect(0,0,256,256);
    if(kind==='land')for(let i=0;i<150;i++){const x=noise(i,51)*256,y=noise(i,52)*256,r=5+noise(i,53)*25;const patch=g.createRadialGradient(x,y,0,x,y,r);patch.addColorStop(0,i%3?'#49634d55':'#ead8b57a');patch.addColorStop(1,'#49634d00');g.fillStyle=patch;g.fillRect(x-r,y-r,r*2,r*2);}
    for(let i=0;i<4500;i++){const x=noise(i,2)*256,y=noise(i,3)*256;g.fillStyle=i%2?'#ffffff12':'#172c2c12';g.fillRect(x,y,1+noise(i,4)*5,1+noise(i,5)*3);}
    if(kind==='roof'||kind==='wood'||kind==='wall'||kind==='sail') {
      const rows=kind==='sail'?32:16;g.strokeStyle=kind==='sail'?'#9c8a5b33':'#37291e35';g.lineWidth=1;
      for(let y=0;y<256;y+=rows){g.beginPath();g.moveTo(0,y);g.lineTo(256,y);g.stroke();if(kind==='wall'||kind==='roof')for(let x=0;x<256;x+=32){g.beginPath();g.moveTo(x+(y%32),y);g.lineTo(x+(y%32),y+rows);g.stroke();}}
    }
    const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=2;return t;
  }
  const terrainTexture=texture('land');terrainTexture.repeat.set(12,12);
  const surfaceMat=new T.MeshStandardMaterial({color:'#d0cfb0',map:terrainTexture,roughness:1});
  const cliffMat=new T.MeshStandardMaterial({color:'#d6c29a',map:texture('wall'),roughness:1});
  function clip(poly,axis,limit,less) {
    const out=[];
    for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ai=less?a[axis]<=limit:a[axis]>=limit,bi=less?b[axis]<=limit:b[axis]>=limit;if(ai)out.push(a);if(ai!==bi){const t=(limit-a[axis])/(b[axis]-a[axis]);out.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});}}
    return out;
  }
  for(const ring of rings){
    let poly=ring;for(const [axis,limit,less] of [['x',-extent,false],['x',extent,true],['z',-extent,false],['z',extent,true]])poly=clip(poly,axis,limit,less);
    if(poly.length<3)continue;
    const shape=new T.Shape(poly.map(p=>new T.Vector2(p.x,-p.z)));
    const geo=new T.ExtrudeGeometry(shape,{depth:2,bevelEnabled:false,steps:1});geo.rotateX(-Math.PI/2);geo.translate(0,-.8,0);
    const mesh=new T.Mesh(geo,[surfaceMat,cliffMat]);mesh.receiveShadow=true;scene.add(mesh);
  }
  // Higher inland relief is independent of the exact collision coastline.
  const points=[],uv=[],indices=[],step=4,count=Math.floor(extent*2/step)+1,landFlags=[];
  for(let z=0;z<count;z++)for(let x=0;x<count;x++){const px=-extent+x*step,pz=-extent+z*step;points.push(px,elevation(px,pz),pz);uv.push(x/(count-1),z/(count-1));landFlags.push(isLand(px,pz));}
  for(let z=0;z<count-1;z++)for(let x=0;x<count-1;x++){const a=z*count+x,b=a+1,c=a+count,d=c+1;if(landFlags[a]&&landFlags[c]&&landFlags[b])indices.push(a,c,b);if(landFlags[b]&&landFlags[c]&&landFlags[d])indices.push(b,c,d);}
  const terrain=new T.BufferGeometry();terrain.setAttribute('position',new T.Float32BufferAttribute(points,3));terrain.setAttribute('uv',new T.Float32BufferAttribute(uv,2));terrain.setIndex(indices);terrain.computeVertexNormals();const terrainMesh=new T.Mesh(terrain,surfaceMat);terrainMesh.receiveShadow=true;scene.add(terrainMesh);
  if(art){
    let portPosition=null;
    if(options.town!==false){
      const center=options.townCenter||{x:0,z:0},town=new T.Group();town.position.set(center.x,0,center.z);scene.add(town);
      portPosition=createPaintedTown(town,{isLand:(x,z)=>isLand(x+center.x,z+center.z),coastDistance:(x,z)=>coastDistance(x+center.x,z+center.z),elevation:(x,z)=>elevation(x+center.x,z+center.z)},art).add(town.position);
    }
    return {extent,depth,coastDistance,isLand,elevation,portPosition,materials:art};
  }
  const material=(color,map)=>new T.MeshStandardMaterial({color,map,roughness:.86});
  const wall=material('#fff7e4',texture('wall')),roof=material('#e5c7ad',texture('roof')),dark=material('#334743'),wood=material('#c8a26e',texture('wood')),stone=material('#eee1c5',texture('wall')),leaf=material('#637c49');
  const batches=[];
  function batch(geo,mat,capacity){const mesh=new T.InstancedMesh(geo,mat,capacity);mesh.count=0;mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);batches.push(mesh);return mesh;}
  const walls=batch(new T.BoxGeometry(1,1,1),wall,170),roofs=batch(new T.ConeGeometry(.71,1,4).rotateY(Math.PI/4),roof,170),windows=batch(new T.BoxGeometry(1,1,1),dark,750),trees=batch(new T.IcosahedronGeometry(1,1),leaf,450),trunks=batch(new T.CylinderGeometry(.1,.16,1,5),wood,180),rocks=batch(new T.DodecahedronGeometry(1,0),cliffMat,250),paths=batch(new T.BoxGeometry(1,1,1),stone,180),details=batch(new T.BoxGeometry(1,1,1),stone,650);
  const temp=new T.Object3D();
  function instance(mesh,x,y,z,sx,sy,sz,angle=0,color=null){const id=mesh.count;if(id>=mesh.instanceMatrix.count)return;temp.position.set(x,y,z);temp.scale.set(sx,sy,sz);temp.rotation.set(0,angle,0);temp.updateMatrix();mesh.setMatrixAt(id,temp.matrix);if(color)mesh.setColorAt(id,new T.Color(color));mesh.count++;}
  // Town grows landward from the Lisbon anchorage; all footprints are checked against the real mask.
  const buildings=[];
  for(let z=-64;z<15;z+=6.5)for(let x=-15;x<60;x+=6.5){
    const n=noise(x,z),px=x+(n-.5)*2,pz=z+(noise(z,x)-.5)*2;
    if(n<.2||!isLand(px,pz)||coastDistance(px,pz)<3||coastDistance(px,pz)>30)continue;
    const sx=2.7+n*1.8,sz=3+noise(x,3)*2,h=2.8+noise(z,7)*3.8,y=elevation(px,pz),angle=Math.round(noise(x,8)*2)*.16;
    if(![[-sx/2,-sz/2],[sx/2,-sz/2],[-sx/2,sz/2],[sx/2,sz/2]].every(([dx,dz])=>isLand(px+dx,pz+dz)))continue;
    instance(walls,px,y+h/2,pz,sx,h,sz,angle,['#eee0bf','#ddd8ba','#f6e4bd'][Math.floor(n*3)]);
    instance(roofs,px,y+h+.8,pz,sx*1.12,1.6,sz*1.12,angle);
    for(const dx of [-.7,.7])for(let floor=1;floor<h-.2;floor+=1.55){instance(windows,px+dx,y+floor,pz+sz/2+.04,.48,.72,.1,angle);instance(details,px+dx,y+floor-.43,pz+sz/2+.14,.7,.12,.25,angle);}
    instance(details,px,y+.35,pz,sx+.2,.7,sz+.2,angle);instance(details,px+sx*.25,y+h+1.2,pz,.45,1.1,.5,angle);
    instance(windows,px,y+.6,pz+sz/2+.05,.65,1.2,.13,angle);buildings.push({x:px,z:pz,y});
  }
  for(let i=0;i<buildings.length;i++){const a=buildings[i];const b=buildings.slice(i+1).filter(b=>Math.hypot(b.x-a.x,b.z-a.z)<9).sort((b,c)=>Math.hypot(b.x-a.x,b.z-a.z)-Math.hypot(c.x-a.x,c.z-a.z))[0];if(!b)continue;if(![.2,.4,.6,.8].every(t=>isLand(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t)))continue;const x=(a.x+b.x)/2,z=(a.z+b.z)/2;instance(paths,x,elevation(x,z)+.03,z,.8,.07,Math.hypot(a.x-b.x,a.z-b.z),Math.atan2(b.x-a.x,b.z-a.z));}
  for(let i=0;i<650;i++){
    const x=(noise(i,11)*2-1)*150,z=(noise(i,12)*2-1)*150;
    if(!isLand(x,z)||coastDistance(x,z)<3||buildings.some(b=>Math.hypot(x-b.x,z-b.z)<4))continue;
    const h=2+noise(i,13)*3,y=elevation(x,z);
    instance(trunks,x,y+h*.25,z,.9,h*.7,.9);instance(trees,x,y+h,z,1.4+noise(i,14),h*.65,1.3+noise(i,15),i,['#48633d','#688051','#7f8751'][i%3]);
    if(trunks.count>=160)break;
  }
  for(let i=0;i<1600&&rocks.count<210;i++){
    const x=(noise(i,21)*2-1)*130,z=(noise(i,22)*2-1)*130,d=coastDistance(x,z);
    if(!isLand(x,z)||d<.5||d>5)continue;
    const r=Math.min(d*.75,.7+noise(i,23)*1.7);instance(rocks,x,.6,z,r,1+noise(i,24)*2,r*.8,i);
  }
  function box(parent,sx,sy,sz,x,y,z,mat=stone){const m=new T.Mesh(new T.BoxGeometry(sx,sy,sz),mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
  // A land-bound watchtower is decorative: no false navigable quay protrudes into the collision sea.
  const towerPoint=buildings.reduce((best,b)=>Math.hypot(b.x,b.z)<Math.hypot(best.x,best.z)?b:best,{x:20,z:-30,y:2});
  const tower=new T.Group();tower.position.set(towerPoint.x,towerPoint.y,towerPoint.z);scene.add(tower);
  box(tower,4.5,1.4,4.5,0,.7,0);box(tower,3.1,7,3.1,0,4.5,0);box(tower,3.9,.6,3.9,0,8.3,0);box(tower,2.4,1.8,2.4,0,9.5,0);
  const cap=new T.Mesh(new T.ConeGeometry(2,2,4).rotateY(Math.PI/4),roof);cap.position.y=11.3;tower.add(cap);
  for(const x of [-.7,.7])box(tower,.5,.9,.08,x,7,1.6,dark);
  box(tower,.8,1.8,.1,0,1.6,1.6,dark);
  for(const mesh of batches){mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();}
  return {extent,depth,coastDistance,isLand,elevation,portPosition:new T.Vector3(towerPoint.x,towerPoint.y+13,towerPoint.z),materials:{wood,roof,stone,dark,sail:material('#fff4d4',texture('sail'))}};
}

export function createShip(scene,materials) {
  const root=new T.Group(),body=new T.Group();root.add(body);scene.add(root);
  const {wood,dark,sail}=materials;
  const hullMat=new T.MeshStandardMaterial({color:'#684123',roughness:.73}),trim=new T.MeshStandardMaterial({color:'#d1ac66',roughness:.5,metalness:.25});
  const shape=new T.Shape();shape.moveTo(0,5.3);shape.bezierCurveTo(1.9,3.7,2.1,-1.4,1.3,-4.2);shape.lineTo(-1.3,-4.2);shape.bezierCurveTo(-2.1,-1.4,-1.9,3.7,0,5.3);
  const hullGeometry=new T.ExtrudeGeometry(shape,{depth:.9,bevelEnabled:true,bevelSegments:2,bevelSize:.3,bevelThickness:.5,steps:1});hullGeometry.rotateX(-Math.PI/2);
  const hull=new T.Mesh(hullGeometry,hullMat);hull.position.y=.1;hull.castShadow=true;body.add(hull);
  const deckGeometry=new T.ShapeGeometry(shape);deckGeometry.rotateX(-Math.PI/2);const deck=new T.Mesh(deckGeometry,wood);deck.position.y=1.06;deck.receiveShadow=true;body.add(deck);
  function box(sx,sy,sz,x,y,z,mat){const m=new T.Mesh(new T.BoxGeometry(sx,sy,sz),mat);m.position.set(x,y,z);m.castShadow=true;body.add(m);return m;}
  const line=(pts,mat=trim,r=.035)=>{const curve=new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(...p)));const m=new T.Mesh(new T.TubeGeometry(curve,pts.length*3,r,4,false),mat);body.add(m);return m;};
  for(let x=-1.5;x<=1.5;x+=.3)line([[x,1.075,-2.8],[x,1.075,3.3]],hullMat,.012);
  box(2.4,1.1,1.8,0,1.55,2.8,wood);box(2.7,.15,2,0,2.17,2.8,trim);
  for(const x of [-.7,0,.7])box(.35,.45,.08,x,1.6,3.74,dark);
  box(1.1,.25,1.3,0,1.3,.3,dark);
  for(const side of [-1,1]){line([[side*1.2,1.45,3.8],[side*1.8,1.5,1],[side*1.65,1.5,-2],[side*.65,1.45,-4.3]],trim,.05);for(let z=-2;z<=3;z++)box(.06,.4,.06,side*1.75,1.27,z,trim);}
  const sails=[];
  for(const [z,height,width] of [[-1.8,6.4,5.3],[1.6,5.2,4.8]]) {
    const mast=new T.Mesh(new T.CylinderGeometry(.075,.11,height,8),wood);mast.position.set(0,1+height/2,z);mast.castShadow=true;body.add(mast);
    const y=height+.2;line([[-width/2,y,z],[width/2,y,z]],wood,.075);
    const geo=new T.PlaneGeometry(width,2.8,14,10),position=geo.attributes.position;
    const base=[];
    for(let i=0;i<position.count;i++){const x=position.getX(i),py=position.getY(i);const curve=Math.sin((x/width+.5)*Math.PI)*Math.sin((py/2.8+.5)*Math.PI);position.setXYZ(i,x*(.92+py*.025),py,-curve*.95);base.push(position.getZ(i));}
    geo.computeVertexNormals();const cloth=sail.clone();cloth.side=T.DoubleSide;const mesh=new T.Mesh(geo,cloth);mesh.position.set(0,y-1.35,z);mesh.castShadow=true;body.add(mesh);sails.push({mesh,base});
    for(const side of [-1,1]){line([[0,height+1,z],[side*1.7,1.3,z+1]],dark,.017);line([[side*width/2,y,z],[side*1.65,1.3,z+1.2]],dark,.018);}
  }
  line([[0,1.4,-4],[0,2.1,-6.4]],wood,.065);
  const foresailGeo=new T.BufferGeometry();foresailGeo.setAttribute('position',new T.Float32BufferAttribute([0,6.8,-1.8,0,2.1,-6.3,-.2,2.4,-2],3));foresailGeo.computeVertexNormals();const foresail=new T.Mesh(foresailGeo,new T.MeshStandardMaterial({color:'#eadcbc',side:T.DoubleSide,roughness:1}));body.add(foresail);
  const flag=new T.Mesh(new T.PlaneGeometry(1.4,.6,5,2),new T.MeshStandardMaterial({color:'#a94e32',side:T.DoubleSide}));flag.position.set(.65,7.5,-1.8);body.add(flag);
  return {root,body,update(time,heading,speed,reduced){root.rotation.y=-heading;body.rotation.z=reduced?0:Math.sin(time*1.3)*(.018+speed*.012);body.rotation.x=reduced?0:Math.sin(time*.9)*.013;body.position.y=reduced?0:Math.sin(time*1.1)*.1;
    for(const {mesh,base} of sails){const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++)p.setZ(i,base[i]+(reduced?0:Math.sin(time*2+p.getX(i)*2)*.06*Math.abs(base[i])));p.needsUpdate=true;}
    flag.rotation.y=reduced?0:Math.sin(time*2.3)*.18;
  }};
}
