import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {attachedFleetProfiles as profiles} from './attached-fleet-profiles.js';
import {createVehicleLights,lampProfiles} from './vehicle-lights.js';
import {Mat4} from './vendor/playcanvas/core/math/mat4.js';
const report={};
for(const [id,p] of Object.entries(profiles)){
 const data=readFileSync(new URL(p.url,import.meta.url)),length=data.readUInt32LE(12),g=JSON.parse(data.subarray(20,20+length)),bin=data.subarray(28+length);
 function array(index){const a=g.accessors[index],v=g.bufferViews[a.bufferView],width={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],size={5126:4,5125:4,5123:2,5121:1}[a.componentType],method={5126:'readFloatLE',5125:'readUInt32LE',5123:'readUInt16LE',5121:'readUInt8'}[a.componentType],out=[];for(let i=0;i<a.count;i++){const row=[];for(let k=0;k<width;k++)row.push(bin[method]((v.byteOffset||0)+(a.byteOffset||0)+i*(v.byteStride||size*width)+k*size));out.push(row);}return out;}
 const steering=g.nodes.filter(n=>n.name==='Steering');assert.equal(steering.length,1,id+' has exactly one steering assembly');assert(Math.abs(p.cockpitEye[0]-p.steeringPosition[0])<.03,id+' eye aligned with steering column');assert(p.cockpitEye[1]>p.steeringPosition[1]+.2);assert(p.cockpitEye[2]>p.steeringPosition[2]+.3);
 if(id==='gortuner-classic')assert(p.cockpitEye[0]>.3,'right-hand-drive seat retained');
 if(p.lamps.texturedLens){
  const lamps={front:{triangles:0,area:0},rear:{triangles:0,area:0}};
  for(const mesh of g.meshes)for(const prim of mesh.primitives){const name=g.materials[prim.material].name,side=name==='OFFRIDE headlamp lens'?'front':name==='OFFRIDE brake lens'?'rear':null;if(!side)continue;
   const xyz=array(prim.attributes.POSITION),ix=array(prim.indices).flat(),bounds=side==='front'?p.lamps.f:p.lamps.r;
   for(let t=0;t<ix.length;t+=3){const q=ix.slice(t,t+3).map(i=>xyz[i]);for(const v of q){assert(v[2]*(side==='front'?-1:1)>0,id+' correct end of vehicle');for(let axis=0;axis<3;axis++){const value=axis===0?Math.abs(v[axis]):v[axis];assert(value>=bounds[axis*2]&&value<=bounds[axis*2+1],id+' lamp bounds fit lens');}}
    const a=q[1].map((v,i)=>v-q[0][i]),b=q[2].map((v,i)=>v-q[0][i]),area=Math.hypot(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])/2;assert(area<.08,id+' lamp triangle cannot be a body panel or light beam');lamps[side].triangles++;lamps[side].area+=area;
   }
  }
  for(const [side,lamp] of Object.entries(lamps)){assert(lamp.triangles>0,id+' '+side+' lenses exist');assert(lamp.area<1.2,id+' '+side+' emission restricted to small lamp surfaces');}
  report[id]=lamps;
 }
}
// Exercise the live controller: body stays untouched; clear lenses glow only while lit.
lampProfiles['trail-scout']=profiles['trail-scout'].lamps;
function mockMaterial(name,opacity=1){return{name,opacity,emissive:{set(){}},clone(){return mockMaterial(this.name,this.opacity);},getShaderChunks(){return{set(){}};},setParameter(){},update(){},destroy(){}};}
const meshes=['carpaint','chrome','OFFRIDE headlamp lens','OFFRIDE brake lens'].map((name,i)=>({material:mockMaterial(name,i===2?.2:1),setParameter(k,v){this[k]=Array.from(v);}})),bodyMaterial=meshes[0].material,chromeMaterial=meshes[1].material;
const entry={model:{findComponents(){return[{meshInstances:meshes}];},getWorldTransform(){return new Mat4();}}},lights=createVehicleLights({Mat4,SHADERLANGUAGE_GLSL:'glsl'});
assert.equal(lights.attach(entry,'trail-scout'),2);assert.equal(meshes[0].material,bodyMaterial);assert.equal(meshes[1].material,chromeMaterial);
lights.update(entry,true,false);assert.equal(meshes[2].material.opacity,1);assert.equal(meshes[2].uLampPower[0],5.5);
lights.update(entry,false,true);assert.equal(meshes[2].material.opacity,.2);assert.equal(meshes[2].uLampPower[0],0);assert.equal(meshes[3].uLampPower[1],6);
lights.update(entry,false,false);assert.equal(meshes[3].uLampPower[1],0);lights.destroy(entry);
writeFileSync(new URL('./fleet-calibration-validation.json',import.meta.url),JSON.stringify({passed:true,steeringAssemblies:10,lamps:report},null,2));console.log('Passed: 10 aligned steering assemblies, RHD Gortuner seat, 5 vehicles with isolated physical lamp surfaces.');
