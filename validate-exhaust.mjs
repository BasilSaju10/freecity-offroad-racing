import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createExhaustState} from './exhaust-state.js';
import {createExhaustSmoke} from './exhaust-smoke.js';
import {exhaustOutlets} from './exhaust-outlets.js';
import {Vec3} from './vendor/playcanvas/core/math/vec3.js';
import {Quat} from './vendor/playcanvas/core/math/quat.js';
import {Mat4} from './vendor/playcanvas/core/math/mat4.js';
process.chdir(fileURLToPath(new URL('.',import.meta.url)));
function run(state,input,seconds,fps=60){let r,peak=0;for(let i=0;i<seconds*fps;i++){r=state.update(input,1/fps);peak=Math.max(peak,r.load);}return {...r,peak};}
const state=createExhaustState(),idle=run(state,{throttle:0,signedSpeed:0,roadGrade:0},1),start=run(state,{throttle:1,signedSpeed:2,roadGrade:0},.5),cruise=run(state,{throttle:1,signedSpeed:15,roadGrade:0},4),hill=run(state,{throttle:1,signedSpeed:5,roadGrade:.22,bodyGrade:.2},3);
assert(start.peak>cruise.load+.25,'initial acceleration burst');assert(start.opacity>idle.opacity*2);assert(hill.opacity>cruise.opacity*1.7,'uphill sustained density');assert(hill.shade<cruise.shade,'uphill darker colour');
const coast=run(state,{throttle:0,signedSpeed:8,roadGrade:.2},2);assert(coast.opacity<idle.opacity+.002,'coasting returns to light smoke');
state.reset();const reverse=run(state,{throttle:-1,signedSpeed:-3,roadGrade:-.25,bodyGrade:-.2},3);assert(reverse.load>.85,'reversing uphill uses travel direction');state.reset();const braking=run(state,{throttle:-1,signedSpeed:10,roadGrade:.2},1);assert(braking.load===0,'reverse command while braking is not engine load');
const atFps=fps=>run(createExhaustState(),{throttle:1,signedSpeed:2,roadGrade:.1},.5,fps);assert(Math.abs(atFps(30).load-atFps(120).load)<.02,'load independent of frame rate');
const source=readFileSync('main.js','utf8'),profiles=new Function(source.slice(source.indexOf('const vehicleProfiles='),source.indexOf('let activeVehicleId='))+'return vehicleProfiles;')(),audit=JSON.parse(readFileSync('assets/exhaust-calibration.json'));
assert.deepEqual(Object.keys(exhaustOutlets).sort(),Object.keys(profiles).sort());
for(const [id,ports] of Object.entries(exhaustOutlets)){
 const b=readFileSync(profiles[id].url.replace('./','')),j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));
 for(const [i,p] of ports.entries()){assert(Math.abs(Math.hypot(...p.direction)-1)<1e-5);assert(p.position.every(Number.isFinite));assert(p.position[1]<(id==='sterrato'?.2:.1)&&p.position[1]>-.4,'model-specific exhaust height');assert(p.position[2]>0,'rear half of vehicle');assert(j.materials.some(m=>m.name===audit[id][i].material),'calibrated to actual model material');if(audit[id][i].nearestMeshDistance!==undefined)assert(audit[id][i].nearestMeshDistance<.14);}
}
assert.equal(exhaustOutlets.g63.length,4);assert(exhaustOutlets.g63.every(p=>Math.abs(p.direction[0])>.8&&p.position[2]<1),'G63 side exits');assert.equal(exhaustOutlets['range-rover'].length,4);assert(exhaustOutlets.everest[0].direction[1]<-.5,'Everest downward rear outlet');
class Entity{constructor(name){this.name=name;this.children=[];this.enabled=true;}addChild(e){this.children.push(e);}addComponent(t,o){this[t]={...o,meshInstances:[{parameters:{},setParameter(k,v){this.parameters[k]=v;}}]};}setPosition(v){assert([v.x,v.y,v.z].every(Number.isFinite));}setLocalScale(...v){assert(v.every(Number.isFinite));}setRotation(){}}
const context={createRadialGradient:()=>({addColorStop(){}}),fillRect(){}};globalThis.document={createElement:()=>({getContext:()=>context})};
const pc={Entity,StandardMaterial:class{update(){}},Color:class{},Vec3,Quat,Texture:class{setSource(){}},BLEND_NORMAL:2,CULLFACE_NONE:0};
const root=new Entity('Scene'),map={meta:{pools:[]},heightAt:()=>0},renderer=createExhaustSmoke(pc,{root,graphicsDevice:{}},map,{getRotation:()=>new Quat()},exhaustOutlets),rotation=new Quat().setFromEulerAngles(0,90,0),matrix=new Mat4().setTRS(new Vec3(100,5,50),rotation,new Vec3(1,1,1)),frame={getWorldTransform:()=>matrix},chassis={position:new Vec3(100,5,50),quaternion:rotation,velocity:new Vec3()};
for(const [id,ports] of Object.entries(exhaustOutlets)){
 renderer.reset();for(let i=0;i<4;i++)renderer.update(id,frame,chassis,1.12,0,0,.1);const active=renderer.particles.filter(p=>p.e.enabled);assert.equal(active.length,ports.length,id+' emits at each outlet');
 for(let i=0;i<ports.length;i++){const expected=matrix.transformPoint(new Vec3(...ports[i].position).mulScalar(1.12));assert(active[i].p.distance(expected)<.14,id+' follows vehicle scale, position and rotation');}
}
assert.equal(root.children[0].children.length,256,'bounded particle pool');renderer.reset();assert(renderer.particles.every(p=>!p.e.enabled));
map.meta.pools=[{x:100,z:50,rx:20,rz:20,y:10}];for(let i=0;i<20;i++)renderer.update('g63',frame,chassis,1.12,1,0,.1);assert(renderer.particles.every(p=>!p.e.enabled),'submerged pipes do not smoke into the air');
map.meta.pools=[];map.heightAt=(x,z)=>-.25*z;renderer.reset();chassis.quaternion=new Quat();let slopeResponse;for(let i=0;i<120;i++)slopeResponse=renderer.update('suv',frame,chassis,1.12,1,5,1/60);assert(slopeResponse.climbing>.9,'renderer measures uphill terrain in the driving direction');
renderer.reset();map.heightAt=()=>0;matrix.setTRS(new Vec3(0,.5,0),new Quat(),new Vec3(1,1,1));chassis.position.set(0,.5,0);for(let i=0;i<120;i++)renderer.update('everest',frame,chassis,1.12,1,0,1/60);assert(renderer.particles.filter(p=>p.life>0).every(p=>p.p.y>=.025),'downward smoke deflects off terrain');
const report={passed:true,vehicles:Object.keys(profiles).length,outlets:Object.values(exhaustOutlets).reduce((n,p)=>n+p.length,0),perVehiclePlacement:true,sideAndDownwardExits:true,accelerationBurst:true,uphillDensity:true,brakingAndCoasting:true,frameRateIndependent:true,boundedPuffs:256};writeFileSync('exhaust-validation.json',JSON.stringify(report,null,2));console.log(report);
