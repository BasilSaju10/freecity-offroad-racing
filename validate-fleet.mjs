import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('.',import.meta.url)));
import * as C from './vendor/cannon-es.js';
import {createMapBroadphase} from './map-broadphase.js';
import {createMapPhysics} from './freecity-world.js';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const source=readFileSync('main.js','utf8'),meta=JSON.parse(readFileSync('assets/map/physics.json')),bytes=readFileSync('assets/map/heights.bin');
const definitions=source.slice(source.indexOf('const vehicleProfiles='),source.indexOf('let activeVehicleId=')),profiles=new Function(definitions+'return vehicleProfiles;')();
const setup=source.slice(source.indexOf('const tuning='),source.indexOf('const bodyVisual='));
const controls=source.slice(source.indexOf('function controls('),source.indexOf('// Capture suspension'));
const apply=source.slice(source.indexOf('function applyVehicleProfile('),source.indexOf('async function loadCar('));
const factory=new Function('C','world','testingGround',setup+`const keys=new Set();let steering=0;const steeringAxis={set(){return this;},normalize(){}};const dashboardDisplay={setLocalPosition(){},setLocalScale(){}};function reset(){};const signedSpeed=()=>chassis.velocity.dot(chassis.quaternion.vmult(new C.Vec3(0,0,-1)));${controls}${apply};return{keys,chassis,vehicle,tuning,controls,signedSpeed,applyVehicleProfile};`);
const reports=[];
for(const id of Object.keys(profiles)){
 const profile=profiles[id];for(const key of ['mass','restLength','stiffness','compression','rebound','travel','engineForce','brake','rearDrive'])assert.equal(profile[key],profiles.suv[key],id+' shared driving tune '+key);
 const glb=readFileSync(profile.url.replace('./','')),json=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString());
 for(const name of ['Wheel_FL','Wheel_FR','Wheel_RL','Wheel_RR']){const node=json.nodes.find(n=>n.name===name);assert(node&&node.mesh!==undefined,id+' '+name);let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const p of json.meshes[node.mesh].primitives){const a=json.accessors[p.attributes.POSITION];for(let j=0;j<3;j++){min[j]=Math.min(min[j],a.min[j]);max[j]=Math.max(max[j],a.max[j]);}}assert(max[0]-min[0]<profile.radius*1.2,'straight wheel axis');for(const j of [1,2]){assert(Math.abs((max[j]-min[j])/2-profile.radius)<.025,id+' wheel radius');assert(Math.abs((max[j]+min[j])/2)<.02,id+' centered wheel pivot');}}
 const world=new C.World({gravity:new C.Vec3(0,-9.81,0)});world.broadphase=createMapBroadphase(C,world);world.solver.iterations=15;world.defaultContactMaterial.friction=.55;world.defaultContactMaterial.restitution=.02;
 const map=createMapPhysics(C,world,meta,bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),r=factory(C,world,map);r.applyVehicleProfile(profile);assert(Math.abs(r.tuning.radius/profile.radius-1.12)<1e-8,'tyres enlarged 12 percent');assert(Math.abs(r.tuning.track/profile.track-1.12)<1e-8,'wheel track enlarged with body');assert(Math.abs(r.tuning.wheelbase/profile.wheelbase-1.12)<1e-8,'wheelbase enlarged with body');world.addEventListener('preStep',()=>{r.controls(1/120);r.vehicle.updateVehicle(1/120);});const sp=meta.spawn;r.chassis.position.set(sp.x,map.heightAt(sp.x,sp.z)+r.tuning.rideHeight+.08,sp.z);r.chassis.quaternion.setFromAxisAngle(new C.Vec3(0,1,0),sp.yaw);r.chassis.aabbNeedsUpdate=true;
 for(let i=0;i<240;i++)world.step(1/120);const contacts=r.vehicle.wheelInfos.filter(w=>w.isInContact).length;assert(contacts>=3,id+' spawn tyre contact');const start=r.chassis.position.clone();r.keys.add('KeyW');let minUp=1,maxSpeed=0;for(let i=0;i<960;i++){world.step(1/120);minUp=Math.min(minUp,r.chassis.quaternion.vmult(new C.Vec3(0,1,0)).y);maxSpeed=Math.max(maxSpeed,r.signedSpeed()*3.6);assert(r.chassis.position.y>map.heightAt(r.chassis.position.x,r.chassis.position.z)-.05,id+' no terrain tunneling');}const distance=r.chassis.position.distanceTo(start);console.log(id,{distance,minUp,maxSpeed});assert(distance>30,id+' crosses opening logs');assert(minUp>.65,id+' stays upright');reports.push({id,sharedDrivingTune:true,vehicleScale:1.12,wheelGeometry:true,spawnContacts:contacts,distanceIn8Seconds:Math.round(distance*10)/10,maxSpeedKmh:Math.round(maxSpeed),minUprightDot:Math.round(minUp*100)/100});
}
writeFileSync('fleet-validation.json',JSON.stringify({passed:true,vehicles:reports},null,2));
