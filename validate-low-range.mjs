import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import * as C from './vendor/cannon-es.js';
import {createDriveSoundSequence} from './drive-sound-sequence.js';
import {vehicleSpeedLimit,enforceVehicleSpeedLimit} from './vehicle-limits.js';
import {minimapPoint} from './minimap.js';
const source=readFileSync('main.js','utf8'),setup=source.slice(source.indexOf('const tuning='),source.indexOf('const bodyVisual=')),controls=source.slice(source.indexOf('function controls('),source.indexOf('// Capture suspension'));
const factory=new Function('C','world','testingGround','vehicleSpeedLimit','createDriveSoundSequence',setup+`const driveGearSequence=createDriveSoundSequence(),keys=new Set();let steering=0;const signedSpeed=()=>chassis.velocity.dot(chassis.quaternion.vmult(new C.Vec3(0,0,-1)));${controls};return{chassis,vehicle,tuning,keys,controls};`);
function simulate(lowRange,angle=0,seconds=12){
 const world=new C.World({gravity:new C.Vec3(0,-9.81,0)});world.solver.iterations=15;
 const plane=new C.Body({mass:0,shape:new C.Plane()});plane.quaternion.setFromEuler(-Math.PI/2+angle,0,0);world.addBody(plane);
 const map={applyWheelSurface(v,body,tuning,i){v.wheelInfos[i].frictionSlip=1.65;}},r=factory(C,world,map,vehicleSpeedLimit,createDriveSoundSequence);r.tuning.lowRange=lowRange;r.chassis.position.set(0,.9,0);r.chassis.quaternion.setFromEuler(angle,0,0);
 world.addEventListener('preStep',()=>{r.controls(1/120);r.vehicle.updateVehicle(1/120);});
 let maxKmh=0;world.addEventListener('postStep',()=>{enforceVehicleSpeedLimit(r.chassis,r.tuning,r.vehicle.wheelInfos.some(w=>w.isInContact));maxKmh=Math.max(maxKmh,r.chassis.velocity.length()*3.6);});
 for(let i=0;i<120;i++)world.step(1/120);const start=r.chassis.position.clone();
 r.keys.add('KeyW');
 for(let i=0;i<seconds*120;i++)world.step(1/120);
 return {r,world,maxKmh,distance:-r.chassis.position.z+start.z,climb:r.chassis.position.y-start.y};
}
const low=simulate(true,0,18),high=simulate(false,0,40);
assert(low.maxKmh<=15.001,'low range caps actual driving speed');assert(low.maxKmh>12,'low range remains usable');
assert(high.maxKmh>70&&high.maxKmh<=80.1,'high range retains normal SUV speed');
const lowHill=simulate(true,35*Math.PI/180,6),highHill=simulate(false,35*Math.PI/180,6);
assert(lowHill.climb>3,'low range climbs a steep slope');assert(lowHill.climb>highHill.climb+2,'low range has more climbing ability than high');assert(lowHill.maxKmh<=15.001,'15 km/h cap also applies along a slope');
const downhill=simulate(true,-35*Math.PI/180,8);assert(downhill.maxKmh<=15.001,'downhill speed remains capped');
for(const p of [{},{truck:true},{bike:true}]){assert.equal(vehicleSpeedLimit({...p,lowRange:true}),15/3.6);}
const airborne={velocity:{x:20,y:-30,z:0}};enforceVehicleSpeedLimit(airborne,{lowRange:true},false);assert.equal(airborne.velocity.y,-30,'gear does not slow falling');
const b={minX:-256,maxX:255,minZ:-255,maxZ:256};assert.deepEqual(minimapPoint(b,-256,-255),{x:0,y:0});assert.deepEqual(minimapPoint(b,255,256),{x:192,y:192});assert.deepEqual(minimapPoint(b,-.5,.5),{x:96,y:96});
const report={passed:true,lowMaxKmh:low.maxKmh,highMaxKmh:high.maxKmh,slopeDegrees:35,lowClimbMetres:lowHill.climb,highClimbMetres:highHill.climb,downhillMaxKmh:downhill.maxKmh,minimapCoordinateMapping:true};writeFileSync('low-range-validation.json',JSON.stringify(report,null,2));console.log(report);
