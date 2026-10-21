import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {vehicleNames,applyVehicleNames} from './vehicle-names.js';
import {attachedFleetProfiles} from './attached-fleet-profiles.js';
import {bikeProfiles} from './bike-profiles.js';
const source=readFileSync(new URL('./main.js',import.meta.url),'utf8');
const base=new Function(source.slice(source.indexOf('const vehicleProfiles='),source.indexOf('let activeVehicleId='))+'return vehicleProfiles;')();
const profiles={...base,...structuredClone(attachedFleetProfiles),...structuredClone(bikeProfiles)};
const originalUrls=Object.fromEntries(Object.entries(profiles).map(([id,p])=>[id,p.url]));applyVehicleNames(profiles);
assert.equal(Object.keys(profiles).length,27);assert.equal(new Set(Object.values(profiles).map(p=>p.label.toLowerCase())).size,27);
for(const [id,p] of Object.entries(profiles)){
 const {original,name}=vehicleNames[id];assert.equal(p.label,name);assert.match(name,/^[A-Za-z][A-Za-z0-9]*$/);assert.notEqual(name[0].toLowerCase(),original[0].toLowerCase());assert.equal(name.slice(1).toLowerCase(),original.slice(1).toLowerCase());assert.equal(p.url,originalUrls[id]);
}
assert(source.indexOf('applyVehicleNames(vehicleProfiles);')>source.indexOf('Object.assign(vehicleProfiles,bikeProfiles);'));
function glb(id){const b=readFileSync(new URL('./assets/'+id+'.glb',import.meta.url)),n=b.readUInt32LE(12),g=JSON.parse(b.subarray(20,20+n)),bin=b.subarray(28+n);
 function array(i){const a=g.accessors[i],v=g.bufferViews[a.bufferView],width={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],size={5126:4,5125:4,5123:2,5121:1}[a.componentType],method={5126:'readFloatLE',5125:'readUInt32LE',5123:'readUInt16LE',5121:'readUInt8'}[a.componentType];return Array.from({length:a.count},(_,r)=>Array.from({length:width},(_,c)=>bin[method]((v.byteOffset||0)+(a.byteOffset||0)+r*(v.byteStride||size*width)+c*size)));}
 function triangles(name){const node=g.nodes.find(n=>n.name===name),out=[];for(const p of g.meshes[node.mesh].primitives){const pos=array(p.attributes.POSITION),ix=array(p.indices).flat();for(let i=0;i<ix.length;i+=3)out.push({material:g.materials[p.material].name,q:ix.slice(i,i+3).map(j=>pos[j].map((v,k)=>v+(node.translation?.[k]||0)))});}return out;}
 return{g,triangles};
}
const hauler=glb('expedition-hauler'),fit=profiles['expedition-hauler'];assert(fit.originalSteering);assert(!fit.fittedSteering);assert(fit.steeringPosition[0]>.4);assert(Math.abs(fit.cockpitEye[0]-fit.steeringPosition[0])<.01);
const wheel=hauler.triangles('Steering');assert.equal(wheel.length,168,'original wheel replaces the fitted assembly');
const signature=t=>t.q.map(p=>p.map(v=>v.toFixed(4)).join(',')).sort().join('|'),wheelFaces=new Set(wheel.map(signature));assert(hauler.triangles('Body').every(t=>!wheelFaces.has(signature(t))),'no original wheel faces left in the body');
const gortuner=glb('gortuner-classic');let badgeFaces=0;for(const t of gortuner.triangles('Body')){if(t.material!=='chrome.001')continue;const c=[0,1,2].map(k=>t.q.reduce((a,p)=>a+p[k],0)/3);if(Math.abs(c[0])<.065&&c[1]>.40&&c[1]<.46&&c[2]<-2.15&&c[2]>-2.25)badgeFaces++;}assert.equal(badgeFaces,0,'front emblem geometry removed');
writeFileSync(new URL('./vehicle-cleanup-validation.json',import.meta.url),JSON.stringify({passed:true,frontBadgeRemoved:true,haulerSingleOriginalWheel:true,rightHandDrive:true,names:Object.fromEntries(Object.entries(profiles).map(([id,p])=>[id,p.label]))},null,2));console.log('Passed: front emblem removed; Hauler has one original RHD wheel; all 27 names are unique single words with changed first letters.');
