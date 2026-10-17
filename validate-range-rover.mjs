import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('.',import.meta.url)));
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const root='';const src=readFileSync(root+'main.js','utf8');const definitions=src.slice(src.indexOf('const vehicleProfiles='),src.indexOf("let activeVehicleId="));const profiles=new Function(definitions+'return vehicleProfiles;')();
for(const key of ['mass','wheelbase','track','radius','restLength','stiffness','compression','rebound','travel','engineForce','brake','rideHeight','rearDrive'])assert.equal(profiles['range-rover'][key],profiles.suv[key],key+' uses same physics');
const glb=readFileSync(root+'assets/range-rover.glb'),json=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString());const wheels=[];
for(const name of ['Wheel_FL','Wheel_FR','Wheel_RL','Wheel_RR']){const node=json.nodes.find(n=>n.name===name);assert(node&&node.mesh!==undefined);const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const p of json.meshes[node.mesh].primitives){const a=json.accessors[p.attributes.POSITION];for(let i=0;i<3;i++){min[i]=Math.min(min[i],a.min[i]);max[i]=Math.max(max[i],a.max[i]);}}assert(max[0]-min[0]<.4,'axle along X');assert(Math.abs((max[1]-min[1])/2-.39975)<.015,'round tyre and correct radius');assert(Math.abs((max[2]-min[2])/2-.39975)<.015,'round tyre and correct radius');assert(Math.abs((max[1]+min[1])/2)<.015,'centered wheel pivot');wheels.push({name,min,max});}
assert(!readFileSync(root+'index.html','utf8').includes('<aside>'),'large vehicle panel removed');
writeFileSync(root+'range-rover-validation.json',JSON.stringify({passed:true,sharedPhysics:true,wheelAssemblies:wheels,largePanelRemoved:true},null,2));console.log('Range Rover: matching physics, four centered wheel assemblies, correct tyre axes/radius, panel removed.');
