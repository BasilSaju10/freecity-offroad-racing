export function nearestTrackPose(trail,position,forward){
 if(Array.isArray(trail[0])){let best=null,distance=Infinity;for(const path of trail){const p=nearestTrackPose(path,position,forward);if(p){const d=(p.x-position.x)**2+(p.z-position.z)**2;if(d<distance){best=p;distance=d;}}}return best;}
 let best=null,distance=Infinity;
 for(let i=0;i<trail.length-1;i++){
  const a=trail[i],b=trail[i+1],dx=b.x-a.x,dz=b.z-a.z,length2=dx*dx+dz*dz;if(length2<1e-8)continue;
  const t=Math.max(0,Math.min(1,((position.x-a.x)*dx+(position.z-a.z)*dz)/length2));
  const x=a.x+t*dx,z=a.z+t*dz,d=(x-position.x)**2+(z-position.z)**2;
  if(d<distance){const sign=forward&&forward.x*dx+forward.z*dz<0?-1:1;best={x,z,yaw:Math.atan2(-dx*sign,-dz*sign)};distance=d;}
 }
 return best;
}
