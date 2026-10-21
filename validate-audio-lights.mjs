import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Mat4,Vec3,Quat} from './vendor/playcanvas/index.js';
import {lampProfiles} from './vehicle-lights.js';
import {drivingAudioState} from './vehicle-audio.js';
const idle=drivingAudioState({speed:0,throttle:0}),rev=drivingAudioState({speed:0,throttle:1}),burnout=drivingAudioState({speed:0,throttle:1,burnout:true});assert(rev.rpm>idle.rpm);assert(burnout.rpm>rev.rpm);assert.equal(drivingAudioState({speed:0,brake:true,grounded:true}).scrub,0);assert(drivingAudioState({speed:14,brake:true,grounded:true}).scrub>0);assert.equal(drivingAudioState({speed:14,brake:true,grounded:false}).scrub,0);assert.equal(drivingAudioState({paused:true}).active,false);
const report=[];
for(const [id,profile] of Object.entries(lampProfiles)){
 const b=fs.readFileSync('assets/'+(id==='suv'?'vehicle':id)+'.glb'),len=b.readUInt32LE(12),g=JSON.parse(b.subarray(20,20+len)),bin=b.subarray(28+len);let front=0,rear=0;
 function inside(v,a){return Math.abs(v.x)>=a[0]&&Math.abs(v.x)<=a[1]&&v.y>=a[2]&&v.y<=a[3]&&v.z>=a[4]&&v.z<=a[5];}
 function walk(i,parent){const n=g.nodes[i],m=n.matrix?new Mat4().set(n.matrix):new Mat4().setTRS(new Vec3(...n.translation||[0,0,0]),new Quat(...n.rotation||[0,0,0,1]),new Vec3(...n.scale||[1,1,1])),world=new Mat4().mul2(parent,m);
 if(n.mesh!==undefined)for(const p of g.meshes[n.mesh].primitives){const name=g.materials[p.material]?.name||'',f=profile.front.some(s=>name.includes(s)),r=profile.rear.some(s=>name.includes(s));if(!f&&!r)continue;
  const a=g.accessors[p.attributes.POSITION],v=g.bufferViews[a.bufferView],base=(v.byteOffset||0)+(a.byteOffset||0),stride=v.byteStride||12;let indices;
  if(p.indices!==undefined){const a=g.accessors[p.indices],v=g.bufferViews[a.bufferView],start=(v.byteOffset||0)+(a.byteOffset||0),width={5121:1,5123:2,5125:4}[a.componentType];indices=new Set(Array.from({length:a.count},(_,i)=>bin.readUIntLE(start+i*width,width)));}else indices=Array.from({length:a.count},(_,i)=>i);
  for(const k of indices){const point=world.transformPoint(new Vec3(bin.readFloatLE(base+k*stride),bin.readFloatLE(base+k*stride+4),bin.readFloatLE(base+k*stride+8)));if(f&&inside(point,profile.f))front++;if(r&&inside(point,profile.r))rear++;}
 }for(const child of n.children||[])walk(child,world);}
 for(const i of g.scenes[g.scene||0].nodes)walk(i,new Mat4());report.push({id,front,rear});assert(front>10,id+' needs front lamp calibration');assert(rear>10,id+' needs rear lamp calibration');
}
console.log(JSON.stringify({passed:true,vehicles:report,audio:'throttle, burnout, stopped braking and airborne braking checked'},null,2));
