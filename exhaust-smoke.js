import {createExhaustState} from './exhaust-state.js';

export function createExhaustSmoke(pc,app,map,camera,outlets){
 const root=new pc.Entity('Dynamic exhaust smoke');app.root.addChild(root);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=96;const ctx=canvas.getContext('2d');
 for(const [x,y,r,a] of [[48,48,44,.7],[31,39,27,.4],[59,30,25,.35],[64,58,27,.4],[36,64,23,.35]]){
  const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(255,255,255,${a})`);g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(0,0,96,96);
 }
 const texture=new pc.Texture(app.graphicsDevice,{mipmaps:false});texture.setSource(canvas);
 const material=new pc.StandardMaterial();material.name='Engine exhaust haze';material.useLighting=false;material.diffuse=new pc.Color(0,0,0);material.emissive=new pc.Color(1,1,1);material.emissiveMap=texture;material.opacityMap=texture;material.opacityMapChannel='a';material.opacity=1;material.blendType=pc.BLEND_NORMAL;material.depthWrite=false;material.cull=pc.CULLFACE_NONE;material.update();
 const particles=Array.from({length:256},()=>{
  const e=new pc.Entity('Exhaust smoke puff');e.addComponent('render',{type:'plane',castShadows:false,receiveShadows:false});e.render.material=material;e.enabled=false;root.addChild(e);
  return {e,p:new pc.Vec3(),v:new pc.Vec3(),color:new Float32Array(3),life:0};
 });
 const state=createExhaustState(),local=new pc.Vec3(),origin=new pc.Vec3(),direction=new pc.Vec3(),ahead=new pc.Vec3(),behind=new pc.Vec3();
 const tilt=new pc.Quat().setFromEulerAngles(90,0,0),billboard=new pc.Quat();
 let key=null,credits=[],index=0,time=0;
 function reset(){key=null;credits=[];state.reset();for(const p of particles){p.life=0;p.e.enabled=false;}}
 function update(id,frame,chassis,scale,throttle,signedSpeed,dt){
  const ports=outlets[id];if(!ports?.length)return;
  if(key!==id){key=id;credits=ports.map(()=>0);state.reset();}
  const transform=frame.getWorldTransform(),q=chassis.quaternion;
  const fx=-2*(q.x*q.z+q.y*q.w),fz=-(1-2*(q.x*q.x+q.y*q.y)),fy=2*(q.x*q.w-q.y*q.z);
  const horizontal=Math.max(.01,Math.hypot(fx,fz));
  ahead.set(chassis.position.x+fx/horizontal*3,0,chassis.position.z+fz/horizontal*3);behind.set(chassis.position.x-fx/horizontal*3,0,chassis.position.z-fz/horizontal*3);
  const roadGrade=(map.heightAt(ahead.x,ahead.z)-map.heightAt(behind.x,behind.z))/6;
  const response=state.update({throttle,signedSpeed,roadGrade,bodyGrade:fy},dt);time+=dt;
  for(let i=0;i<ports.length;i++){
   const port=ports[i];local.set(...port.position).mulScalar(scale);transform.transformPoint(local,origin);
   local.set(...port.direction);transform.transformVector(local,direction).normalize();
   // A submerged exhaust does not emit an airborne plume through the water.
   const underwater=map.meta.pools.some(w=>((origin.x-w.x)/w.rx)**2+((origin.z-w.z)/w.rz)**2<1&&origin.y<w.y);
   if(underwater){credits[i]=0;continue;}
   credits[i]+=dt*response.rate;
   while(credits[i]>=1){
    credits[i]--;const p=particles[index++%particles.length],jitter=.018;
    p.p.copy(origin);p.p.x+=(Math.random()-.5)*jitter;p.p.y+=(Math.random()-.5)*jitter;p.p.z+=(Math.random()-.5)*jitter;
    p.v.copy(direction).mulScalar(response.jet);p.v.x+=chassis.velocity.x*.7;p.v.y+=chassis.velocity.y*.7;p.v.z+=chassis.velocity.z*.7;
    p.v.x+=(Math.random()-.5)*.15;p.v.z+=(Math.random()-.5)*.15;
    p.life=p.maxLife=response.life*(.85+Math.random()*.3);p.size=response.size*(.8+Math.random()*.5);p.density=response.opacity;p.seed=Math.random()*6.28;
    p.color.fill(response.shade);p.e.render.meshInstances[0].setParameter('material_emissive',p.color);p.e.enabled=true;
   }
  }
  billboard.mul2(camera.getRotation(),tilt);
  for(const p of particles){if(p.life<=0)continue;p.life-=dt;if(p.life<=0){p.e.enabled=false;continue;}
   const age=1-p.life/p.maxLife,drag=Math.exp(-dt*1.7);p.v.mulScalar(drag);
   p.v.y+=dt*.55;p.v.x+=dt*(.12+Math.sin(time*1.3+p.seed)*.18);p.v.z+=dt*Math.cos(time*.9+p.seed)*.12;p.p.addScaled(p.v,dt);
   const floor=map.heightAt(p.p.x,p.p.z)+.025;if(p.p.y<floor){p.p.y=floor;p.v.y=Math.max(.18,-p.v.y*.25);}
   p.e.setPosition(p.p);p.e.setRotation(billboard);const size=p.size+age*(.42+p.density*.65);p.e.setLocalScale(size,1,size*(1+age*.25));
   p.e.render.meshInstances[0].setParameter('material_opacity',p.density*Math.min(1,age*18)*Math.pow(1-age,1.5));
  }
  return response;
 }
 return {update,reset,particles};
}
