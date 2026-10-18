// Wheel/water intersection and distance-based emission, independent of rendering.
export function createWaterSplashState(map,emit,onEntry=()=>{}){
 const wheels=Array.from({length:4},()=>({wet:false,known:false,x:0,z:0,drops:0,foam:0,sheet:0}));
 let current=null;
 function reset(){current=null;for(const w of wheels)Object.assign(w,{wet:false,known:false,drops:0,foam:0,sheet:0});}
 function update(key,vehicle,chassis,tuning,dt){
  if(key!==current){reset();current=key;}
  const alreadyInWater=wheels.some(w=>w.wet);let entry=null;
  const speed=Math.hypot(chassis.velocity.x,chassis.velocity.z),impact=Math.max(0,-(chassis.velocity.y||0)),q=chassis.quaternion;
  const rightX=1-2*(q.y*q.y+q.z*q.z),rightZ=2*(q.x*q.z-q.y*q.w);
  vehicle.wheelInfos.forEach((wheel,i)=>{
   const state=wheels[i],p=wheel.worldTransform.position,radius=wheel.radius||tuning.radius;
   const pool=map.meta.pools.find(s=>((p.x-s.x)/s.rx)**2+((p.z-s.z)/s.rz)**2<1&&s.y>map.heightAt(p.x,p.z)+.015);
   const wet=!!pool&&p.y-radius<pool.y+.035&&p.y+radius>pool.y-.35;
   const jumped=state.known&&Math.hypot(p.x-state.x,p.z-state.z)>Math.max(5,speed*dt*3+2);
   if(jumped){state.wet=wet;state.drops=state.foam=state.sheet=0;}
   if(wet&&(speed>.35||impact>1.2)){
    const immersion=Math.min(1,Math.max(0,(pool.y-p.y+radius)/(radius*.8)));
    const strength=Math.min(1,Math.hypot(speed,impact*1.3)/16)*(.3+.7*immersion),side=i%2?1:-1;
    const at={x:p.x,y:pool.y+.025,z:p.z,vx:chassis.velocity.x,vz:chassis.velocity.z,sx:rightX*side,sz:rightZ*side,speed,strength};
    if(state.known&&!state.wet&&!jumped){if(!entry||strength>entry.strength)entry=at;emit('sheet',at);emit('foam',at);for(let j=0;j<4+Math.floor(strength*12);j++)emit('drop',at);}
    state.drops+=dt*Math.min(25,speed*2.2)*(.35+.65*immersion);
    state.foam+=speed*dt/1.8;state.sheet+=dt*Math.min(5,speed*.35)*immersion;
    while(state.drops>=1){emit('drop',at);state.drops--;}
    while(state.foam>=1){emit('foam',at);state.foam--;}
    while(state.sheet>=1){emit('sheet',at);state.sheet--;}
   }else state.drops=state.foam=state.sheet=0;
   state.wet=wet;state.known=true;state.x=p.x;state.z=p.z;
  });
  if(entry&&!alreadyInWater)onEntry(entry);
 }
 return {update,reset,wheels};
}
