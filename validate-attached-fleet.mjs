import {createPivotBurnout} from './pivot-burnout.js';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import * as C from './vendor/cannon-es.js';
import {attachedFleetProfiles} from './attached-fleet-profiles.js';
import {bikeProfiles} from './bike-profiles.js';
import {vehicleSpeedLimit,enforceVehicleSpeedLimit} from './vehicle-limits.js';
import {applyBurnoutDrift} from './burnout-drift.js';
import {createDriveSoundSequence} from './drive-sound-sequence.js';
import {vehicleIds} from './multiplayer-server.mjs';
const source=readFileSync(new URL('./main.js',import.meta.url),'utf8');
const base=new Function(source.slice(source.indexOf('const vehicleProfiles='),source.indexOf('let activeVehicleId='))+'return vehicleProfiles.suv;')();
const setup=source.slice(source.indexOf('const tuning='),source.indexOf('const bodyVisual='));
const controls='const pivotBurnout=('+createPivotBurnout.toString()+')(C);'+source.slice(source.indexOf('function controls('),source.indexOf('// Capture suspension'));
const apply=source.slice(source.indexOf('function applyVehicleProfile('),source.indexOf('async function loadCar('));
const factory=new Function('C','world','vehicleSpeedLimit','applyBurnoutDrift','createDriveSoundSequence','const testingGround={applyWheelSurface(v,b,t,i){v.wheelInfos[i].frictionSlip=2.5;}};'+setup+`
const steeringAxis={set(){return this;},normalize(){}};const dashboardDisplay={setLocalPosition(){},setLocalScale(){}};const camPos={y:0};
const wheelState=Array.from({length:4},()=>({spin:0}));const keys=new Set();let steering=0;const driveGearSequence=createDriveSoundSequence();
const signedSpeed=()=>chassis.velocity.dot(chassis.quaternion.vmult(new C.Vec3(0,0,-1)));function reset(){chassis.position.set(0,tuning.rideHeight+.1,0);}
${apply}${controls};return{chassis,vehicle,tuning,keys,controls,applyVehicleProfile};`);
const results={};
for(const [id,profile] of Object.entries(attachedFleetProfiles)){
 assert(vehicleIds.includes(id),'new model is valid in multiplayer');
 const b=readFileSync(new URL(profile.url,import.meta.url)),len=b.readUInt32LE(12),g=JSON.parse(b.subarray(20,20+len));
 assert(profile.originalMaterials,'source materials restored');if(id==='trail-scout')assert(!g.images?.length,'source Trail Scout uses PBR colours, without image textures');else assert(g.images?.length>0,id+' embedded original textures');
 for(const name of ['Body','Steering','Wheel_FL','Wheel_FR','Wheel_RL','Wheel_RR'])assert(g.nodes.some(n=>n.name===name),id+' '+name);
 if(id==='trail-scout')assert(g.nodes.some(n=>n.name==='Spare'),'rear spare kept as a fixed assembly');if(id==='rock-buggy'){assert(Math.abs(profile.steeringPosition[0])<.01);assert(Math.abs(profile.cockpitEye[0])<.01,'driver centred on single seat');assert(profile.cockpitEye[2]>.3,'driver behind steering wheel');}
 if(profile.originalSteering){const node=g.nodes.find(n=>n.name==='Steering');assert.deepEqual(node.translation,profile.steeringPosition,'original steering pivot matches hand position');assert(!node.rotation,'steering tilt is preserved in geometry');assert.equal(g.meshes[node.mesh].name,'Original rotating steering assembly');}
 for(const names of [profile.lamps.front,profile.lamps.rear])assert(g.materials.some(m=>names.some(n=>m.name.includes(n))),id+' lamp source material exists');
 const world=new C.World({gravity:new C.Vec3(0,-9.81,0)});world.addBody(new C.Body({mass:0,shape:new C.Plane(),quaternion:new C.Quaternion().setFromEuler(-Math.PI/2,0,0)}));
 const r=factory(C,world,vehicleSpeedLimit,applyBurnoutDrift,createDriveSoundSequence);r.applyVehicleProfile({...base,...profile});
 assert.equal(r.tuning.engineForce,base.engineForce);assert.equal(r.tuning.stiffness,base.stiffness);
 world.addEventListener('preStep',()=>{r.controls(1/120);r.vehicle.updateVehicle(1/120);});world.addEventListener('postStep',()=>enforceVehicleSpeedLimit(r.chassis,r.tuning));
 for(let i=0;i<240;i++)world.step(1/120);assert(r.vehicle.wheelInfos.every(w=>w.isInContact),id+' four road wheels contact ground');r.keys.add('KeyW');
 let maximum=0;for(let i=0;i<120*18;i++){world.step(1/120);maximum=Math.max(maximum,Math.hypot(r.chassis.velocity.x,r.chassis.velocity.z)*3.6);}
 const cap=profile.truck?70:80;assert(maximum>cap-8&&maximum<=cap+.01,id+' attainable capped speed');
 r.chassis.velocity.set(80,-5,60);enforceVehicleSpeedLimit(r.chassis,r.tuning);assert(Math.abs(Math.hypot(r.chassis.velocity.x,r.chassis.velocity.z)*3.6-cap)<1e-8);assert.equal(r.chassis.velocity.y,-5,'limiter preserves suspension and gravity');
 results[id]={limit:cap,topSpeedKmh:+maximum.toFixed(1),fourWheelsGrounded:true};
}
for(const p of Object.values(bikeProfiles))assert.equal(vehicleSpeedLimit(p)*3.6,90);
writeFileSync(new URL('./attached-fleet-validation.json',import.meta.url),JSON.stringify({passed:true,vehicles:results,motorcycleLimit:90},null,2));console.log(results);
