import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import * as C from './vendor/cannon-es.js';
import {createMapBroadphase} from './map-broadphase.js';
import {createMapPhysics} from './freecity-world.js';
import {nearestTrackPose} from './track-reset.js';
import {makeCourse} from './multiplayer-server.mjs';
import {gutterView} from './gamblers-world.js';
const meta=JSON.parse(readFileSync('assets/gamblers/physics.json')),scene=JSON.parse(readFileSync('assets/gamblers/scene.json')),bytes=readFileSync('assets/gamblers/heights.bin'),buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),samples=new Float32Array(buffer);
const world=new C.World({gravity:new C.Vec3(0,-9.81,0)});world.broadphase=createMapBroadphase(C,world);world.solver.iterations=15;
const map=createMapPhysics(C,world,meta,buffer);
assert.equal(meta.n,512);assert.equal(scene.treesAfter,2705);assert.equal(scene.treesBefore,5410);
const ray=new C.RaycastResult();
for(let i=0;i<120;i++){
 const x=3+(i*127%503),y=3+(i*79%503),p={x:x-256,z:256-y};
 assert.equal(map.heightAt(p.x,p.z),samples[x*512+y]);
 const h=map.heightAt(p.x+.31,p.z-.25);
 ray.reset();world.raycastClosest(new C.Vec3(p.x+.31,h+2,p.z-.25),new C.Vec3(p.x+.31,h-2,p.z-.25),{},ray);
 assert(ray.hasHit,'terrain ray hits');assert(ray.hitPointWorld.y>=h-.001,'rendered height agrees with physical terrain');
}
assert(gutterView.fogEnd<gutterView.cull);assert(gutterView.cull<gutterView.clip);
for(let i=0;i<30;i++){
 const course=makeCourse(meta,()=>i/30);assert.equal(course.checkpoints.length,10);
 for(const [x,y,z]of course.checkpoints)assert(Math.abs(map.heightAt(x,z)-y)<.15,'race checkpoint follows terrain');
}
const reset=nearestTrackPose(meta.routes.map(r=>r.points),{x:90,z:210},new C.Vec3(0,0,-1));assert(reset&&Number.isFinite(map.heightAt(reset.x,reset.z)));
// Settle and drive the real starting SUV through the new map's physics.
const source=readFileSync('main.js','utf8'),setup=source.slice(source.indexOf('const tuning='),source.indexOf('const bodyVisual='));
const factory=new Function('C','world','testingGround',setup+'return{chassis,vehicle,tuning};');
const {chassis,vehicle,tuning}=factory(C,world,map),sp=meta.spawn;
chassis.position.set(sp.x,map.heightAt(sp.x,sp.z)+.75,sp.z);chassis.quaternion.setFromAxisAngle(new C.Vec3(0,1,0),sp.yaw);
world.addEventListener('preStep',()=>vehicle.updateVehicle(1/120));
for(let i=0;i<240;i++)world.step(1/120);
assert(vehicle.wheelInfos.filter(w=>w.isInContact).length>=3,'SUV rests on the map');
const start=chassis.position.clone();let minClearance=Infinity;
for(let i=0;i<4*120;i++){
 for(let w=0;w<4;w++){vehicle.applyEngineForce(2500,w);map.applyWheelSurface(vehicle,chassis,tuning,w,false);}
 world.step(1/120);minClearance=Math.min(minClearance,chassis.position.y-map.heightAt(chassis.position.x,chassis.position.z));
 assert(chassis.position.y>map.heightAt(chassis.position.x,chassis.position.z)-.1,'no terrain tunnelling');
}
const travelled=chassis.position.distanceTo(start);assert(travelled>8,'SUV drives away from spawn');
const manifest=JSON.parse(readFileSync('asset-manifest.json'));
for(const file of ['scene.json','physics.json','layers.bin','heights.bin'])assert(manifest.files.some(f=>f.path==='assets/gamblers/'+file));
for(const {url}of Object.values(scene.models))assert(manifest.files.some(f=>f.path==='assets/gamblers/'+url));
assert(!manifest.files.some(f=>f.path.startsWith('assets/map/')),'old map excluded from downloads');
const report={passed:true,trees:2705,terrainCollisionSamples:120,randomRaceCourses:30,checkpointsPerRace:10,colliders:meta.scenery.length,spawnWheelContacts:vehicle.wheelInfos.filter(w=>w.isInContact).length,driveDistance:travelled,minClearance,fogMetres:gutterView.fogEnd,cullMetres:gutterView.cull,clipMetres:gutterView.clip};
writeFileSync('gamblers-validation.json',JSON.stringify(report,null,2));console.log(report);
