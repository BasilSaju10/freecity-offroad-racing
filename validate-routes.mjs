import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as C from './vendor/cannon-es.js';
import {createMapPhysics} from './freecity-world.js';
import {nearestTrackPose} from './track-reset.js';
process.chdir(fileURLToPath(new URL('.',import.meta.url)));
const meta=JSON.parse(readFileSync('assets/map/physics.json')),data=readFileSync('assets/map/heights.bin'),world=new C.World(),map=createMapPhysics(C,world,meta,data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)),routes=meta.routes.filter(r=>r.added);
assert.equal(routes.length,4);assert.equal(routes.filter(r=>r.kind==='rock').length,2);
let samples=0;
for(const r of routes){assert(r.width>=14);assert(r.points.length>8);
 for(const p of r.points.slice(1,-1)){
  const y=map.heightAt(p.x,p.z);assert(Number.isFinite(y));const hit=new C.RaycastResult();world.raycastClosest(new C.Vec3(p.x,y+.04,p.z),new C.Vec3(p.x,y-.04,p.z),{},hit);assert(hit.body===map.ground,'new route has terrain collision');
  if(r.kind==='rock')assert.equal(map.surfaceAt(p.x,p.z).name,'ROCK TRAIL');
  const reset=nearestTrackPose([meta.trail,...meta.routes.map(r=>r.points)],{x:p.x,z:p.z},{x:0,z:1});assert(Math.hypot(reset.x-p.x,reset.z-p.z)<1e-6,'reset recognises added route');samples++;
 }
}
const report=JSON.parse(readFileSync('route-extension-report.json'));assert(report.addedRockCount>=200);assert(report.visualAndCollisionGeneratedTogether);
const result={passed:true,newRoutes:4,rockRoutes:2,addedRocks:report.addedRockCount,terrainSamples:samples,nearestTrackReset:true};writeFileSync('routes-validation.json',JSON.stringify(result,null,2));console.log(result);
