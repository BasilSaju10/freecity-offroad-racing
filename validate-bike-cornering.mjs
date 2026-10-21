import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as C from './vendor/cannon-es.js';
import {bikeProfiles} from './bike-profiles.js';
import {configureBikeWheels,bikeControls,stabilizeBikeTraction} from './bike-physics.js';
const createHull=new Function('C',readFileSync('main.js','utf8').match(/^function createSUVHull.*$/m)[0]+';return createSUVHull;')(C);
for(const [id,p] of Object.entries(bikeProfiles))for(const turn of [-1,1]){
 const world=new C.World({gravity:new C.Vec3(0,-9.81,0)});world.solver.iterations=15;
 const ground=new C.Body({mass:0});ground.addShape(new C.Box(new C.Vec3(1000,.5,1000)),new C.Vec3(0,-.5,0));world.addBody(ground);
 const body=new C.Body({mass:p.mass,angularDamping:.28});body.addShape(createHull(p.hullWidth,p.hullLength,p.hullTop));body.position.y=.65;world.addBody(body);
 const vehicle=new C.RaycastVehicle({chassisBody:body,indexRightAxis:0,indexUpAxis:1,indexForwardAxis:2});vehicle.world=world;configureBikeWheels(C,vehicle,p,1);
 world.addEventListener('postStep',()=>stabilizeBikeTraction(C,vehicle,body,p,1/120));
 let steering=0,maxSlip=0,minUp=1,yaw=0;
 function step(throttle,turn){const prior=steering,q=body.quaternion.clone();steering=bikeControls(C,vehicle,body,p,{applyWheelSurface(){throw Error('arcade controls must not apply simulated surface drag');}},{throttle,turn,handbrake:false,steering},1/120);assert(Math.abs(steering-prior)<=1.8/120+1e-8,'steering remains responsive with smooth movement');assert.deepEqual(body.quaternion,q,'lean integrates instead of snapping orientation');vehicle.updateVehicle(1/120);world.step(1/120);}
 for(let i=0;i<240;i++)step(0,0);for(let i=0;i<400;i++)step(1,0);
 const entrySpeed=Math.hypot(body.velocity.x,body.velocity.z);let minimumSpeed=entrySpeed;
 for(let i=0;i<480;i++){
  step(1,turn);const f=body.quaternion.vmult(new C.Vec3(0,0,-1));f.y=0;f.normalize();const right=new C.Vec3(-f.z,0,f.x);
  if(i>30&&vehicle.wheelInfos[1].isInContact)maxSlip=Math.max(maxSlip,Math.abs(body.velocity.dot(right)));
  minUp=Math.min(minUp,body.quaternion.vmult(new C.Vec3(0,1,0)).y);yaw+=body.angularVelocity.y/120;
  minimumSpeed=Math.min(minimumSpeed,Math.hypot(body.velocity.x,body.velocity.z));
 }
 assert(minimumSpeed>entrySpeed*.9,'turning does not brake the bike or make it stick');
 assert(turn*yaw>.5,'turn direction follows controls');assert(maxSlip<.15,id+' movement follows heading without drifting');assert(minUp>.95,'arcade bike stays balanced while cornering');
 console.log(id,turn<0?'right':'left',{maxRearSlipMps:maxSlip,minUp,yawRadians:yaw});
 const vertical=body.velocity.y,horizontal=Math.hypot(body.velocity.x,body.velocity.z);stabilizeBikeTraction(C,vehicle,body,p,1/120);assert.equal(body.velocity.y,vertical,'traction preserves suspension velocity');assert(Math.abs(Math.hypot(body.velocity.x,body.velocity.z)-horizontal)<1e-8,'grip correction preserves horizontal speed');
 vehicle.wheelInfos.forEach(w=>w.isInContact=false);const velocity=body.velocity.clone();stabilizeBikeTraction(C,vehicle,body,p,1/120);assert(body.velocity.almostEquals(velocity),'no grip assistance in the air');
 vehicle.wheelInfos.forEach(w=>w.isInContact=true);for(let i=0;i<1200;i++)step(0,0);assert(body.velocity.length()<.2,'releasing the controls brings the bike to rest');assert(Math.abs(body.angularVelocity.y)<.05,'releasing steering stops automatic turning');
}
