// Assisted oversteer: conserve forward motion, let the rear slide, and ease grip back.
export function createShiftDrift(C){
 let amount=0;
 const forward=new C.Vec3(),right=new C.Vec3(),desired=new C.Vec3();
 function reset(){amount=0;}
 function update(enabled,body,vehicle,profile,turn,dt){
  body.quaternion.vmult(new C.Vec3(0,0,-1),forward);forward.y=0;forward.normalize();
  const speed=body.velocity.dot(forward),grounded=vehicle.wheelInfos.filter(w=>w.isInContact).length>=2;
  if(profile.bike||vehicle.wheelInfos.length!==4||!grounded){reset();return false;}
  const requested=enabled&&speed>=25/3.6&&Math.abs(turn)>.01;
  amount+=((requested?1:0)-amount)*(1-Math.exp(-dt*(requested?4:6)));
  if(amount<.001){amount=0;return false;}
  for(let i=0;i<4;i++){
   const w=vehicle.wheelInfos[i];w.frictionSlip*=i<2?1+amount*.15:1-amount*.78;
   if(i<2)vehicle.setSteeringValue(w.steering+(-turn*.16-w.steering)*amount,i);
  }
  if(speed>0){
   right.set(-forward.z,0,forward.x);
   const planarSpeed=Math.hypot(body.velocity.x,body.velocity.z),angle=turn*.34*amount;
   forward.scale(planarSpeed*Math.cos(angle),desired);right.scale(planarSpeed*Math.sin(angle),right);desired.vadd(right,desired);
   const mix=1-Math.exp(-dt*2.4*amount);
   body.velocity.x+=(desired.x-body.velocity.x)*mix;body.velocity.z+=(desired.z-body.velocity.z)*mix;
   body.angularVelocity.y+=(turn*.9*amount-body.angularVelocity.y)*(1-Math.exp(-dt*30*amount));
  }
  return requested;
 }
 return {update,reset,get amount(){return amount;}};
}
