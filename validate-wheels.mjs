import {createDriveSoundSequence} from './drive-sound-sequence.js';
import * as C from './vendor/cannon-es.js';
import {Quat} from './vendor/playcanvas/core/math/quat.js';
import {Vec3} from './vendor/playcanvas/core/math/vec3.js';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('./main.js',import.meta.url),'utf8');
const setup=source.slice(source.indexOf('const tuning='),source.indexOf('const bodyVisual='));
const controls='const driveGearSequence=('+createDriveSoundSequence.toString()+')();'+source.slice(source.indexOf('function controls('),source.indexOf('// Capture suspension'));
const rendering=source.slice(source.indexOf('// Capture suspension'),source.indexOf('function updateCamera'));
class Visual{p=new Vec3();q=new Quat();setPosition(...a){this.p.copy(a[0] instanceof Vec3?a[0]:new Vec3(...a));}setRotation(q){this.q.copy(q);}getPosition(){return this.p;}}
const factory=new Function('C','pc','world','Visual',`const testingGround={applyWheelSurface(v,b,t,i,h){v.wheelInfos[i].frictionSlip=h?1:2.5;}};`+setup+`const keys=new Set();let steering=0;const steeringVisual=null;const bodyVisual=new Visual();const wheelVisuals=Array.from({length:4},()=>new Visual()),loadedWheels=Array.from({length:4},()=>new Visual()),loadedBrakes=Array.from({length:4},()=>new Visual());const wheelState=vehicle.wheelInfos.map(()=>({previousLength:tuning.restLength,length:tuning.restLength,previousSpin:0,spin:0,previousSteer:0,steer:0}));const signedSpeed=()=>chassis.velocity.dot(chassis.quaternion.vmult(new C.Vec3(0,0,-1)));${controls}${rendering};return {keys,chassis,vehicle,wheelState,sync,loadedWheels,loadedBrakes};`);
const world=new C.World({gravity:new C.Vec3(0,-9.81,0)});
const ground=new C.Body({mass:0,shape:new C.Box(new C.Vec3(100,.1,100))});ground.position.y=-.1;ground.aabbNeedsUpdate=true;world.addBody(ground);
const r=factory(C,{Quat,Vec3},world,Visual);r.chassis.position.set(0,.542,14);
function step(seconds){for(let i=0;i<seconds*120;i++){world.step(1/120,1/120,2);r.sync();}}
step(2);r.keys.add('KeyW');step(2);const poweredSpin=r.wheelState[0].spin;assert(poweredSpin<0,'forward travel spins wheels in correct X direction');
r.keys.clear();step(.5);assert(r.wheelState[0].spin<poweredSpin-.5,'wheels keep rolling while coasting');
assert(Math.abs(r.loadedBrakes[0].q.x)<.05,'calipers do not spin with rims');
assert(Math.abs(r.loadedWheels[0].q.x-r.loadedBrakes[0].q.x)>.05,'wheel rotation is independent of brake caliper');
const tireBottom=r.loadedWheels[0].p.y-.39975;assert(Math.abs(tireBottom)<.04,'visual tire touches ground at ride height');
r.keys.add('KeyA');step(.5);assert(r.vehicle.wheelInfos[0].steering>r.vehicle.wheelInfos[1].steering,'inside front wheel steers more than outside wheel');
const report={passed:true,forwardSpinRadians:poweredSpin,coastingSpinRadians:r.wheelState[0].spin,tireGroundErrorMeters:tireBottom,calipersIndependent:true,ackermannSteering:true};console.log(report);writeFileSync(new URL('./wheel-validation.json',import.meta.url),JSON.stringify(report,null,2));
