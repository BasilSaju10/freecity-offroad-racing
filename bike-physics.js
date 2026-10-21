import {vehicleSpeedLimit} from './vehicle-limits.js';
export function bikeSteeringLimit(speed,wheelbase){return .42/(1+Math.abs(speed)*.025);}
export function configureBikeWheels(C,vehicle,profile,scale){
 vehicle.wheelInfos.length=0;
 for(let i=0;i<2;i++)vehicle.addWheel({radius:(i?profile.rearRadius:profile.radius)*scale,directionLocal:new C.Vec3(0,-1,0),axleLocal:new C.Vec3(1,0,0),chassisConnectionPointLocal:new C.Vec3(0,.12*scale,(i?1:-1)*profile.wheelbase*scale/2),suspensionStiffness:profile.stiffness,suspensionRestLength:profile.restLength*scale,dampingRelaxation:profile.rebound,dampingCompression:profile.compression,maxSuspensionForce:8500,maxSuspensionTravel:profile.travel*scale,frictionSlip:2.8,rollInfluence:.02});
}
const arcadeMotion=new WeakMap();
const approach=(value,target,step)=>value+Math.max(-step,Math.min(step,target-value));
export function bikeControls(C,vehicle,chassis,tuning,map,input,dt){
 const forward=chassis.quaternion.vmult(new C.Vec3(0,0,-1));forward.y=0;forward.normalize();
 const speed=chassis.velocity.dot(forward),contacts=vehicle.wheelInfos.filter(w=>w.isInContact).length;
 const limit=bikeSteeringLimit(speed,tuning.wheelbase);
 input.steering=approach(input.steering,input.turn*limit,dt*1.8);
 const turn=input.steering/limit;
 vehicle.setSteeringValue(input.steering,0);vehicle.setSteeringValue(0,1);
 // Raycast wheels provide terrain contact and visible spring travel only.
 // Player input owns propulsion and steering, without tyre-slip or surface drag forces.
 for(let i=0;i<2;i++){vehicle.applyEngineForce(0,i);vehicle.setBrake(0,i);vehicle.wheelInfos[i].frictionSlip=0;vehicle.wheelInfos[i].rollInfluence=0;}
 const braking=input.throttle*speed<-.3,reverse=input.throttle<0&&!braking;
 const target=input.handbrake||braking||!input.throttle?0:reverse?-1.55:vehicleSpeedLimit(tuning);
 const acceleration=input.handbrake?18:braking?12:!input.throttle?6:reverse?2.5:tuning.engineForce*1.5/tuning.mass;
 const commandedSpeed=approach(speed,target,acceleration*dt);
 arcadeMotion.set(chassis,{commandedSpeed});
 if(contacts){
  chassis.velocity.x=forward.x*commandedSpeed;chassis.velocity.z=forward.z*commandedSpeed;
  const yaw=turn*Math.sign(commandedSpeed)*Math.min(1.5,Math.abs(commandedSpeed)*.45);
  chassis.angularVelocity.y+=(yaw-chassis.angularVelocity.y)*(1-Math.exp(-dt*18));
 }
 // A small controlled bank is an animation response, independent of centrifugal force.
 const up=chassis.quaternion.vmult(new C.Vec3(0,1,0)),right=chassis.quaternion.vmult(new C.Vec3(1,0,0));
 const rollAxis=chassis.quaternion.vmult(new C.Vec3(0,0,-1)),flatRight=new C.Vec3(-forward.z,0,forward.x);
 const bank=contacts?-turn*.20*Math.min(Math.abs(commandedSpeed)/5,1):0;
 const roll=Math.atan2(up.dot(flatRight),Math.max(.01,up.y));
 const rollRate=chassis.angularVelocity.dot(rollAxis),bankRate=Math.max(-1.4,Math.min(1.4,(bank-roll)*10));
 chassis.angularVelocity.vadd(rollAxis.scale(bankRate-rollRate),chassis.angularVelocity);
 if(contacts===2){
  const a=vehicle.wheelInfos[0].raycastResult.hitPointWorld,b=vehicle.wheelInfos[1].raycastResult.hitPointWorld;
  const slope=Math.atan2(a.y-b.y,tuning.wheelbase),pitch=Math.asin(Math.max(-1,Math.min(1,chassis.quaternion.vmult(new C.Vec3(0,0,-1)).y)));
  const pitchRate=chassis.angularVelocity.dot(right),targetRate=Math.max(-2,Math.min(2,(slope-pitch)*8));
  chassis.angularVelocity.vadd(right.scale(targetRate-pitchRate),chassis.angularVelocity);
 }
 return input.steering;
}

// Follow the player's heading with no drift; preserve vertical suspension and obstacle collisions.
export function stabilizeBikeTraction(C,vehicle,chassis,tuning,dt){
 if(!vehicle.wheelInfos.some(w=>w.isInContact))return;
 const forward=chassis.quaternion.vmult(new C.Vec3(0,0,-1));forward.y=0;if(forward.lengthSquared()<1e-8)return;forward.normalize();
 let speed=Math.hypot(chassis.velocity.x,chassis.velocity.z)*Math.sign(chassis.velocity.dot(forward)||1);
 if(arcadeMotion.get(chassis)?.commandedSpeed===0&&Math.abs(speed)<.3)speed=0;
 chassis.velocity.x=forward.x*speed;chassis.velocity.z=forward.z*speed;
}
