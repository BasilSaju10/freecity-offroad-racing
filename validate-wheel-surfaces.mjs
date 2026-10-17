import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {solidifyWheelSurfaces} from './wheel-surfaces.js';
process.chdir(fileURLToPath(new URL('.',import.meta.url)));
const source=readFileSync('main.js','utf8'),profiles=new Function(source.slice(source.indexOf('const vehicleProfiles='),source.indexOf('let activeVehicleId='))+'return vehicleProfiles;')(),audit=JSON.parse(readFileSync('wheel-opacity-audit.json'));
let assemblies=0,materials=0,windows=0;
for(const [id,profile] of Object.entries(profiles)){
 const b=readFileSync(profile.url.replace('./','')),length=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+length)),indices=new Set();
 for(const node of j.nodes)if(node.name?.startsWith('Wheel_')){assemblies++;for(const p of j.meshes[node.mesh].primitives)indices.add(p.material);}
 for(const [i,m] of j.materials.entries())if(/tyre|tire|rubber|borracha|rowerwheel/i.test(m.name))indices.add(i);
 for(const i of indices){const m=j.materials[i];assert.equal(m.alphaMode||'OPAQUE','OPAQUE',id+' solid '+m.name);assert.equal((m.pbrMetallicRoughness?.baseColorFactor||[1,1,1,1])[3],1,id+' full opacity');assert.equal(m.doubleSided,true,id+' no backface holes');materials++;}
 for(const m of j.materials)if(/cabin_glass|windscreen|window/i.test(m.name)&&m.alphaMode==='BLEND')windows++;
 const recorded=audit.vehicles.find(v=>v.id===id);assert(recorded);assert.equal(createHash('sha256').update(b.subarray(20+length)).digest('hex'),recorded.binarySha256,id+' original geometry, rim openings and textures retained');
}
assert.equal(assemblies,Object.keys(profiles).length*4);assert(windows>0,'real window transparency preserved');
const pc={BLEND_NONE:0,CULLFACE_NONE:0},texture={},make=name=>({name,blendType:2,opacity:.3,opacityMap:texture,diffuseMap:texture,depthWrite:false,cull:1,refraction:.5,update(){this.updated=true;}});
const tyre=make('Imported wheel'),spare=make('TyreCover_Y'),glass=make('Cabin_glass'),body=make('Bodywork');
const root=ms=>({findComponents:()=>[{meshInstances:ms.map(material=>({material}))}]});
solidifyWheelSurfaces(pc,root([spare,glass,body]),Array.from({length:4},()=>root([tyre])),[]);
for(const m of [tyre,spare]){assert.equal(m.blendType,0);assert.equal(m.opacity,1);assert.equal(m.opacityMap,null);assert.equal(m.diffuseMap,texture,'keep colour texture');assert.equal(m.depthWrite,true);assert.equal(m.cull,0);assert.equal(m.refraction,0);assert(m.updated);}
assert(!glass.updated&&!body.updated,'unrelated body and window materials untouched');
const report={passed:true,vehicles:Object.keys(profiles).length,roadWheelAssemblies:assemblies,solidWheelMaterials:materials,spareWheelCovers:true,originalGeometryAndTexturesRetained:true,windowsStillTransparent:true};writeFileSync('wheel-surfaces-validation.json',JSON.stringify(report,null,2));console.log(report);
