import diffuse from './vendor/playcanvas/scene/shader-lib/glsl/chunks/standard/frag/diffuse.js';
import gloss from './vendor/playcanvas/scene/shader-lib/glsl/chunks/standard/frag/gloss.js';
import metalness from './vendor/playcanvas/scene/shader-lib/glsl/chunks/standard/frag/metalness.js';
import {advanceSoil} from './soil-state.js';

const soilShader=`
uniform mat4 uSoilInverse;
uniform vec4 uSoilLevel;
uniform vec4 uSoilShape;
float soilCoverage;
float soilHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float soilNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(soilHash(i),soilHash(i+vec3(1,0,0)),f.x),mix(soilHash(i+vec3(0,1,0)),soilHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(soilHash(i+vec3(0,0,1)),soilHash(i+vec3(1,0,1)),f.x),mix(soilHash(i+vec3(0,1,1)),soilHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
`;
const applySoil=`
void getAlbedo(){
 getCleanAlbedo();
 vec3 p=(uSoilInverse*vec4(vPositionW,1.0)).xyz;
 float grain=.65*soilNoise(p*24.0)+.35*soilNoise(p*65.0);
 float splashes=soilNoise(p*vec3(13.0,24.0,17.0));
 float region;
 if(uSoilShape.x>.5){
  // Local wheel coordinates rotate with the tyre, so stuck mud rotates with it.
  float ring=length(p.yz)/uSoilShape.y;
  region=smoothstep(.32,.88,ring);
 }else{
  float lower=1.0-smoothstep(-.10+uSoilLevel.y*.22,.35+uSoilLevel.y*.45,p.y);
  float outside=max(smoothstep(uSoilShape.y*.60,uSoilShape.y*.95,abs(p.x)),smoothstep(uSoilShape.z*.80,uSoilShape.z*.98,abs(p.z)));
  region=lower*outside;
 }
 float muddy=uSoilLevel.y*smoothstep(.65-uSoilLevel.y*.60,.82-uSoilLevel.y*.50,grain)*region;
 float dusty=uSoilLevel.x*region*(.18+.48*splashes);
 soilCoverage=clamp(muddy+dusty,0.0,.96);
 vec3 drySoil=mix(vec3(.21,.115,.045),vec3(.34,.23,.12),grain);
 vec3 wetSoil=mix(vec3(.065,.035,.014),vec3(.14,.08,.032),grain);
 vec3 soil=mix(drySoil,wetSoil,uSoilLevel.z*.85);
 dAlbedo=mix(dAlbedo,soil,soilCoverage);
}
`;

export const mudParticleColor=[.17,.095,.035];

export function createDrivingSoil(pc,app,map,camera){
 const patched=new WeakSet();
 function patch(m){
  if(patched.has(m))return;patched.add(m);
  m.setParameter('uSoilInverse',new pc.Mat4().data);m.setParameter('uSoilLevel',new Float32Array(4));m.setParameter('uSoilShape',new Float32Array([0,1,2,0]));
  const chunks=m.getShaderChunks(pc.SHADERLANGUAGE_GLSL);
  chunks.set('diffusePS',soilShader+diffuse.replace('void getAlbedo()', 'void getCleanAlbedo()')+applySoil);
  chunks.set('glossPS',gloss.replace('void getGlossiness()', 'void getCleanGlossiness()')+'\nvoid getGlossiness(){getCleanGlossiness();dGlossiness=mix(dGlossiness,mix(.06,.38,uSoilLevel.z),soilCoverage);}\n');
  chunks.set('metalnessPS',metalness.replace('void getMetalness()', 'void getCleanMetalness()')+'\nvoid getMetalness(){getCleanMetalness();dMetalness*=1.0-soilCoverage;}\n');
  m.shaderChunksVersion='2.24';m.update();
 }
 const mudCake=new pc.StandardMaterial();mudCake.name='Adhered tyre mud';mudCake.diffuse=new pc.Color(...mudParticleColor);mudCake.gloss=.18;mudCake.update();
 function makeCake(root,instances,radius){
  if(!instances.length)return null;
  const x0=Math.min(...instances.map(mi=>mi.mesh.aabb.center.x-mi.mesh.aabb.halfExtents.x)),x1=Math.max(...instances.map(mi=>mi.mesh.aabb.center.x+mi.mesh.aabb.halfExtents.x));
  const centers=[],offsets=[],positions=[],indices=[];
  const corners=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]],faces=[0,2,4,2,1,4,1,3,4,3,0,4,2,0,5,1,2,5,3,1,5,0,3,5];
  for(let k=0;k<24;k++){
   const angle=k*2.39996,r=radius*(.71+(k%3)*.135),size=.012+(k%4)*.003;
   const center=[k%2?x1-.004:x0+.004,Math.sin(angle)*r,Math.cos(angle)*r],base=positions.length/3;
   for(const c of corners)for(let j=0;j<3;j++){centers.push(center[j]);offsets.push(c[j]*size);positions.push(center[j]+c[j]*size);}
   for(const index of faces)indices.push(base+index);
  }
  const mesh=new pc.Mesh(app.graphicsDevice);mesh.setPositions(positions);mesh.setNormals(pc.calculateNormals(positions,indices));mesh.setIndices(indices);mesh.update(pc.PRIMITIVE_TRIANGLES);
  const entity=new pc.Entity('Mud attached to rotating tyre');entity.addComponent('render',{meshInstances:[new pc.MeshInstance(mesh,mudCake)],castShadows:false});root.addChild(entity);entity.enabled=false;
  return {mesh,entity,centers,offsets,positions};
 }
 function attach(entry,profile,scale,isGlass){
  const roots=[entry.model,...entry.wheels];
  const groups=roots.map((root,i)=>{
   const inverse=new pc.Mat4(),levels=new Float32Array(4),state={mud:0,dust:0,wet:0};
   const shape=new Float32Array(i?[1,profile.radius,0,0]:[0,(profile.hullWidth||.94)*scale,(profile.hullLength||2.25)*scale,0]);
   const instances=root.findComponents('render').flatMap(r=>r.meshInstances).filter(mi=>!isGlass(mi.material.name)&&mi.material.useLighting!==false);
   for(const mi of instances){patch(mi.material);mi.setParameter('uSoilInverse',inverse.data);mi.setParameter('uSoilLevel',levels);mi.setParameter('uSoilShape',shape);}
   const cake=i?makeCake(root,instances,profile.radius):null;
   return {root,inverse,levels,state,instances,cake,credit:0};
  });
  entry.soil={groups,profile};return entry.soil;
 }
 // Bounded pools: no growing entity list or per-frame particle allocations.
 const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d');
 const gradient=ctx.createRadialGradient(32,32,2,32,32,31);gradient.addColorStop(0,'rgba(255,255,255,.65)');gradient.addColorStop(.4,'rgba(255,255,255,.32)');gradient.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
 const texture=new pc.Texture(app.graphicsDevice,{mipmaps:false});texture.setSource(canvas);
 const dust=new pc.StandardMaterial();dust.name='Airborne trail dust';dust.useLighting=false;dust.diffuse=new pc.Color(0,0,0);dust.emissive=new pc.Color(...mudParticleColor);dust.emissiveMap=texture;dust.opacityMap=texture;dust.opacityMapChannel='a';dust.opacity=.5;dust.blendType=pc.BLEND_NORMAL;dust.depthWrite=false;dust.cull=pc.CULLFACE_NONE;dust.update();
 const clod=new pc.StandardMaterial();clod.name='Wet mud thrown from tyres';clod.diffuse=new pc.Color(...mudParticleColor);clod.gloss=.25;clod.update();
 const particles=Array.from({length:96},(_,i)=>{const e=new pc.Entity(i<64?'Dust puff':'Mud clod');e.addComponent('render',{type:i<64?'plane':'sphere',castShadows:false,receiveShadows:false});e.render.material=i<64?dust:clod;e.enabled=false;app.root.addChild(e);return {e,dust:i<64,life:0,maxLife:1,size:0,p:new pc.Vec3(),v:new pc.Vec3()};});
 let dustIndex=0,mudIndex=64;
 const tilt=new pc.Quat().setFromEulerAngles(90,0,0),billboard=new pc.Quat();
 function emit(point,velocity,muddy){
  const p=particles[muddy?(mudIndex=64+(mudIndex-63)%32):(dustIndex=(dustIndex+1)%64)];
  p.life=p.maxLife=muddy?.55+Math.random()*.4:.65+Math.random()*.65;p.size=muddy?.025+Math.random()*.04:.18+Math.random()*.20;
  p.p.set(point.x+(Math.random()-.5)*.18,point.y+.07,point.z+(Math.random()-.5)*.18);
  p.v.set(-velocity.x*.15+(Math.random()-.5)*1.2,muddy?1.5+Math.random()*2:.4+Math.random()*.6,-velocity.z*.15+(Math.random()-.5)*1.2);p.e.enabled=true;
 }
 function update(entry,vehicle,chassis,tuning,dt,wheelStates){
  if(!entry?.soil)return;
  const speed=Math.hypot(chassis.velocity.x,chassis.velocity.z),distance=Math.min(speed*dt,2);
  entry.soil.groups.forEach((g,i)=>{
   if(i){const w=vehicle.wheelInfos[i-1];if(w.isInContact){const hit=w.raycastResult.hitPointWorld,surface=map.surfaceAt(hit.x,hit.z);
    const animation=wheelStates?.[i-1],spinSpeed=animation?Math.abs(animation.spin-animation.previousSpin)*120*tuning.radius:speed,agitation=Math.max(speed,spinSpeed);
    advanceSoil(g.state,surface.name,Math.min(agitation*dt,2),dt);
    if(agitation>1&&surface.name!=='WATER CROSSING'){
     const muddy=surface.name==='MUD'||g.state.mud>.3&&g.state.wet>.35;
     g.credit+=dt*Math.min(26,agitation*(muddy?1.7:1.2));
     while(g.credit>=1){emit(hit,chassis.velocity,muddy);if(muddy&&spinSpeed>speed+2)emit(hit,chassis.velocity,false);g.credit--;}
    }
   }else advanceSoil(g.state,'',0,dt);
   }else advanceSoil(g.state,map.surfaceInfo(chassis).name,distance*.40*(vehicle.wheelInfos.some(w=>w.isInContact)?1:0),dt);
   if(g.cake){const cake=g.cake;cake.entity.enabled=g.state.mud>.08;if(cake.entity.enabled){for(let j=0;j<cake.positions.length;j++)cake.positions[j]=cake.centers[j]+cake.offsets[j]*g.state.mud;cake.mesh.setPositions(cake.positions);cake.mesh.update(pc.PRIMITIVE_TRIANGLES);}}
   // Body root is the unscaled physics frame; wheel roots include visual scale.
   const transform=i?g.root.getWorldTransform():entry.model.parent.getWorldTransform();g.inverse.copy(transform).invert();
   g.levels[0]=g.state.dust;g.levels[1]=g.state.mud;g.levels[2]=g.state.wet;
  });
  billboard.mul2(camera.getRotation(),tilt);
  for(const p of particles){if(p.life<=0)continue;p.life-=dt;if(p.life<=0){p.e.enabled=false;continue;}
   p.v.y-=dt*(p.dust?-.12:9.81);p.p.addScaled(p.v,dt);
   if(!p.dust&&p.p.y<map.heightAt(p.p.x,p.p.z)+.025){p.life=0;p.e.enabled=false;continue;}
   p.e.setPosition(p.p);const age=1-p.life/p.maxLife,size=p.size*(p.dust?1+age*3:1);p.e.setLocalScale(size,size,size);
   if(p.dust){p.e.setRotation(billboard);p.e.render.meshInstances[0].setParameter('material_opacity',Math.min(1,age*8)*(1-age)*.5);}
  }
 }
 return {attach,update,particles};
}
