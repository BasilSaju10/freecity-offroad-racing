import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
process.chdir(fileURLToPath(new URL('.',import.meta.url)));
const ids=['vehicle','range-rover','defender-90','defender-grasmere','ram-trx','fortuner','gladiator','sierra','g63','raptor','everest','safari','hilux','urus','sterrato'];const reports=[];
for(const id of ids){const b=readFileSync('assets/'+id+'.glb'),j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));for(const m of j.materials)assert(!/badge|emblem|(^logo([_.]|$))|sierra_logo|at4x_logo|gmc_red|manufacturerplate|licenseplate/i.test(m.name),id+' dedicated branding removed');const report=JSON.parse(readFileSync('assets/'+id+'-debranding.json'));assert(report.plainSteeringHub);assert(report.plainWheelSidewalls>0);assert(j.materials.some(m=>m.name==='Plain leather airbag'||(id==='urus'&&m.name==='Vrus stitched charcoal leather')));assert(j.materials.some(m=>m.name==='Plain unlettered rubber'));reports.push(report);}
assert(reports.find(r=>r.vehicle==='sierra').sourceLogoObjects>0);assert(reports.find(r=>r.vehicle==='ram-trx').plainDashboardFaces>0);
writeFileSync('unbranded-validation.json',JSON.stringify({passed:true,vehicles:reports},null,2));console.log({passed:true,vehicles:ids.length,removedDedicatedBadges:true,plainSteeringAndWheelCentres:true,blankSidewalls:true,ramDashboardBlank:true});

for(const id of ['fortuner','g63','sierra'])assert(JSON.parse(readFileSync('assets/'+id+'-corrections.json')).logoFacesRemoved>0);
// The Hilux registration texture includes manufacturer lettering despite its generic material name.
const hiluxBytes=readFileSync('assets/hilux.glb');
const hilux=JSON.parse(hiluxBytes.subarray(20,20+hiluxBytes.readUInt32LE(12)));
for(const mesh of hilux.meshes)for(const primitive of mesh.primitives){
  const texture=hilux.materials[primitive.material].pbrMetallicRoughness?.baseColorTexture?.index;
  if(texture!==undefined)assert(hilux.images[hilux.textures[texture].source].name!=='HILUX_LICENSEPLATE','Hilux registration panels must have no Toyota/Hilux lettering');
}
const rims=JSON.parse(readFileSync('assets/fortuner-corrections.json')).rimVertices;for(const key of ['FL','FR','RL','RR'])assert(rims[key]>2700,'rim geometry attached to '+key);
const g63Bytes=readFileSync('assets/g63.glb');
const g63=JSON.parse(g63Bytes.subarray(20,20+g63Bytes.readUInt32LE(12)));
for(const mesh of g63.meshes)for(const primitive of mesh.primitives){
  const texture=g63.materials[primitive.material].pbrMetallicRoughness?.baseColorTexture?.index;
  if(texture!==undefined)assert(!/ManufacturerPlate/i.test(g63.images[g63.textures[texture].source].name),'G63 registration panel must have no AMG texture');
}
assert(JSON.parse(readFileSync('assets/vehicle-corrections.json')).matteBlack);
