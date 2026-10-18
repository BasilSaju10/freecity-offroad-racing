import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as C from './vendor/cannon-es.js';
import {createMapPhysics} from './freecity-world.js';
import {createWaterEntryBuffer} from './water-entry-audio.js';
const meta=JSON.parse(readFileSync('assets/map/physics.json')),bytes=readFileSync('assets/map/heights.bin'),world=new C.World(),map=createMapPhysics(C,world,meta,bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
const added=meta.pools.filter(p=>p.addedCrossing);assert.equal(added.length,5);assert.equal(meta.pools.length,8);
for(const p of added){const depth=p.y-map.heightAt(p.x,p.z);assert(depth>.3&&depth<.4,p.route+' shallow centre');assert.equal(map.surfaceAt(p.x,p.z).name,'WATER CROSSING');for(const side of [-1,1]){const bank=map.heightAt(p.x+p.rx*side,p.z);assert(bank>p.y,'dry bank at edge');}const hit=new C.RaycastResult();world.raycastClosest(new C.Vec3(p.x,p.y+2,p.z),new C.Vec3(p.x,p.y-2,p.z),{},hit);assert.equal(hit.body,map.ground);assert(Math.abs(hit.hitPointWorld.y-map.heightAt(p.x,p.z))<.02,'collision matches pit floor');}
const glb=readFileSync('assets/map/freecity.glb'),json=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)));assert.equal(json.nodes.filter(n=>n.name?.startsWith('Shallow water crossing')).length,5);
let samples;const buffer=createWaterEntryBuffer({sampleRate:44100,createBuffer:(channels,n)=>({getChannelData:()=>samples??=new Float32Array(n)})});assert(buffer);assert(samples.every(Number.isFinite));assert(Math.max(...samples.map(Math.abs))<=.851);assert.equal(Math.abs(samples.at(-1)),0);const energy=(a,b)=>samples.slice(a,b).reduce((sum,v)=>sum+v*v,0)/(b-a);assert(energy(2205,8820)>energy(40000,45000)*8,'entry splash fades naturally');
console.log('Passed: 5 new shallow pits, 8 total, matching terrain collision, dry banks, and fading splash audio.');
