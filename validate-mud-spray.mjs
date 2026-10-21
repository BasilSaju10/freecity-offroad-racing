import assert from 'node:assert/strict';
import * as C from './vendor/cannon-es.js';
import {Vec3} from './vendor/playcanvas/core/math/vec3.js';
import {Quat} from './vendor/playcanvas/core/math/quat.js';
import {Mat4} from './vendor/playcanvas/core/math/mat4.js';
import {createDrivingSoil,darkMudParticleColor,mudParticleColor} from './driving-soil.js';
import {createMapPhysics} from './freecity-world.js';
class Entity{constructor(){this.children=[];}addChild(e){e.parent=this;this.children.push(e);}addComponent(t,o){this[t]={...o,meshInstances:[{setParameter(){}}]};}findComponents(){return [];}getWorldTransform(){return new Mat4();}setPosition(){}setLocalScale(){}setRotation(){}}
const pc={Entity,Vec3,Quat,Mat4,StandardMaterial:class{update(){}},Color:class{constructor(...values){this.values=values;}},Texture:class{setSource(){}}};
globalThis.document={createElement:()=>({getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})})};
function simulate(count,speed,yaw,surface='MUD',contact=true){
 const root=new Entity(),model=new Entity(),wheels=Array.from({length:count},()=>new Entity());root.addChild(model);
 const soil=createDrivingSoil(pc,{root,graphicsDevice:{}},{surfaceAt:()=>({name:surface}),surfaceInfo:()=>({name:surface}),heightAt:()=>-10},{getRotation:()=>new Quat()}),entry={model,wheels};
 soil.attach(entry,{radius:.4},1,()=>false);
 const chassis=new C.Body({mass:count===2?250:2500});chassis.quaternion.setFromAxisAngle(new C.Vec3(0,1,0),yaw);chassis.quaternion.vmult(new C.Vec3(0,0,-speed),chassis.velocity);
 const vehicle={wheelInfos:wheels.map(()=>({isInContact:contact,raycastResult:{hitPointWorld:new C.Vec3()}}))};
 for(let i=0;i<30;i++)soil.update(entry,vehicle,chassis,{radius:.4},1/60);
 return {soil,chassis};
}
for(const count of [2,4])for(const speed of [-8,8])for(const yaw of [0,Math.PI/2]){
 const {soil,chassis}=simulate(count,speed,yaw),active=soil.particles.filter(p=>p.life>0);
 assert(active.some(p=>!p.dust),'grounded tyres throw solid clods');assert(active.some(p=>p.dust),'mud also creates a short dark spray cloud');
 for(const p of active){assert(p.muddy);assert(p.v.dot(chassis.velocity)<0,'mud travels backward relative to vehicle motion');assert.deepEqual((p.dust?p.e.render.material.emissive:p.e.render.material.diffuse).values,darkMudParticleColor);}
 assert.equal(soil.particles.length,96,'bounded particle pool for cars and bikes');
}
for(const [speed,surface,contact] of [[0,'MUD',true],[8,'MUD',false],[8,'WATER CROSSING',true]])assert(!simulate(2,speed,0,surface,contact).soil.particles.some(p=>p.life>0),'no spray while stopped, airborne or in water');
const dry=simulate(4,8,0,'DIRT TRAIL').soil.particles.filter(p=>p.life>0);assert(dry.every(p=>p.dust&&!p.muddy));assert.deepEqual(dry[0].e.render.material.emissive.values,mudParticleColor,'dry dust keeps its original colour');
const map=createMapPhysics(C,new C.World(),{n:3,step:100,minX:-100,maxZ:100,horizontalScale:2,walls:[],scenery:[],pools:[],routes:[]},new Float32Array(9).buffer);
assert.equal(map.surfaceAt(80,40).name,'MUD','mud classification matches the doubled visual map');assert.equal(map.surfaceAt(60,-60).name,'DIRT TRAIL','original dry patch stays dry after scaling');
console.log('Passed: dark backward mud clods and mist on both bikes and cars, reverse and turned headings, dry dust preserved, grounded/moving gating, scaled visual mud alignment, bounded 96-particle pool.');
