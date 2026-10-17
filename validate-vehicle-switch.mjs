import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import * as C from './vendor/cannon-es.js';
process.chdir(fileURLToPath(new URL('.',import.meta.url)));
const source=readFileSync('main.js','utf8');
const definitions=source.slice(source.indexOf('const vehicleProfiles='),source.indexOf('let activeVehicleId='));
const profiles=new Function(definitions+'return vehicleProfiles;')();
const setup=source.slice(source.indexOf('const tuning='),source.indexOf('const bodyVisual='));
const apply=source.slice(source.indexOf('function applyVehicleProfile('),source.indexOf('async function loadCar('));
const factory=new Function('C','world','const testingGround={};'+setup+`const steeringAxis={set(){return this},normalize(){}};const dashboardDisplay={setLocalPosition(){},setLocalScale(){}};const camPos={y:12};const wheelState=Array.from({length:4},()=>({spin:7,length:.3}));let resets=0;function reset(){resets++;}${apply};return{chassis,tuning,vehicle,camPos,wheelState,applyVehicleProfile,get resets(){return resets}};`);
let transitions=0;
for(const before of Object.values(profiles))for(const after of Object.values(profiles)){
 const r=factory(C,new C.World());r.applyVehicleProfile(before);
 r.chassis.position.set(73,19,-111);r.chassis.quaternion.setFromEuler(.1,1.3,-.08);r.chassis.velocity.set(12,-.4,-8);r.chassis.angularVelocity.set(.1,.2,.3);
 const q=r.chassis.quaternion.clone(),ride=r.tuning.rideHeight;r.applyVehicleProfile(after,true);
 assert.equal(r.resets,1,'only initial load resets to spawn');assert.equal(r.chassis.position.x,73);assert.equal(r.chassis.position.z,-111);
 assert(Math.abs(r.chassis.position.y-(19+r.tuning.rideHeight-ride))<1e-9,'ride clearance adjusted without respawning');
 assert.deepEqual(r.chassis.quaternion,q,'heading and slope orientation preserved');assert.deepEqual(r.chassis.velocity,new C.Vec3(12,-.4,-8),'momentum preserved');assert.deepEqual(r.chassis.angularVelocity,new C.Vec3(.1,.2,.3));
 assert.deepEqual(r.chassis.previousPosition,r.chassis.position,'no interpolation back to old location');assert.deepEqual(r.chassis.interpolatedPosition,r.chassis.position);
 assert(r.wheelState.every(w=>w.length===r.tuning.restLength&&w.spin===7),'wheel animation remains continuous');
 assert.deepEqual(r.tuning.eye,after.cockpitEye.map(v=>v*1.12),'model-specific cockpit uses matching scale');transitions++;
}
const report={passed:true,transitions,roadPositionPreserved:true,headingPreserved:true,momentumPreserved:true,cockpitProfiles:Object.keys(profiles)};
writeFileSync('vehicle-switch-validation.json',JSON.stringify(report,null,2));console.log(report);
