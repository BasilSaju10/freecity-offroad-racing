import assert from 'node:assert/strict';
import * as C from './vendor/cannon-es.js';
import {configureBikeWheels,bikeControls,stabilizeBikeTraction} from './bike-physics.js';
import {bikeProfiles} from './bike-profiles.js';
import {readFileSync} from 'node:fs';
const createHull=new Function('C',readFileSync('main.js','utf8').match(/^function createSUVHull.*$/m)[0]+';return createSUVHull;')(C);
for(const [id,profile] of Object.entries(bikeProfiles)){
 const p={...profile},world=new C.World({gravity:new C.Vec3(0,-9.81,0)});world.solver.iterations=15;
 const ground=new C.Body({mass:0});ground.addShape(new C.Box(new C.Vec3(1000,.5,1000)),new C.Vec3(0,-.5,0));world.addBody(ground);
 const body=new C.Body({mass:p.mass,angularDamping:.28});body.addShape(createHull(p.hullWidth,p.hullLength,p.hullTop));body.position.y=.65;world.addBody(body);
 const vehicle=new C.RaycastVehicle({chassisBody:body,indexRightAxis:0,indexUpAxis:1,indexForwardAxis:2});vehicle.world=world;configureBikeWheels(C,vehicle,p,1);assert.equal(vehicle.wheelInfos.length,2);
 world.addEventListener('postStep',()=>stabilizeBikeTraction(C,vehicle,body,p,1/120));
 let steering=0,minUp=1;
 function step(throttle=0,turn=0,handbrake=false){steering=bikeControls(C,vehicle,body,p,{applyWheelSurface(){}},{throttle,turn,handbrake,steering},1/120);vehicle.updateVehicle(1/120);world.step(1/120);const up=body.quaternion.vmult(new C.Vec3(0,1,0)).y;minUp=Math.min(minUp,up);assert(Number.isFinite(body.position.y));}
 for(let i=0;i<240;i++)step();assert(vehicle.wheelInfos.every(w=>w.isInContact));assert(vehicle.wheelInfos.every(w=>w.suspensionLength<p.restLength),'springs settle under rider/bike load');
 const before=body.position.clone();for(let i=0;i<600;i++)step(1,i>360?.25:0);assert(body.position.distanceTo(before)>15,'accelerates over ground');
 const accel=body.velocity.length();for(let i=0;i<720;i++)step(-1);const reverse=body.velocity.dot(body.quaternion.vmult(new C.Vec3(0,0,-1)));assert(reverse<0&&reverse> -2,'reverse stays at foot-pushing speed');
 console.log(id,{accelKmh:accel*3.6,reverseKmh:reverse*3.6,minUp,height:body.position.y});assert(minUp>.65,'rider balances while turning');
 const bytes=readFileSync(new URL(profile.url,import.meta.url));const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));for(const name of ['Body','Wheel_F','Wheel_R','Handlebars','FrontFork','Swingarm'])assert(json.nodes.some(n=>n.name===name),id+' '+name);
}
console.log('Bike physics: two sprung wheels, load compression, acceleration, balancing, braking and walking reverse passed.');

