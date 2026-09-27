const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
// One soft land tile per 16 chart units, shared by coast caps and relief.
export const landUV=point=>({u:point.x/16,v:-point.y/16});

export function coastSampler(M,extent){
  const rings=M.E.N.G.rings.map(r=>r.map(([x,y])=>M.local({x,y}))),segments=[];
  for(const ring of rings)for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length];
    if(Math.min(a.x,b.x)>extent+50||Math.max(a.x,b.x)<-extent-50||Math.min(a.z,b.z)>extent+50||Math.max(a.z,b.z)<-extent-50)continue;
    const dx=b.x-a.x,dz=b.z-a.z;segments.push({x:a.x,z:a.z,dx,dz,length:dx*dx+dz*dz});
  }
  function coastDistance(x,z){
    let nearest=1000000;
    for(const a of segments){const px=x-a.x,pz=z-a.z,t=a.length?clamp((px*a.dx+pz*a.dz)/a.length,0,1):0,dx=px-a.dx*t,dz=pz-a.dz*t;nearest=Math.min(nearest,dx*dx+dz*dz);}
    return Math.sqrt(nearest);
  }
  return{rings,coastDistance,textureUV:(x,z)=>landUV(M.world({x,z})),isLand:(x,z)=>!M.E.N.isSea(M.world({x,z})),elevation:(x,z)=>1.2+Math.min(9,coastDistance(x,z)*.09)*(.65+.35*Math.sin(x*.027+z*.015)**2)};
}

// Small slices also provide a responsive fallback when module workers are unavailable.
export function* terrainSteps(sampler,extent,{size=256,step=4}={}){
  const {coastDistance,isLand,elevation,textureUV}=sampler,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++){
    for(let x=0;x<size;x++){const px=(x/(size-1)*2-1)*extent,pz=(y/(size-1)*2-1)*extent,k=(y*size+x)*4;
      data[k]=Math.round(clamp(coastDistance(px,pz)/48,0,1)*255);data[k+1]=isLand(px,pz)?0:255;data[k+3]=255;
    }
    if(y%4===3)yield;
  }
  const count=Math.floor(extent*2/step)+1,points=new Float32Array(count*count*3),uv=new Float32Array(count*count*2),flags=new Uint8Array(count*count),indices=[];
  for(let z=0;z<count;z++){
    for(let x=0;x<count;x++){const px=-extent+x*step,pz=-extent+z*step,i=z*count+x,t=textureUV(px,pz);points.set([px,elevation(px,pz),pz],i*3);uv.set([t.u,t.v],i*2);flags[i]=isLand(px,pz)?1:0;}
    if(z%4===3)yield;
  }
  for(let z=0;z<count-1;z++)for(let x=0;x<count-1;x++){const a=z*count+x,b=a+1,c=a+count,d=c+1;if(flags[a]&&flags[c]&&flags[b])indices.push(a,c,b);if(flags[b]&&flags[c]&&flags[d])indices.push(b,c,d);}
  return{size,data,points,uv,indices:new Uint32Array(indices)};
}

export function terrainData(sampler,extent,options){const steps=terrainSteps(sampler,extent,options);let next;do{next=steps.next();}while(!next.done);return next.value;}

export async function terrainDataAsync(sampler,extent,options){
  const steps=terrainSteps(sampler,extent,options);let next;
  do{next=steps.next();if(!next.done)await new Promise(resolve=>setTimeout(resolve,0));}while(!next.done);
  return next.value;
}
