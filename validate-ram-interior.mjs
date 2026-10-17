import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('.',import.meta.url)));
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const file=readFileSync('assets/ram-trx.glb'),length=file.readUInt32LE(12),gltf=JSON.parse(file.subarray(20,20+length).toString()),binary=file.subarray(28+length);
const interior=gltf.materials.findIndex(m=>m.name==='RAM_1500TRX_2021InteriorA_Material');assert(interior>=0);
const material=gltf.materials[interior];assert.equal(material.alphaMode||'OPAQUE','OPAQUE','dashboard must not use packed texture alpha as transparency');assert(material.pbrMetallicRoughness.metallicFactor<.1,'leather/plastic are not metal');assert(material.pbrMetallicRoughness.roughnessFactor>.65,'dashboard has a matte finish');
let count=0,uvMin=[Infinity,Infinity],uvMax=[-Infinity,-Infinity];
for(const mesh of gltf.meshes)for(const p of mesh.primitives){if(p.material!==interior)continue;const a=gltf.accessors[p.attributes.TEXCOORD_0];assert(a,'interior has primary UV coordinates');assert.equal(a.componentType,5126);const v=gltf.bufferViews[a.bufferView],offset=(v.byteOffset||0)+(a.byteOffset||0),stride=v.byteStride||8;for(let i=0;i<a.count;i++)for(let j=0;j<2;j++){const value=binary.readFloatLE(offset+i*stride+j*4);uvMin[j]=Math.min(uvMin[j],value);uvMax[j]=Math.max(uvMax[j],value);}count+=a.count;}
assert(count>10000&&uvMax.every((value,i)=>value-uvMin[i]>.9),'interior uses its original atlas rather than collapsed UVs');
const report={passed:true,opaqueDashboard:true,nonMetallicCabin:true,matteSurfaces:true,primaryUvVertices:count,uvRange:{min:uvMin,max:uvMax}};console.log(report);writeFileSync('ram-interior-validation.json',JSON.stringify(report,null,2));
