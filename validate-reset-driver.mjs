import {createWindshieldWipers} from './windshield-wipers.js';
import {nearestTrackPose} from './track-reset.js';
import {createHelmetDriver} from './helmet-driver.js';
import {Vec3} from './vendor/playcanvas/core/math/vec3.js';
import {Quat} from './vendor/playcanvas/core/math/quat.js';
import {calculateNormals} from './vendor/playcanvas/scene/geometry/geometry-utils.js';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
process.chdir(fileURLToPath(new URL('.',import.meta.url)));
assert.deepEqual(nearestTrackPose([{x:0,z:0},{x:0,z:100}],{x:9,z:47},{x:0,z:1}),{x:0,z:47,yaw:-Math.PI});
const reverse=nearestTrackPose([{x:0,z:0},{x:0,z:100}],{x:-7,z:47},{x:0,z:-1});assert.equal(reverse.z,47);assert.equal(Math.abs(reverse.yaw),0);
const meta=JSON.parse(readFileSync('assets/map/physics.json'));for(let i=0;i<meta.trail.length;i+=3){const p=meta.trail[i],pose=nearestTrackPose(meta.trail,{x:p.x+9,z:p.z-4},{x:0,z:1});assert(pose&&Number.isFinite(pose.yaw));assert(Math.hypot(pose.x-p.x,pose.z-p.z)<20,'reset uses nearby track, not start');}
class Entity{constructor(name){this.name=name;this.children=[];this.enabled=true;this.p=new Vec3();this.q=new Quat();this.scale=new Vec3(1,1,1);}addChild(c){this.children.push(c);}addComponent(type,options){this[type]={...options};}setLocalPosition(...v){this.p.copy(v[0] instanceof Vec3?v[0]:new Vec3(...v));}setLocalScale(...v){this.scale.set(...v);}setLocalEulerAngles(...v){this.q.setFromEulerAngles(...v);}setLocalRotation(q){this.q.copy(q);}getPosition(){return this.p;}}
class Material{update(){}clone(){return Object.assign(new Material(),this);}}
class Mesh{setPositions(p){this.positions=p;}setNormals(n){assert(n.every(Number.isFinite));}setIndices(i){this.indices=i;}update(){assert(this.indices.length>0);}}
const pc={Entity,StandardMaterial:Material,Color:class{constructor(...v){this.values=v;}set(...v){this.values=v;}},Mesh,MeshInstance:class{constructor(mesh,material){this.mesh=mesh;this.material=material;}},calculateNormals,Vec3,Quat,CULLFACE_NONE:0,BLEND_NORMAL:2,PRIMITIVE_TRIANGLES:4};
const source=readFileSync('main.js','utf8'),profiles=new Function(source.slice(source.indexOf('const vehicleProfiles='),source.indexOf('let activeVehicleId='))+'return vehicleProfiles;')();
const driver=createHelmetDriver(pc,{graphicsDevice:{}},new Entity('Vehicle'));
const importedHands=new Entity('Supplied hands');driver.attachHands(importedHands);driver.fit({...profiles.suv,bike:true},1.12);driver.update(0,2);assert(!importedHands.enabled,'car steering hands must not overlay motorcycle grips');driver.fit(profiles.suv,1.12);driver.update(0,0);assert(importedHands.enabled,'returning to a car restores its supplied hands');
const all=e=>[e,...e.children.flatMap(all)],parts=all(driver.root);assert(parts.some(p=>p.name==='Helmet visor'));assert(parts.some(p=>p.name==='Face'));assert(parts.some(p=>p.name==='Gloved hand'));
assert.equal(parts.filter(p=>p.name.startsWith('Finger ')).length,24);assert.equal(parts.filter(p=>p.name.startsWith('Thumb segment')).length,4);
for(const profile of Object.values(profiles)){
 driver.fit(profile,1.12);for(const turn of [-.4,0,.4]){driver.update(turn,0);assert(driver.head.enabled);for(const p of parts)assert([p.p.x,p.p.y,p.p.z,p.scale.x,p.scale.y,p.scale.z].every(Number.isFinite),p.name+' '+p.p.toString()+' '+p.scale.toString());const hands=parts.filter(p=>p.name==='Gloved hand'),axis=new Vec3(...profile.steeringAxis).normalize(),q=new Quat().setFromAxisAngle(axis,turn*14*180/Math.PI);for(let i=0;i<2;i++){const expected=q.transformVector(new Quat().setFromDirections(new Vec3(0,0,1),axis).transformVector(new Vec3((i===0?-1:1)*((profile.steeringGripRadius||.165)+.012)*.8660254,((profile.steeringGripRadius||.165)+.012)*.5,0))).add(new Vec3(...profile.steeringPosition)).sub(driver.seatOrigin);assert(hands[i].p.distance(expected)<1e-7,'hands stay on wheel');}}
 assert(driver.seatOrigin.y+.148<(profile.hullTop||1.3),'helmet stays beneath roof');driver.update(0,2);assert(!driver.head.enabled,'no helmet clipping in first person');
}
const report={passed:true,nearestTrackProjection:true,keepsTravelDirection:true,driverVehicles:Object.keys(profiles).length,helmetAndFace:true,handsFollowSteering:true,firstPersonHeadHidden:true};writeFileSync('reset-driver-validation.json',JSON.stringify(report,null,2));console.log(report);


const supplied=new Entity('Supplied hands');driver.attachHands(supplied);for(const profile of Object.values(profiles)){driver.fit(profile,1.12);driver.update(.25,2);assert(supplied.p.distance(new Vec3(...profile.steeringPosition).mulScalar(1.12))<1e-6);assert(parts.filter(p=>p.name==='Gloved hand').every(p=>!p.enabled));assert(Number.isFinite(supplied.q.w));}
const wiperParent=new Entity('Car'),wipers=createWindshieldWipers(pc,wiperParent),wiperRoot=wiperParent.children[0];for(const id of Object.keys(profiles)){wipers.update(id,0,10);const parked=wiperRoot.children[1].p.clone();wipers.update(id,1,.25);assert(wiperRoot.children[1].p.distance(parked)>.01,'Wipers sweep during rain '+id);wipers.update(id,0,2);assert(wiperRoot.children[1].p.distance(parked)<1e-6,'Wipers return to park '+id);}
assert(profiles.safari.cockpitEye[2]>-.1,'Safari eyes sit behind the windshield');assert(profiles.safari.steeringPosition[2]>-.6,'Safari steering is inside cabin');
console.log('Passed: supplied hands follow steering on all 15 cars; all wipers sweep and park; Safari cabin clearance.');
