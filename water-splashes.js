import {createWaterSplashState} from './water-splash-state.js';

export function createWaterSplashes(pc,app,map,camera){
 const root=new pc.Entity('Dynamic water splashes');app.root.addChild(root);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d');
 const g=ctx.createRadialGradient(32,32,2,32,32,31);g.addColorStop(0,'rgba(245,253,255,.95)');g.addColorStop(.35,'rgba(194,227,239,.8)');g.addColorStop(1,'rgba(149,204,226,0)');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);
 const texture=new pc.Texture(app.graphicsDevice,{mipmaps:false});texture.setSource(canvas);
 function material(name,color,opacity){const m=new pc.StandardMaterial();m.name=name;m.useLighting=false;m.emissive=new pc.Color(...color);m.opacity=opacity;m.blendType=pc.BLEND_NORMAL;m.depthWrite=false;m.cull=pc.CULLFACE_NONE;m.update();return m;}
 const spray=material('Sunlit water droplets',[.65,.85,.96],.8);spray.emissiveMap=texture;spray.opacityMap=texture;spray.opacityMapChannel='a';spray.update();
 const sheetMat=material('Curved water splash sheets',[.82,.94,1],.55),foamMat=material('Expanding water foam',[.75,.89,.94],.55);
 function meshEntity(name,mat,positions,indices){const mesh=new pc.Mesh(app.graphicsDevice);mesh.setPositions(positions);mesh.setNormals(pc.calculateNormals(positions,indices));mesh.setIndices(indices);mesh.update(pc.PRIMITIVE_TRIANGLES);const e=new pc.Entity(name);e.addComponent('render',{meshInstances:[new pc.MeshInstance(mesh,mat)],castShadows:false,receiveShadows:false});root.addChild(e);e.enabled=false;return {e,mesh,positions};}
 const ringP=[],ringI=[];
 for(let i=0;i<=32;i++){const a=i/32*Math.PI*2;for(const r of [.94,1])ringP.push(Math.sin(a)*r,0,Math.cos(a)*r);if(i<32){const j=i*2;ringI.push(j,j+1,j+2,j+1,j+3,j+2);}}
 const fanI=[],segments=18;
 for(let i=0;i<segments;i++){const j=i*2;fanI.push(j,j+1,j+2,j+1,j+3,j+2);}
 const drops=Array.from({length:160},()=>{const e=new pc.Entity('Water droplet');e.addComponent('render',{type:'plane',castShadows:false,receiveShadows:false});e.render.material=spray;root.addChild(e);e.enabled=false;return {e,life:0,p:new pc.Vec3(),v:new pc.Vec3()};});
 const sheets=Array.from({length:20},()=>({...meshEntity('Tyre splash fan',sheetMat,new Array((segments+1)*6).fill(0),fanI),life:0}));
 const foam=Array.from({length:40},()=>({...meshEntity('Water wake ring',foamMat,ringP,ringI),life:0}));
 let dropIndex=0,sheetIndex=0,foamIndex=0;
 const tilt=new pc.Quat().setFromEulerAngles(90,0,0),billboard=new pc.Quat();
 function emit(type,a){
  if(type==='drop'){
   const p=drops[dropIndex++%drops.length],side=(1+Math.random()*3)*( .25+a.strength),spread=(Math.random()-.5)*2;
   p.life=p.maxLife=.35+Math.random()*.55;p.water=a.y;p.size=.025+Math.random()*.045+a.strength*.025;
   p.p.set(a.x+(Math.random()-.5)*.25,a.y+.03,a.z+(Math.random()-.5)*.25);
   p.v.set(a.sx*side-a.vx*.20+spread,1.0+Math.random()*(2.3+a.strength*3),a.sz*side-a.vz*.20+spread);p.e.enabled=true;
  }else if(type==='sheet'){
   const p=sheets[sheetIndex++%sheets.length];p.life=p.maxLife=.42+a.strength*.22;p.strength=a.strength;p.angle=Math.atan2(a.sx,a.sz);p.e.setPosition(a.x,a.y,a.z);p.e.enabled=true;
  }else{
   const p=foam[foamIndex++%foam.length];p.life=p.maxLife=.75+a.strength*.65;p.strength=a.strength;p.e.setPosition(a.x,a.y,a.z);p.e.enabled=true;
  }
 }
 const state=createWaterSplashState(map,emit);
 function reset(){state.reset();for(const p of [...drops,...sheets,...foam]){p.life=0;p.e.enabled=false;}}
 function opacity(p,value){p.e.render.meshInstances[0].setParameter('material_opacity',value);}
 function update(key,vehicle,chassis,tuning,dt){
  state.update(key,vehicle,chassis,tuning,dt);billboard.mul2(camera.getRotation(),tilt);
  for(const p of drops){if(p.life<=0)continue;p.life-=dt;p.v.y-=9.81*dt;p.p.addScaled(p.v,dt);
   if(p.life<=0||p.p.y<p.water||p.p.y<map.heightAt(p.p.x,p.p.z)){p.life=0;p.e.enabled=false;continue;}
   p.e.setPosition(p.p);p.e.setRotation(billboard);p.e.setLocalScale(p.size,p.size,p.size);opacity(p,.8*Math.min(1,p.life/.16));
  }
  for(const p of sheets){if(p.life<=0)continue;p.life-=dt;if(p.life<=0){p.e.enabled=false;continue;}
   const age=1-p.life/p.maxLife,reach=.16+age*(.9+p.strength*1.8),height=Math.sin(age*Math.PI)*(.45+p.strength*1.65);
   for(let i=0;i<=segments;i++){
    const t=i/segments,a=p.angle+(t-.5)*2.2,crest=height*Math.pow(Math.sin(t*Math.PI),.65)*(1+.13*Math.sin(t*29));
    const j=i*6;p.positions[j]=Math.sin(a)*reach*.32;p.positions[j+1]=.008;p.positions[j+2]=Math.cos(a)*reach*.32;
    p.positions[j+3]=Math.sin(a)*reach;p.positions[j+4]=crest+.012;p.positions[j+5]=Math.cos(a)*reach;
   }
   p.mesh.setPositions(p.positions);p.mesh.update(pc.PRIMITIVE_TRIANGLES);opacity(p,.62*(1-age)*Math.min(1,age*12));
  }
  for(const p of foam){if(p.life<=0)continue;p.life-=dt;if(p.life<=0){p.e.enabled=false;continue;}
   const age=1-p.life/p.maxLife,r=.12+age*(.7+p.strength*.85);p.e.setLocalScale(r,1,r);opacity(p,.35*(1-age)*Math.min(1,age*12));
  }
 }
 return {update,reset,drops,sheets,foam};
}
