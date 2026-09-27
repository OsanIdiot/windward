const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

async function fixture(){
  const T=await import('./vendor/three.module.min.js'),P=await import('./painted.js');
  const art={};for(const name of ['wall','facade','warehouse','roof','wood','hull','sail','trim','dark','red','leaf','stone','shadow'])art[name]=new T.MeshLambertMaterial({vertexColors:true});
  art.shadow.transparent=true;return {T,P,art};
}
function checkGeometry(root){root.traverse(mesh=>{if(!mesh.isMesh)return;
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  for(const material of materials)if(material.vertexColors)assert.ok(mesh.geometry.attributes.color,'Painted materials must not turn black from missing vertex colors');
  for(const name of ['position','normal','uv'])for(const value of mesh.geometry.attributes[name]?.array||[])assert.ok(Number.isFinite(value));
});}
test('painted ship combines static detail and keeps three animated cream sail panels',async()=>{
  const {T,P,art}=await fixture(),scene=new T.Scene(),ship=P.createPaintedShip(scene,art);checkGeometry(scene);
  assert.equal(ship.root.userData.sailPanels,3);assert.equal(ship.root.name,'painted-merchant-ship');
  let draws=0;ship.root.traverse(mesh=>{if(mesh.isMesh)draws++;});assert.ok(draws<=14,`Ship draw budget: ${draws}`);
  const bounds=new T.Box3().setFromObject(ship.root),size=bounds.getSize(new T.Vector3());assert.ok(size.x<6&&size.z<12,'Original hull/sail footprint remains comparable');
  ship.update(2,Math.PI/2,.8,false);assert.equal(ship.root.rotation.y,-Math.PI/2);checkGeometry(scene);
  ship.update(9,0,0,true);assert.equal(ship.body.rotation.z,0);assert.equal(ship.body.position.y,0);
});
test('painted town is batched and preserves land checks for building footprints',async()=>{
  const {T,P,art}=await fixture(),scene=new T.Scene();let landChecks=0;
  const position=P.createPaintedTown(scene,{isLand:()=>{landChecks++;return true;},coastDistance:()=>8,elevation:()=>2},art);
  assert.ok(landChecks>100);assert.ok(Number.isFinite(position.y));checkGeometry(scene);
  assert.ok(scene.children[0].userData.buildings>10);assert.ok(scene.children[0].children.length<=13);
});
test('painted source asset ships locally at a bounded size',()=>{
  const file=path.join(__dirname,'painted-materials.webp'),data=fs.readFileSync(file);
  assert.equal(data.toString('ascii',0,4),'RIFF');assert.equal(data.toString('ascii',8,12),'WEBP');assert.ok(data.length<600000);
  assert.match(fs.readFileSync(path.join(__dirname,'server.cjs'),'utf8'),/painted-materials\.webp/);
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname,'painted.js'),'utf8'),/localStorage|sessionStorage|indexedDB/);
});
