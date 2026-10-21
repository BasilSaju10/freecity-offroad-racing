export function createPivotBurnout(C){
 const local=new C.Vec3(),front=new C.Vec3(),rendered=new C.Vec3(),yaw=new C.Quaternion(),up=new C.Vec3(0,1,0);
 let anchor=null,rate=0,waiting=0,steer=0;
 function reset(){anchor=null;rate=0;waiting=0;steer=0;}
 function constrain(body,profile){if(!anchor)return;local.set(0,0,-profile.wheelbase/2);body.quaternion.vmult(local,front);body.position.x=anchor.x-front.x;body.position.z=anchor.z-front.z;body.velocity.x=body.velocity.z=0;body.angularVelocity.y=0;body.aabbNeedsUpdate=true;}
 function update(enabled,body,vehicle,profile,turn,dt){
  if(!enabled||profile.bike||vehicle.wheelInfos.length!==4){reset();return false;}
  if(!anchor){
   if(Math.hypot(body.velocity.x,body.velocity.z)>.15||!vehicle.wheelInfos.some(w=>w.isInContact)){reset();return false;}
   waiting+=dt;
   // Hold the stopped car during the two-second burnout preparation.
   if(waiting<2-1e-9){for(let i=0;i<4;i++){vehicle.applyEngineForce(0,i);vehicle.setBrake(120,i);}return true;}
   local.set(0,0,-profile.wheelbase/2);body.quaternion.vmult(local,front);anchor={x:body.position.x+front.x,z:body.position.z+front.z};}
  steer+=(turn*.4-steer)*(1-Math.exp(-dt*7));
  rate+=(-turn*.72-rate)*(1-Math.exp(-dt*7));yaw.setFromAxisAngle(up,rate*dt);yaw.mult(body.quaternion,body.quaternion);body.quaternion.normalize();body.wakeUp();
  for(let i=0;i<4;i++){vehicle.setSteeringValue(i<2?steer:0,i);vehicle.applyEngineForce(i<2?0:(profile.engineForce||3300),i);vehicle.setBrake(i<2&&Math.abs(rate)<.001?120:0,i);vehicle.wheelInfos[i].frictionSlip=i<2?7:.08;}
  constrain(body,profile);return true;
 }
 // Apply the same pivot to interpolated rendering. Linear position interpolation
 // with a slerped rotation otherwise makes the front appear to slide between ticks.
 function renderPosition(position,rotation,profile){rendered.copy(position);if(anchor){local.set(0,0,-profile.wheelbase/2);rotation.vmult(local,front);rendered.x=anchor.x-front.x;rendered.z=anchor.z-front.z;}return rendered;}
 return {update,constrain,renderPosition,reset,get steering(){return steer;},get preparing(){return waiting>0&&!anchor;},get rate(){return rate;},get active(){return !!anchor;}};
}
