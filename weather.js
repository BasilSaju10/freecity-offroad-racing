import {createWeatherState,weatherPresets} from './weather-state.js';

// One dynamic mesh for all rain streaks, with no per-drop entities or shadows.
export function createWeather(pc,app,camera,sun,map,onThunder){
 const state=createWeatherState();
 const reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const current=structuredClone(weatherPresets.day),count=950,positions=new Float32Array(count*12),indices=[];
 const drops=Array.from({length:count},()=>({x:Math.random()*54-27,y:Math.random()*24,z:Math.random()*54-27,speed:21+Math.random()*10}));
 for(let i=0;i<count;i++){const j=i*4;indices.push(j,j+1,j+2,j+2,j+1,j+3);}
 const normals=new Float32Array(count*12);for(let i=2;i<normals.length;i+=3)normals[i]=1;
 const mesh=new pc.Mesh(app.graphicsDevice);mesh.setPositions(positions);mesh.setNormals(normals);mesh.setIndices(indices);mesh.update(pc.PRIMITIVE_TRIANGLES);
 const material=new pc.StandardMaterial();material.name='Weather rainfall';material.useLighting=false;material.emissive=new pc.Color(.62,.70,.77);material.opacity=.48;material.blendType=pc.BLEND_NORMAL;material.depthWrite=false;material.cull=pc.CULLFACE_NONE;material.update();
 const rain=new pc.Entity('Weather rain streaks');rain.addComponent('render',{meshInstances:[new pc.MeshInstance(mesh,material)],castShadows:false,receiveShadows:false});app.root.addChild(rain);rain.enabled=false;
 const color=new pc.Color(),inverse=new pc.Mat4(),local=new pc.Vec3(),point=new pc.Vec3();
 let lightningWait=10+Math.random()*8,flashAge=10,lastMode='day';
 function blend(a,b,t){return a+(b-a)*t;}
 function update(dt,{view,body,profile,scale=1.12,paused=false}){
  const {mode,automatic,preset}=state.update(paused?0:dt),mix=1-Math.exp(-dt/2.6);
  for(const key of ['sky','ambient','sun'])for(let i=0;i<3;i++)current[key][i]=blend(current[key][i],preset[key][i],mix);
  for(const key of ['power','reflection','fogStart','fogEnd','rain'])current[key]=blend(current[key],preset[key],mix);
  if(mode!==lastMode){lightningWait=7+Math.random()*8;lastMode=mode;}
  let flash=0;
  if((mode==='rain'||mode==='storm')&&!paused){lightningWait-=dt;if(lightningWait<=0){flashAge=0;lightningWait=10+Math.random()*15;onThunder?.();}}
  flashAge+=dt;
  if(!reducedMotion)flash=Math.exp(-flashAge*14)*.48+Math.exp(-Math.pow((flashAge-.23)/.07,2))*.20;
  color.set(current.sky[0]+flash*.28,current.sky[1]+flash*.30,current.sky[2]+flash*.34);camera.camera.clearColor.copy(color);app.scene.fog.color.copy(color);
  app.scene.fog.start=current.fogStart;app.scene.fog.end=current.fogEnd;
  app.scene.ambientLight.set(...current.ambient);sun.light.color.set(...current.sun);sun.light.intensity=current.power+flash*2.2;app.scene.skyboxIntensity=current.reflection+flash*.35;
  // Weather is automatic; no player can override the cycle.
  rain.enabled=current.rain>.015;if(!rain.enabled)return;
  const center=camera.getPosition(),right=camera.right,visible=Math.round(count*current.rain),cabin=view===2&&body&&profile;
  if(cabin)inverse.copy(body.getWorldTransform()).invert();
  for(let i=0;i<count;i++){
   const d=drops[i];d.y-=d.speed*dt;d.x+=dt*2.8;d.z+=dt*.7;if(d.y<0){d.y+=24;d.x=Math.random()*54-27;d.z=Math.random()*54-27;}if(d.x>27)d.x-=54;if(d.z>27)d.z-=54;
   const x=center.x+d.x,y=center.y+d.y-8,z=center.z+d.z;
   let hidden=i>=visible||d.x*d.x+d.z*d.z<2.8||y<map.heightAt(x,z)+.08;
   if(cabin){point.set(x,y,z);inverse.transformPoint(point,local);hidden ||= Math.abs(local.x)<(profile.hullWidth||1)*scale+.15&&Math.abs(local.z)<(profile.hullLength||2.5)*scale&&local.y<(profile.hullTop||1.3)*scale+.25;}
   const width=hidden?0:.016,length=hidden?0:.5+current.rain*.28,j=i*12;
   positions[j]=x-right.x*width;positions[j+1]=y-right.y*width;positions[j+2]=z-right.z*width;
   positions[j+3]=x+right.x*width;positions[j+4]=y+right.y*width;positions[j+5]=z+right.z*width;
   positions[j+6]=positions[j]-.09;positions[j+7]=positions[j+1]+length;positions[j+8]=positions[j+2]-.025;
   positions[j+9]=positions[j+3]-.09;positions[j+10]=positions[j+4]+length;positions[j+11]=positions[j+5]-.025;
  }
  mesh.setPositions(positions);mesh.update(pc.PRIMITIVE_TRIANGLES);
 }
 return{update,get rain(){return current.rain;}};
}
