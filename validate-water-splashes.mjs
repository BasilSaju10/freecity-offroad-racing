import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createWaterSplashState} from './water-splash-state.js';
import {createWaterSplashes} from './water-splashes.js';
import {Vec3} from './vendor/playcanvas/core/math/vec3.js';
import {Quat} from './vendor/playcanvas/core/math/quat.js';
import {calculateNormals} from './vendor/playcanvas/scene/geometry/geometry-utils.js';
process.chdir(fileURLToPath(new URL('.',import.meta.url)));
const map={meta:{pools:[{x:0,z:0,rx:4,rz:4,y:.4}]},heightAt:()=>0},body={velocity:{x:8,z:0},quaternion:{x:0,y:0,z:0,w:1}},tuning={radius:.4};
const vehicle={wheelInfos:Array.from({length:4},()=>({radius:.4,worldTransform:{position:{x:-5,y:.4,z:0}}}))};
function move(x,y=.4){for(const w of vehicle.wheelInfos)Object.assign(w.worldTransform.position,{x,y});}
const events=[];const state=createWaterSplashState(map,(type,at)=>events.push({type,...at}));state.update('car',vehicle,body,tuning,.01);assert.equal(events.length,0,'dry wheels');move(-3.9);state.update('car',vehicle,body,tuning,.1);assert(events.filter(e=>e.type==='sheet').length>=4,'entry bursts');assert(events.some(e=>e.type==='drop')&&events.some(e=>e.type==='foam'));
const small=events.find(e=>e.type==='sheet').strength;events.length=0;move(-5);state.update('car',vehicle,body,tuning,.1);body.velocity.x=20;move(-3.9);state.update('car',vehicle,body,tuning,.1);assert(events.find(e=>e.type==='sheet').strength>small,'speed controls splash size');
events.length=0;body.velocity.x=0;for(let i=0;i<60;i++)state.update('car',vehicle,body,tuning,1/60);assert.equal(events.length,0,'stationary wheels do not spray');
body.velocity.x=8;move(0,2);state.update('car',vehicle,body,tuning,.1);assert.equal(events.length,0,'airborne wheels do not spray');
move(0,.4);body.velocity.x=0;body.velocity.y=-5;state.update('car',vehicle,body,tuning,.01);assert(events.some(e=>e.type==='sheet'),'landing impact splashes');events.length=0;body.velocity.x=8;body.velocity.y=0;state.reset();state.update('new-car',vehicle,body,tuning,.001);assert.equal(events.length,0,'vehicle switching does not fabricate an entry burst');
function simulate(fps){let count=0;const s=createWaterSplashState(map,()=>count++);move(-3);for(let i=0;i<fps*.5;i++){move(-3+8*i/fps);s.update('car',vehicle,body,tuning,1/fps);}return count;}
assert(Math.abs(simulate(30)-simulate(120))<=4,'emission rate independent of FPS');
move(-5,.75);body.velocity.x=8;const shallow=[];const shallowState=createWaterSplashState(map,(type,at)=>shallow.push(at));shallowState.update('car',vehicle,body,tuning,.001);move(-3.9,.75);shallowState.update('car',vehicle,body,tuning,.001);assert(shallow[0].strength<small,'deeper immersion makes larger splashes');
class Entity{constructor(name){this.name=name;this.children=[];this.enabled=true;}addChild(e){this.children.push(e);}addComponent(t,o){this[t]={...o,meshInstances:o.meshInstances||[{setParameter(){}}]};}setPosition(...a){const v=a[0] instanceof Vec3?[a[0].x,a[0].y,a[0].z]:a;assert(v.every(Number.isFinite));}setLocalScale(...v){assert(v.every(Number.isFinite));}setRotation(){}}
class Mesh{setPositions(v){assert(v.every(Number.isFinite));this.p=v;}setNormals(v){assert(v.every(Number.isFinite));}setIndices(){}update(){}}
class Material{update(){}}
class Color{constructor(...a){this.a=a;}}
const context={createRadialGradient:()=>({addColorStop(){}}),fillRect(){}};
globalThis.document={createElement:()=>({getContext:()=>context})};
const pc={Entity,Mesh,StandardMaterial:Material,Color,Vec3,Quat,calculateNormals,Texture:class{setSource(){}},MeshInstance:class{setParameter(){}},BLEND_NORMAL:2,CULLFACE_NONE:0,PRIMITIVE_TRIANGLES:4};
const root=new Entity('Scene'),renderer=createWaterSplashes(pc,{root,graphicsDevice:{}},map,{getRotation:()=>new Quat()});
move(-5);renderer.update('car',vehicle,body,tuning,1/60);move(-3.9);for(let i=0;i<90;i++)renderer.update('car',vehicle,body,tuning,1/60);assert(renderer.drops.some(p=>p.e.enabled));assert(renderer.sheets.some(p=>p.e.enabled));assert(renderer.foam.some(p=>p.e.enabled));assert.equal(root.children[0].children.length,220,'bounded effect pool');
body.velocity.x=0;for(let i=0;i<180;i++)renderer.update('car',vehicle,body,tuning,1/60);assert([...renderer.drops,...renderer.sheets,...renderer.foam].every(p=>!p.e.enabled),'effects fade after stopping');body.velocity.x=8;move(-3);renderer.update('car',vehicle,body,tuning,.1);renderer.reset();assert([...renderer.drops,...renderer.sheets,...renderer.foam].every(p=>!p.e.enabled),'reset clears active water effects');
const source=readFileSync('main.js','utf8'),profiles=new Function(source.slice(source.indexOf('const vehicleProfiles='),source.indexOf('let activeVehicleId='))+'return vehicleProfiles;')();
for(const [id,p] of Object.entries(profiles)){let count=0;const s=createWaterSplashState(map,()=>count++);tuning.radius=p.radius;for(const w of vehicle.wheelInfos)w.radius=p.radius;body.velocity.x=10;move(-5,p.radius);s.update(id,vehicle,body,tuning,.01);move(-3.9,p.radius);s.update(id,vehicle,body,tuning,.1);assert(count>0,id+' splash support');}
const report={passed:true,vehicles:Object.keys(profiles).length,entryBursts:true,speedAndDepthDependent:true,airborneAndStationarySuppressed:true,frameRateIndependent:true,boundedParticles:220,foamAndSprayFade:true};writeFileSync('water-splash-validation.json',JSON.stringify(report,null,2));console.log(report);
