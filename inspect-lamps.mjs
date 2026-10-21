import fs from 'node:fs';
import {Mat4,Vec3,Quat} from './vendor/playcanvas/index.js';
for(const file of fs.readdirSync('assets').filter(f=>f.endsWith('.glb'))){
 const b=fs.readFileSync('assets/'+file),len=b.readUInt32LE(12),g=JSON.parse(b.subarray(20,20+len)),bin=b.subarray(28+len),groups=new Map();
 function walk(i,parent){const n=g.nodes[i],m=n.matrix?new Mat4().set(n.matrix):new Mat4().setTRS(new Vec3(...n.translation||[0,0,0]),new Quat(...n.rotation||[0,0,0,1]),new Vec3(...n.scale||[1,1,1])),world=new Mat4().mul2(parent,m);
  if(n.mesh!==undefined)for(const p of g.meshes[n.mesh].primitives){const a=g.accessors[p.attributes.POSITION],v=g.bufferViews[a.bufferView],stride=v.byteStride||12,base=(v.byteOffset||0)+(a.byteOffset||0),name=g.materials[p.material]?.name||'';
   for(let k=0;k<a.count;k++){const t=world.transformPoint(new Vec3(bin.readFloatLE(base+k*stride),bin.readFloatLE(base+k*stride+4),bin.readFloatLE(base+k*stride+8)));if(Math.abs(t.x)<.3||t.y<.05)continue;const region=t.z<-.8?'front':t.z>.8?'rear':'mid';const key=p.material+':'+region;let r=groups.get(key);if(!r)groups.set(key,r={name,lo:[Infinity,Infinity,Infinity],hi:[-Infinity,-Infinity,-Infinity],n:0});[Math.abs(t.x),t.y,t.z].forEach((q,j)=>{r.lo[j]=Math.min(q,r.lo[j]);r.hi[j]=Math.max(q,r.hi[j]);});r.n++;}
  }for(const child of n.children||[])walk(child,world);
 }for(const i of g.scenes[g.scene||0].nodes)walk(i,new Mat4());
 console.log('\n'+file);for(const [key,r]of groups)if((/light|lamp|emit|emiss|glass|vidro|detail|material\.00|primary|boot_ok|chrome/i.test(r.name))&&!/cabin|wheel|steer|interior/i.test(r.name)&&!key.endsWith('mid'))console.log(key,r.name,r.n,r.lo.map(x=>+x.toFixed(3)),r.hi.map(x=>+x.toFixed(3)));
}
