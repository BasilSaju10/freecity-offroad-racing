import assert from 'node:assert/strict';
import * as C from './vendor/cannon-es.js';
import {createPivotBurnout} from './pivot-burnout.js';
import {createShiftDrift} from './shift-drift.js';
import {createWeather} from './weather.js';
const profile={wheelbase:3,engineForce:3300},body=new C.Body({mass:2000}),wheels=Array.from({length:4},()=>({isInContact:true,steering:0,frictionSlip:2.5}));
const vehicle={wheelInfos:wheels,setSteeringValue(v,i){wheels[i].steering=v;},applyEngineForce(v,i){wheels[i].engineForce=v;},setBrake(v,i){wheels[i].brake=v;}};
const pivot=createPivotBurnout(C);
body.velocity.set(0,0,-1);
for(let i=0;i<360;i++)assert(!pivot.update(true,body,vehicle,profile,1,1/120),'moving car cannot start burnout');
body.velocity.setZero();
for(let i=0;i<239;i++){assert(pivot.update(true,body,vehicle,profile,1,1/120));assert(!pivot.active);assert.equal(wheels[2].engineForce,0);}
assert(pivot.update(true,body,vehicle,profile,1,1/120));assert(pivot.active,'burnout starts after exactly two stationary seconds');
for(let i=0;i<60;i++)pivot.update(true,body,vehicle,profile,1,1/120);
assert(wheels[0].steering>.3&&wheels[1].steering>.3,'front wheels turn with A');
pivot.update(false,body,vehicle,profile,0,1/120);
for(let i=0;i<120;i++)pivot.update(true,body,vehicle,profile,0,1/120);
pivot.update(false,body,vehicle,profile,0,1/120);
for(let i=0;i<120;i++)pivot.update(true,body,vehicle,profile,0,1/120);
assert(!pivot.active,'releasing command resets the two-second wait');
const drift=createShiftDrift(C);body.quaternion.set(0,0,0,1);
for(const speed of [0,24.99,-40]){body.velocity.set(0,0,-speed/3.6);drift.reset();for(let i=0;i<60;i++)assert(!drift.update(true,body,vehicle,profile,1,1/120));assert.equal(drift.amount,0);}
for(const direction of [-1,1]){
 drift.reset();body.velocity.set(0,0,-40/3.6);body.angularVelocity.setZero();
 for(let i=0;i<120;i++){wheels.forEach(w=>{w.frictionSlip=2.5;w.steering=direction*.2;});drift.update(true,body,vehicle,profile,direction,1/120);}
 assert(drift.amount>.98);assert(body.angularVelocity.y*direction>.5);assert(wheels[0].steering*direction<0);assert(body.velocity.x*direction>0);
 const speed=body.velocity.length();for(let i=0;i<180;i++)drift.update(false,body,vehicle,profile,0,1/120);assert(drift.amount===0);assert(body.velocity.length()<=speed+1e-6,'drift does not add speed');
}
drift.reset();body.velocity.set(0,0,-40/3.6);assert(!drift.update(true,body,vehicle,{...profile,bike:true},1,1/120));
// Run the real weather renderer through a full automatic cycle with lightweight render doubles.
class Mesh{setPositions(){}setNormals(){}setIndices(){}update(){}}
class Color{set(...v){this.values=v;}copy(c){this.values=c.values;}}
class Entity{addComponent(){} }
class Material{update(){}}
const pc={Mesh,Color,Entity,MeshInstance:class{},StandardMaterial:Material,Mat4:class{},Vec3:C.Vec3};
const app={graphicsDevice:{},root:{addChild(){}},scene:{fog:{color:new Color()},ambientLight:new Color()}},camera={camera:{clearColor:new Color()},getPosition:()=>new C.Vec3(),right:new C.Vec3(1,0,0)},sun={light:{color:new Color()}},map={heightAt:()=>-100};
let thunder=0;const weather=createWeather(pc,app,camera,sun,map,()=>thunder++);
for(let i=0;i<79;i++)weather.update(1,{});assert.equal(thunder,0,'dry day has no thunder');
for(let i=0;i<70;i++)weather.update(1,{});assert(thunder>0,'rain now has thunder');
const before=thunder;for(let i=0;i<50;i++)weather.update(1,{paused:true});assert.equal(thunder,before,'paused game does not trigger thunder');
for(let i=0;i<66;i++)weather.update(1,{});assert(thunder>before,'storm retains thunder');
const dry=thunder;for(let i=0;i<70;i++)weather.update(1,{});assert.equal(thunder,dry,'night has no thunder');
console.log('Passed: stopped-only two-second burnout, command cancellation, front steering, 25 km/h forward-only Shift drift, countersteer and recovery, rain/storm thunder and dry/paused suppression.');

