import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {Quat} from './vendor/playcanvas/core/math/quat.js';
import {Vec3} from './vendor/playcanvas/core/math/vec3.js';
process.chdir(fileURLToPath(new URL('.',import.meta.url)));
const source=readFileSync('main.js','utf8'),definitions=source.slice(source.indexOf('const vehicleProfiles='),source.indexOf('let activeVehicleId=')),profiles=new Function(definitions+'return vehicleProfiles;')();
const rotation=source.slice(source.indexOf(' if(steeringVisual){'),source.indexOf(' const alpha=',source.indexOf('function sync()')));
const render=new Function('steeringVisual','steerQuat','steeringAxis','steering','activeModel','tuning','pc',rotation);
const previousNames={safari:'Nissan Super Safari',hilux:'Toyota Hilux',urus:'Urus Absolut',sterrato:'Lamborghini Huracan Sterrato',raptor:'Ford F-150 Raptor R',everest:'Ford Everest',suv:'SUV','range-rover':'Range Rovar','defender-90':'Defendar 90','defender-grasmere':'Defendar Grasmere','ram-trx':'Ramm 1500 TRX',fortuner:'Toyoda Fortuner',gladiator:'Jeap Gladiator',sierra:'GMC Siera AT4X',g63:'Mercedez G 63'};
const reports=[];
for(const [id,profile] of Object.entries(profiles)){
 assert.notEqual(profile.label[0],previousNames[id][0],id+' first letter changed');
 const b=readFileSync(profile.url.replace('./','')),j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12))),node=j.nodes.find(n=>n.name==='Steering');assert(node&&node.mesh!==undefined,id+' independent steering mesh');
 const fit=profile.steeringPosition;assert(fit&&fit.length===3);
 let count=0,minimum=[Infinity,Infinity,Infinity],maximum=[-Infinity,-Infinity,-Infinity];
 for(const p of j.meshes[node.mesh].primitives){const a=j.accessors[p.attributes.POSITION];count+=a.count;for(let i=0;i<3;i++){minimum[i]=Math.min(minimum[i],a.min[i]);maximum[i]=Math.max(maximum[i],a.max[i]);}
  if(id==='range-rover')assert.equal(j.materials[p.material].alphaMode||'OPAQUE','OPAQUE','solid Range steering materials');
 }
 assert(count>200);assert(maximum[0]-minimum[0]>.25&&maximum[0]-minimum[0]<.5,id+' plausible wheel diameter');assert(Math.abs((minimum[0]+maximum[0])/2)<.035,id+' centered wheel pivot');
 const axis=new Vec3(...(profile.steeringAxis||[0,.65,.76])).normalize(),rest=new Quat(),visual={q:new Quat(),setLocalRotation(q){this.q.copy(q);}},point=new Vec3(.17,0,0);
 for(const input of [-.3,0,.3]){
  render(visual,new Quat(),axis,input,{steeringRest:rest},profile,{Vec3});const normal=visual.q.transformVector(axis),turned=visual.q.transformVector(point);
  assert(normal.distance(axis)<1e-6,id+' column axis stays fixed');assert(Math.abs(turned.length()-point.length())<1e-6,id+' wheel turns without orbiting its pivot');
  assert(input===0?Math.abs(visual.q.w-1)<1e-6:Math.abs(visual.q.w-1)>.1,id+' responds to steering and centers');
 }
 reports.push({id,label:profile.label,independentWheel:true,vertices:count,columnAxisPreserved:true});
}
writeFileSync('steering-validation.json',JSON.stringify({passed:true,vehicles:reports},null,2));console.log({passed:true,steeringWheels:reports.length,renamedFirstLetters:true,rangeWheelOpaque:true});
