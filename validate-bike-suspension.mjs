import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GraphNode} from './vendor/playcanvas/scene/graph-node.js';
import {bikeProfiles} from './bike-profiles.js';
import {updateBikeSuspension} from './bike-suspension.js';
for(const [id,profile] of Object.entries(bikeProfiles)){
 const bytes=readFileSync(new URL(profile.url,import.meta.url)),n=bytes.readUInt32LE(12),g=JSON.parse(bytes.subarray(20,20+n));
 const model=new GraphNode('bike');for(const name of ['FrontFork','ForkUpper','Swingarm'])model.addChild(new GraphNode(name));
 const scale=1.12,rest=profile.wheelCenters.map(p=>(.12-p[1])*scale);
 updateBikeSuspension(model,profile,scale,rest,0);
 assert(Math.abs(model.findByName('FrontFork').getLocalPosition().y-profile.forkOrigin[1])<1e-6,'fork meets axle at calibrated ride height');
 assert(Math.abs(model.findByName('Swingarm').getLocalEulerAngles().x)<1e-5,'swingarm retains source rest angle');
 const upperY=model.findByName('ForkUpper').getLocalPosition().y;
 updateBikeSuspension(model,profile,scale,rest.map(v=>v-.08*scale),.3);
 assert(Math.abs(model.findByName('FrontFork').getLocalPosition().y-profile.forkOrigin[1]-.08)<1e-6,'lower fork follows wheel compression');
 assert.equal(model.findByName('ForkUpper').getLocalPosition().y,upperY,'upper fork stays attached to steering head');
 assert(Math.abs(model.findByName('Swingarm').getLocalEulerAngles().x)>1,'rear arm pivots with suspension');
 if(id==='stark-varg'){
  for(const name of ['Brake_F','Brake_R','ForkUpper'])assert(g.nodes.some(n=>n.name===name),'separate nonspinning '+name);
  for(const name of ['Wheel_F','Wheel_R']){
   const mesh=g.meshes[g.nodes.find(n=>n.name===name).mesh];
   const materials=mesh.primitives.map(p=>g.materials[p.material].name);
   assert(!materials.some(m=>/Shock|Chain|Aluminium|Main-Frame|Subframe/.test(m)),name+' contains only rolling parts');
  }
  const rubber=g.materials.find(m=>m.name==='Rubber').pbrMetallicRoughness;
  assert(rubber.baseColorFactor[0]<.05&&rubber.roughnessFactor>.8,'tyres retain opaque dark rubber');
 }
 console.log(id+': calibrated fork travel, fixed upper fork and rear hinge passed');
}
