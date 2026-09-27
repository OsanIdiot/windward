import './geography.js';
import './navigation.js';
import {coastSampler,terrainData} from './terrain-data.js';

self.onmessage=({data:{id,center,scale,extent,step}})=>{
  try{
    const M={E:{N:self.SeaNavigation},local:p=>({x:(p.x-center.x)*scale,z:(p.y-center.y)*scale}),world:p=>({x:p.x/scale+center.x,y:p.z/scale+center.y})};
    const result=terrainData(coastSampler(M,extent),extent,{step});
    self.postMessage({id,result},[result.data.buffer,result.points.buffer,result.uv.buffer,result.indices.buffer]);
  }catch(error){self.postMessage({id,error:error.message});}
};
