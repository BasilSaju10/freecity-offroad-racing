import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {bikeSteeringLimit} from './bike-physics.js';
import {GraphNode} from './vendor/playcanvas/scene/graph-node.js';class Entity extends GraphNode{findComponents(){return [];}destroy(){this.parent?.removeChild(this);}};import {Vec3} from './vendor/playcanvas/core/math/vec3.js';import {Quat} from './vendor/playcanvas/core/math/quat.js';import {Mat4} from './vendor/playcanvas/core/math/mat4.js';import {createBikeRider} from './bike-rider.js';import {bikeProfiles} from './bike-profiles.js';
const b=readFileSync('assets/bike-rider.glb'),g=JSON.parse(b.subarray(20,20+b.readUInt32LE(12))),pc={Entity,Vec3,Quat,Mat4,CULLFACE_NONE:0};
for(const [id,p] of Object.entries(bikeProfiles)){
 const model=new Entity('rider'),nodes=g.nodes.map(n=>{const e=new Entity(n.name);e.setLocalPosition(...n.translation||[0,0,0]);e.setLocalRotation(new Quat(...n.rotation||[0,0,0,1]));e.setLocalScale(...n.scale||[1,1,1]);return e;});
 g.nodes.forEach((n,i)=>n.children?.forEach(j=>nodes[i].addChild(nodes[j])));for(const i of g.scenes[g.scene||0].nodes)model.addChild(nodes[i]);const parent=new Entity('bike');parent.setLocalPosition(0,p.rideHeight,0);
 const helmet={visible:true,material:{name:'Wolf3D_Headwear.002',update(){}}},suit={visible:true,material:{name:'Wolf3D_Outfit_Top.002',update(){}}},arms={visible:false,material:{name:'Wolf3D_Outfit_Top.002',update(){}}};model.findComponents=()=>[{meshInstances:[helmet,suit,arms]}];model.findByName('Rider camera arms').findComponents=()=>[{meshInstances:[arms]}];
 const r=createBikeRider(pc,model,parent,p,1,{heightAt:()=>0});for(let i=0;i<120;i++)r.update({speed:0,steer:0,reverse:false,dt:1/60,view:0});
 const foot=r.bones.LeftFoot.getPosition();assert(Math.abs(foot.y-.085)<.08,id+' supporting foot touches ground');assert(Math.abs(r.bones.Hips.getPosition().y-(p.seat[1]+p.rideHeight))<.01);
 for(const [side,i] of [['Left',0],['Right',1]]){const target=new Vec3(...p.grips[i]);target.y+=p.rideHeight;console.log(id,side,'grip error',r.bones[side+'Hand'].getPosition().distance(target));assert(r.bones[side+'Hand'].getPosition().distance(target)<.08,'hands reach handlebars');}
 r.update({speed:8,steer:.2,reverse:false,dt:1,view:0});assert(r.bones.LeftFoot.getPosition().y>.2,'riding feet return to pegs');
 for(const steer of [bikeSteeringLimit(8,p.wheelbase),-bikeSteeringLimit(8,p.wheelbase)]){
  const inside=steer>0?'Left':'Right',outside=steer>0?'Right':'Left',outsideIndex=steer>0?1:0;
  for(let i=0;i<120;i++){const previousFoot=r.bones[inside+'Foot'].getPosition().clone();r.update({speed:8,steer,reverse:false,dt:1/60,view:0,grounded:true});assert(r.bones[inside+'Foot'].getPosition().distance(previousFoot)<.08,'cornering leg transitions smoothly without a frame jump');}
  assert(r.bones[inside+'Foot'].getPosition().z<p.pegs[steer>0?0:1][2]-.3,'inside leg extends forward into the corner');
  assert(r.bones[outside+'Foot'].getPosition().distance(new Vec3(...p.pegs[outsideIndex]).add(new Vec3(0,p.rideHeight,0)))<.04,'outside foot remains on its peg');
  const knee=r.bones[inside+'Leg'].getPosition(),thigh=r.bones[inside+'UpLeg'].getPosition().clone().sub(knee).normalize(),shin=r.bones[inside+'Foot'].getPosition().clone().sub(knee).normalize();
  assert(Math.acos(Math.max(-1,Math.min(1,thigh.dot(shin))))*180/Math.PI>130,'cornering leg is extended rather than tucked');
 }
 for(let i=0;i<120;i++)r.update({speed:8,steer:0,reverse:false,dt:1/60,view:0});
 for(const [side,i] of [['Left',0],['Right',1]])assert(r.bones[side+'Foot'].getPosition().distance(new Vec3(...p.pegs[i]).add(new Vec3(0,p.rideHeight,0)))<.04,'straightening returns both feet to pegs');
 for(let i=0;i<120;i++)r.update({speed:8,steer:.25,reverse:false,dt:1/60,view:0,grounded:false});
 assert(r.bones.LeftFoot.getPosition().distance(new Vec3(...p.pegs[0]).add(new Vec3(0,p.rideHeight,0)))<.04,'jumping retracts the cornering leg');
 const points=[];for(let i=0;i<90;i++){r.update({speed:-1,steer:0,reverse:true,dt:1/60,view:0});points.push([r.bones.LeftFoot.getPosition().z,r.bones.RightFoot.getPosition().z]);}
 for(const i of [0,1])assert(Math.max(...points.map(p=>p[i]))-Math.min(...points.map(p=>p[i]))>.25,'both feet push in reverse');
 r.update({speed:0,steer:0,reverse:false,dt:1/60,view:2});assert(!helmet.visible&&!suit.visible&&arms.visible,'eye camera hides helmet and torso while retaining supplied skinned arms');
 r.update({speed:0,steer:0,reverse:false,dt:1/60,view:0});assert(helmet.visible&&suit.visible&&!arms.visible,'exterior view restores the full rider without duplicate arms');
 r.destroy();
}
console.log('Supplied rider: seated pelvis, both hand grips, stationary support foot, pegs and two-leg reverse passed.');
