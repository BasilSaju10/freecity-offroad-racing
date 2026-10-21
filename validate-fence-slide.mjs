import * as C from './vendor/cannon-es.js';
import {createMapPhysics} from './freecity-world.js';
import {createMapBroadphase} from './map-broadphase.js';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
process.chdir(fileURLToPath(new URL('.',import.meta.url)));
const source=readFileSync('main.js','utf8'),definitions=source.slice(source.indexOf('const vehicleProfiles='),source.indexOf('let activeVehicleId='));
const profiles=new Function(definitions+'return vehicleProfiles;')(),setup=source.slice(source.indexOf('const tuning='),source.indexOf('const bodyVisual=')),apply=source.slice(source.indexOf('function applyVehicleProfile('),source.indexOf('async function loadCar('));
const factory=new Function('C','world','testingGround',setup+`const wheelState=[];const steeringAxis={set(){return this;},normalize(){}};const dashboardDisplay={setLocalPosition(){},setLocalScale(){}};function reset(){};${apply};return{chassis,vehicle,tuning,applyVehicleProfile};`);
const meta={n:41,step:2,minX:-40,maxZ:40,walls:Array.from({length:10},(_,i)=>({ax:0,ay:0,az:-25+i*5,bx:0,by:0,bz:-20+i*5})),scenery:[],pools:[],startBanner:{x:30,y:0,z:30},finishBanner:{x:30,y:0,z:-30}};
const reports=[];
for(const [id,profile] of Object.entries(profiles))for(const speed of [12,40])for(const glance of [false,true]){
 const world=new C.World({gravity:new C.Vec3(0,-9.81,0)});world.broadphase=createMapBroadphase(C,world);world.solver.iterations=15;
 const map=createMapPhysics(C,world,meta,new Float32Array(41*41).buffer),r=factory(C,world,map);r.applyVehicleProfile(profile);
 const startClearance=(profile.hullWidth||.94)*1.12*Math.cos(Math.atan(.25))+(profile.hullLength||2.25)*1.12*Math.sin(Math.atan(.25))+.6;
 r.chassis.position.set(glance?startClearance:5,r.tuning.rideHeight+.08,glance?-12:0);r.chassis.quaternion.setFromAxisAngle(new C.Vec3(0,1,0),glance?Math.atan2(.25,1):Math.PI/2);r.chassis.aabbNeedsUpdate=true;
 world.addEventListener('preStep',()=>r.vehicle.updateVehicle(1/120));for(let i=0;i<120;i++)world.step(1/120);
 r.chassis.velocity.set(-speed*(glance?.25:1),0,glance?-speed:0);const z0=r.chassis.position.z;let hit=false,minX=Infinity;
 for(let i=0;i<120;i++){world.step(1/120);hit ||= world.contacts.some(c=>c.bi.mapKind==='fence'||c.bj.mapKind==='fence');minX=Math.min(minX,r.chassis.position.x);}
 assert(hit,id+' strikes fence');assert(minX>.35,id+' cannot pass through fence at '+speed+' m/s');
 const slid=Math.abs(r.chassis.position.z-z0);if(glance)assert(slid>speed*.39,id+' continues sliding along fence');
 reports.push({id,speedKmh:speed*3.6,glancing:glance,contact:true,minX:+minX.toFixed(2),slideMeters:+slid.toFixed(2)});
}
writeFileSync('fence-slide-validation.json',JSON.stringify({passed:true,cases:reports},null,2));console.log({passed:true,cases:reports.length,headOnAndGlancing:true,maxSpeedKmh:144});
