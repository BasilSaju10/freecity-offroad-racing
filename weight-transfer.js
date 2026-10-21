// Smooth longitudinal load transfer through the existing suspension.
export function createWeightTransfer(C){
 const previousVelocity=new C.Vec3(),delta=new C.Vec3(),forward=new C.Vec3(),torque=new C.Vec3(),axis=new C.Vec3(1,0,0);
 let initialized=false,acceleration=0;
 function reset(){initialized=false;acceleration=0;}
 function update(body,vehicle,profile,dt,driving){
  if(profile.bike||vehicle.wheelInfos.length!==4){reset();return;}
  body.quaternion.vmult(new C.Vec3(0,0,-1),forward);
  body.velocity.vsub(previousVelocity,delta);previousVelocity.copy(body.velocity);
  if(!initialized){initialized=true;return;}
  const grounded=vehicle.wheelInfos.filter(w=>w.isInContact).length>=2;
  const measured=grounded&&driving?Math.max(-6,Math.min(6,delta.dot(forward)/dt)):0;
  acceleration+=(measured-acceleration)*(1-Math.exp(-dt*7));
  if(!grounded)return;
  // Positive local X raises the nose (-Z) and compresses the rear springs.
  body.quaternion.vmult(axis,torque);torque.scale(acceleration*body.mass*Math.min(.55,profile.wheelbase*.18)*2,torque);
  body.applyTorque(torque);
 }
 return {update,reset,get acceleration(){return acceleration;}};
}
