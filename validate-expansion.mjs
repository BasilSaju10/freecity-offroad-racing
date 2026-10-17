import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as C from './vendor/cannon-es.js';
import {createMapBroadphase} from './map-broadphase.js';
import {createMapPhysics} from './freecity-world.js';
process.chdir(fileURLToPath(new URL('.',import.meta.url)));
const meta=JSON.parse(readFileSync('assets/map/physics.json')),bytes=readFileSync('assets/map/heights.bin');
assert.equal(meta.size,920);assert.equal(meta.horizontalScale,2);assert.equal(meta.step*(meta.n-1),meta.size);
const b=readFileSync('assets/map/freecity.glb'),j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));
for(const scene of j.scenes)assert.deepEqual(j.nodes[scene.nodes[0]].scale,[2,1,2]);
const world=new C.World();world.broadphase=createMapBroadphase(C,world);const map=createMapPhysics(C,world,meta,bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
for(const [x,z] of [[350,300],[-350,300],[350,-300],[-350,-300],[290,0],[-290,0],[0,340],[0,-340]]){
 const px=x+.13,pz=z+.27,y=map.heightAt(px,pz),hit=new C.RaycastResult();world.raycastClosest(new C.Vec3(px,y+.04,pz),new C.Vec3(px,y-.04,pz),{skipBackfaces:true},hit);assert(hit.body===map.ground,'outer terrain collision at '+[x,z,y]+' hit '+hit.hasHit);assert(Math.abs(hit.hitPointWorld.y-y)<.001);
}
const fence=world.bodies.find(b=>b.mapKind==='fence');assert.equal(fence.shapes[0].halfExtents.x,.36);
const model=readFileSync('assets/vehicle.glb'),car=JSON.parse(model.subarray(20,20+model.readUInt32LE(12))),chrome=car.materials.filter(m=>/^Detail \d+$/.test(m.name));assert(chrome.length>=7);
for(const m of chrome){assert.equal(m.pbrMetallicRoughness.metallicFactor??1,1);assert(m.pbrMetallicRoughness.roughnessFactor<.2);}
const paint=car.materials.find(m=>m.name==='Pearl bodywork').pbrMetallicRoughness;assert(paint.roughnessFactor>.8&&paint.baseColorFactor[0]<.02,'matte black body retained');
const report={passed:true,widthMeters:920,lengthMeters:920,terrainCollisionBeyondOldBounds:true,visualAndColliderScaleMatched:true,chromeTrimMaterials:chrome.length};writeFileSync('map-expansion-validation.json',JSON.stringify(report,null,2));console.log(report);
