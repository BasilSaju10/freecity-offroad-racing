import {gutterTextures,gutterNormalRG} from './gamblers-textures.js';
import {createMapPhysics} from './freecity-world.js';
import {createGutterTerrainMaterial} from './gamblers-terrain.js';

export const gutterView={fogStart:90,fogEnd:145,clip:180,cull:170,cell:32};
export async function loadGamblersGutter(pc,C,app,world){
 const path='./assets/gamblers/',assetUrl=p=>globalThis.offrideAssets?.url(p)||p,url=p=>assetUrl(path+p);
 const read=async(p,format)=>{const r=await fetch(url(p));if(!r.ok)throw Error('Could not load map: '+p);return r[format]();};
 const [scene,meta,buffer,layerBuffer]=await Promise.all([read('scene.json','json'),read('physics.json','json'),read('heights.bin','arrayBuffer'),read('layers.bin','arrayBuffer')]);
 const result=createMapPhysics(C,world,meta,buffer),n=meta.n,heights=new Float32Array(buffer),layers=new Uint8Array(layerBuffer),chunks=[];
 result.viewDistance=gutterView;
 const {textureAsset,texture}=gutterTextures(pc,app,scene,url);
 result.surfaceAt=(x,z)=>{const ix=Math.max(0,Math.min(n-1,Math.round(x+256))),iy=Math.max(0,Math.min(n-1,Math.round(256-z))),layer=layers[iy*n+ix];return layer===1?{name:'ROCK TRAIL',grip:1.9,resistance:.045,depth:0}:layer===0?{name:'FOREST',grip:1.4,resistance:.055,depth:0}:{name:'DIRT TRAIL',grip:1.65,resistance:.035,depth:0};};
 // Keep the existing car/bike suspension response, using the map's painted surface IDs.
 result.surfaceInfo=body=>result.surfaceAt(body.position.x,body.position.z);
 const velocity=new C.Vec3(),force=new C.Vec3(),relative=new C.Vec3();
 result.applyWheelSurface=(vehicle,body,tuning,i,handbrake)=>{const wheel=vehicle.wheelInfos[i];if(!wheel.isInContact)return;const p=wheel.raycastResult.hitPointWorld,s=result.surfaceAt(p.x,p.z);wheel.frictionSlip=s.grip*(handbrake?.4:1);body.getVelocityAtWorldPoint(p,velocity);force.set(-velocity.x*tuning.mass*s.resistance/4,0,-velocity.z*tuning.mass*s.resistance/4);p.vsub(body.position,relative);body.applyForce(force,relative);};
 function addChunk(e,minX,maxX,minZ,maxZ){chunks.push({e,minX,maxX,minZ,maxZ});e.enabled=false;}
 function meshEntity(name,p,ix,uv,material,colors){const mesh=new pc.Mesh(app.graphicsDevice);mesh.setPositions(p);mesh.setNormals(pc.calculateNormals(p,ix));mesh.setUvs(0,uv);if(colors)mesh.setColors32(colors);mesh.setIndices(ix);mesh.update();const e=new pc.Entity(name);e.addComponent('render',{meshInstances:[new pc.MeshInstance(mesh,material)],castShadows:false,receiveShadows:true});app.root.addChild(e);return e;}
 const terrain=await createGutterTerrainMaterial(pc,app,scene,url,texture);
 for(let sy=0;sy<n-1;sy+=gutterView.cell)for(let sx=0;sx<n-1;sx+=gutterView.cell){
  const width=Math.min(gutterView.cell,n-1-sx)+1,depth=Math.min(gutterView.cell,n-1-sy)+1,p=[],uv=[],colors=[],ix=[];
  for(let y=0;y<depth;y++)for(let x=0;x<width;x++){const gx=sx+x,gy=sy+y,i=y*width+x;p.push(gx-256,heights[gx*n+gy],256-gy);uv.push(gx,gy);for(let l=0;l<4;l++)colors.push(layers[gy*n+gx]===l?255:0);if(x<width-1&&y<depth-1)ix.push(i,i+1,i+width,i+1,i+width+1,i+width);}
  const e=meshEntity('Gutter terrain '+sx+','+sy,p,ix,uv,terrain,colors);addChunk(e,sx-256,sx+width-257,257-sy-depth,256-sy);
 }
 for(const road of scene.roads){
  if(road.nodes.length<2)continue;const p=[],uv=[],ix=[];let distance=0;const nodes=road.nodes;
  for(let k=0;k<nodes.length-1;k++){
   const a=nodes[Math.max(0,k-1)],b=nodes[k],c=nodes[k+1],d=nodes[Math.min(nodes.length-1,k+2)],count=Math.max(2,Math.ceil(Math.hypot(c[0]-b[0],c[1]-b[1])));
   for(let j=0;j<count;j++){const t=j/count,tt=t*t,ttt=tt*t;const x=.5*(2*b[0]+(-a[0]+c[0])*t+(2*a[0]-5*b[0]+4*c[0]-d[0])*tt+(-a[0]+3*b[0]-3*c[0]+d[0])*ttt)-256,z=256-.5*(2*b[1]+(-a[1]+c[1])*t+(2*a[1]-5*b[1]+4*c[1]-d[1])*tt+(-a[1]+3*b[1]-3*c[1]+d[1])*ttt),dx=.5*((-a[0]+c[0])+2*(2*a[0]-5*b[0]+4*c[0]-d[0])*t+3*(-a[0]+3*b[0]-3*c[0]+d[0])*tt),dy=.5*((-a[1]+c[1])+2*(2*a[1]-5*b[1]+4*c[1]-d[1])*t+3*(-a[1]+3*b[1]-3*c[1]+d[1])*tt),len=Math.max(.01,Math.hypot(dx,dy)),w=(b[3]*(1-t)+c[3]*t)*.5,offset=p.length/3;
    if(offset)distance+=Math.hypot(x-(p.at(-6)+p.at(-3))*.5,z-(p.at(-4)+p.at(-1))*.5);
    for(const side of [-1,1]){const px=x-side*dy/len*w,pz=z-side*dx/len*w;p.push(px,result.heightAt(px,pz)+.035,pz);uv.push((side+1)/2,distance/(road.length||10));}
    if(offset>=2)ix.push(offset-2,offset,offset-1,offset-1,offset,offset+1);
   }
  }
  const m=new pc.StandardMaterial();m.diffuseMap=await texture(road.texture);m.useMetalness=true;m.metalness=0;m.gloss=.02;m.blendType=pc.BLEND_NORMAL;m.opacityMap=await texture(road.opacity)||m.diffuseMap;m.opacityMapChannel=road.opacity?'r':'a';m.cull=pc.CULLFACE_NONE;m.depthWrite=false;m.update();
  const e=meshEntity('Gutter original road',p,ix,uv,m);const xs=p.filter((v,i)=>i%3===0),zs=p.filter((v,i)=>i%3===2);addChunk(e,Math.min(...xs),Math.max(...xs),Math.min(...zs),Math.max(...zs));
 }
 let cursor=0,ready=0;const models=Object.entries(scene.models);
 async function loadModel(){while(cursor<models.length){const [key,info]=models[cursor++],contents=await read(info.url,'arrayBuffer');
  const asset=await new Promise((resolve,reject)=>{const a=new pc.Asset(info.url,'container',{url:url(info.url),filename:info.url,contents},null,{image:{processAsync(image,done){textureAsset(image.uri.replace('../','')).then(t=>done(null,t),done);}}});app.assets.add(a);a.ready(()=>resolve(a));a.on('error',e=>reject(Error(String(e))));app.assets.load(a);});
  for(const a of asset.resource.materials){const m=a.resource,entry=scene.materialMaps[m.name],maps=entry?.maps||{},s=entry?.settings||{};
   if(maps.normalMap){m.normalMap=await texture(maps.normalMap);if(scene.textureFormats[maps.normalMap]==='BC5U')m.getShaderChunks(pc.SHADERLANGUAGE_GLSL).set('normalMapPS',gutterNormalRG);}if(maps.roughnessMap){m.glossMap=await texture(maps.roughnessMap);m.glossMapChannel='r';m.glossInvert=true;m.gloss=1;}if(maps.ambientOcclusionMap){m.aoMap=await texture(maps.ambientOcclusionMap);m.aoMapChannel='r';}if(maps.detailMap){m.diffuseDetailMap=await texture(maps.detailMap);m.diffuseDetailMapTiling.set(...(s.detailScale||[1,1]));}if(maps.detailNormalMap){m.normalDetailMap=await texture(maps.detailNormalMap);m.normalDetailMapTiling.set(...(s.detailScale||[1,1]));m.normalDetailMapBumpiness=s.detailNormalMapStrength??1;}
   const opacity=scene.opacityMaps[m.name];if(opacity){m.opacityMap=await texture(opacity.texture);m.opacityMapChannel='r';m.alphaTest=opacity.cutoff;m.cull=pc.CULLFACE_NONE;}m.useDynamicRefraction=false;m.refraction=0;m.update();
  }
  const cells=new Map();for(const original of scene.instances[key]){const matrix=original.slice();matrix[12]-=256;matrix[13]-=scene.heightOffset;matrix[14]+=256;const id=Math.floor(matrix[12]/32)+','+Math.floor(matrix[14]/32);if(!cells.has(id))cells.set(id,[]);cells.get(id).push(matrix);}
  for(const [id,matrices]of cells){const e=asset.resource.instantiateRenderEntity();e.name='Gutter '+id+' '+info.source.split('/').at(-1);app.root.addChild(e);const vb=new pc.VertexBuffer(app.graphicsDevice,pc.VertexFormat.getDefaultInstancingFormat(app.graphicsDevice),matrices.length,{data:new Float32Array(matrices.flat())});
   let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
   for(const render of e.findComponents('render')){render.castShadows=!/bush|fern|groundcover/i.test(info.source);for(const mi of render.meshInstances){
    const local=mi.mesh.aabb,box=new pc.BoundingBox(),union=new pc.BoundingBox(),mat=new pc.Mat4();let first=true;
    for(const values of matrices){mat.set(values);box.setFromTransformedAabb(local,mat);if(first){union.copy(box);first=false;}else union.add(box);}
    mi.setInstancing(vb,true);mi.instancingCount=matrices.length;mi.setCustomAabb(union);
    minX=Math.min(minX,union.center.x-union.halfExtents.x);maxX=Math.max(maxX,union.center.x+union.halfExtents.x);minZ=Math.min(minZ,union.center.z-union.halfExtents.z);maxZ=Math.max(maxZ,union.center.z+union.halfExtents.z);
   }}addChunk(e,minX,maxX,minZ,maxZ);
  }
 ready++;globalThis.offrideLoading?.stage(96+ready/models.length,`Loading map scenery ${ready}/${models.length}`);
 }}
 await Promise.all(Array.from({length:2},loadModel));
 let clock=1;result.updateVisibility=(p,dt)=>{clock+=dt;if(clock<.15)return;clock=0;for(const c of chunks){const dx=Math.max(c.minX-p.x,0,p.x-c.maxX),dz=Math.max(c.minZ-p.z,0,p.z-c.maxZ);c.e.enabled=dx*dx+dz*dz<gutterView.cull**2;}};
 result.updateVisibility(meta.spawn,1);globalThis.offrideLoading?.stage(97,'Gambler’s Gutter ready');
 return result;
}
