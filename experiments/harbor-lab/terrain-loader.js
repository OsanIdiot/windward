import {coastSampler,terrainDataAsync} from './terrain-data.js';

export function createTerrainLoader(N){
  let worker,serial=0;const pending=new Map();
  const disable=()=>{worker?.terminate();worker=null;for(const job of pending.values()){clearTimeout(job.timer);job.reject(Error('Terrain worker unavailable'));}pending.clear();};
  try{
    worker=new Worker(new URL('./terrain-worker.js',import.meta.url),{type:'module'});
    worker.onerror=event=>{event.preventDefault();disable();};
    worker.onmessage=({data})=>{const job=pending.get(data.id);if(!job)return;pending.delete(data.id);clearTimeout(job.timer);data.error?job.reject(Error(data.error)):job.resolve(data.result);};
  }catch(_){worker=null;}
  return{get mode(){return worker?'worker':'sliced';},async load(center,scale,extent,step){
    if(worker){try{return await new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(disable,10000);pending.set(id,{resolve,reject,timer});try{worker.postMessage({id,center,scale,extent,step});}catch(error){disable();}});}catch(_){disable();}}
    const M={E:{N},local:p=>({x:(p.x-center.x)*scale,z:(p.y-center.y)*scale}),world:p=>({x:p.x/scale+center.x,y:p.z/scale+center.y})};
    return terrainDataAsync(coastSampler(M,extent),extent,{step});
  }};
}
