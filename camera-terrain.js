export const exteriorPitchLimits={min:.08,max:1.20};

// Stop the camera boom at the first terrain obstruction. This also handles hills
// between the vehicle and camera, instead of lifting the camera through the hill.
export function constrainCameraToTerrain(anchor,position,heightAt,clearance=.65){
 const dx=position.x-anchor.x,dy=position.y-anchor.y,dz=position.z-anchor.z;
 const length=Math.hypot(dx,dy,dz),steps=Math.max(1,Math.ceil(length/.20));
 let safe=0;
 for(let i=1;i<=steps;i++){
  const t=i/steps,x=anchor.x+dx*t,y=anchor.y+dy*t,z=anchor.z+dz*t;
  if(y<heightAt(x,z)+clearance){
   let lo=safe,hi=t;
   for(let n=0;n<9;n++){const mid=(lo+hi)/2;if(anchor.y+dy*mid>=heightAt(anchor.x+dx*mid,anchor.z+dz*mid)+clearance)lo=mid;else hi=mid;}
   position.x=anchor.x+dx*lo;position.y=anchor.y+dy*lo;position.z=anchor.z+dz*lo;
   break;
  }
  safe=t;
 }
 // Correct an old camera position after a reset, vehicle swap, or terrain rise.
 position.y=Math.max(position.y,heightAt(position.x,position.z)+clearance);
 return position;
}
