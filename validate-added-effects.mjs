import assert from 'node:assert/strict';
import * as C from './vendor/cannon-es.js';
import {Vec3} from './vendor/playcanvas/core/math/vec3.js';
import {Quat} from './vendor/playcanvas/core/math/quat.js';
import {Mat4} from './vendor/playcanvas/core/math/mat4.js';
import {addedExhaustOutlets,addedWiperProfiles} from './added-vehicle-effects.js';
import {attachedFleetProfiles} from './attached-fleet-profiles.js';
import {createWindshieldWipers} from './windshield-wipers.js';
import {createExhaustSmoke} from './exhaust-smoke.js';
import {createPivotBurnout} from './pivot-burnout.js';
assert.deepEqual(Object.keys(addedWiperProfiles).sort(),Object.keys(attachedFleetProfiles).sort());
assert.deepEqual(Object.keys(addedExhaustOutlets).sort(),Object.keys(attachedFleetProfiles).sort());
class Entity{constructor(name){this.name=name;this.children=[];this.enabled=true;this.position=new Vec3();}addChild(e){this.children.push(e);}addComponent(){this.render={meshInstances:[{setParameter(){}}]};}setLocalPosition(...p){this.position.set(...p);}setPosition(v){this.position.copy(v);}setLocalRotation(){}setRotation(){}setLocalScale(...v){assert(v.every(Number.isFinite));}}
class Material{constructor(){this.diffuse={set(){}};}update(){}clone(){return new Material();}}
const pc={Entity,StandardMaterial:Material,Color:class{},Vec3,Quat,Texture:class{setSource(){}}};
const parent=new Entity('Car'),wipers=createWindshieldWipers(pc,parent),wiperRoot=parent.children[0];
for(const [id,p] of Object.entries(addedWiperProfiles)){
 wipers.update(id,0,10);const parked=wiperRoot.children[0].position.clone();
 wipers.update(id,1,.2);assert(wiperRoot.enabled);assert(wiperRoot.children[0].position.distance(parked)>.005,id+' wiper moves in rain');assert.equal(wiperRoot.children.filter(e=>e.enabled).length,p.pivots.length*2);
 wipers.update(id,0,10);assert(wiperRoot.name.endsWith('parked'),id+' wiper parks when dry');
}
globalThis.document={createElement:()=>({getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})})};
const root=new Entity('Scene'),map={meta:{pools:[]},heightAt:()=>0};
const renderer=createExhaustSmoke(pc,{root,graphicsDevice:{}},map,{getRotation:()=>new Quat()},addedExhaustOutlets);
const frame={getWorldTransform:()=>new Mat4().setTRS(new Vec3(0,2,0),new Quat(),new Vec3(1,1,1))},body={position:new Vec3(0,2,0),quaternion:new Quat(),velocity:new Vec3()};
for(const id of Object.keys(attachedFleetProfiles)){renderer.reset();for(let i=0;i<60;i++)renderer.update(id,frame,body,1.12,1,0,1/60);assert(renderer.particles.some(p=>p.life>0),id+' emits exhaust smoke');}
for(const turn of [-1,0,1]){
 const body=new C.Body({mass:2000});body.position.set(0,1,0);
 const wheels=Array.from({length:4},()=>({isInContact:true})),brakes=[],forces=[];
 const vehicle={wheelInfos:wheels,setSteeringValue(){},setBrake(value,i){brakes[i]=value;},applyEngineForce(value,i){forces[i]=value;}};
 const profile={wheelbase:3},pivot=createPivotBurnout(C),front=()=>body.quaternion.vmult(new C.Vec3(0,0,-1.5)).vadd(body.position),rear=()=>body.quaternion.vmult(new C.Vec3(0,0,1.5)).vadd(body.position),anchor=front();
 for(let i=0;i<240;i++){assert(pivot.update(true,body,vehicle,profile,turn,1/120));body.position.x+=.001;pivot.constrain(body,profile);assert(front().distanceTo(anchor)<1e-7);}
 assert.equal(forces[0],0);assert.equal(brakes[0],120);assert.equal(brakes[2],0);
 if(turn)assert(Math.sign(rear().x)===-turn,'D swings rear right; A swings rear left');else assert(Math.abs(rear().x)<1e-8);
 assert(!pivot.update(false,body,vehicle,profile,0,1/120));assert(!pivot.active);
}
console.log('Passed: smoke and rain-wiper motion for all 10 added cars; dry parking; Space+Q front-axle anchoring, A/D rear direction, and clean release.');
