export function createRemoteDrivers(pc,app,camera,profiles,createDriver,vehicleAssets){
 const root=new pc.Entity('Other drivers');app.root.addChild(root);const cars=new Map();let wanted=new Set();
 const labels=document.createElement('div');labels.id='remote-driver-labels';document.body.append(labels);
 const bodyMat=new pc.StandardMaterial();bodyMat.diffuse=new pc.Color(.28,.48,.42);bodyMat.update();const tyreMat=new pc.StandardMaterial();tyreMat.diffuse=new pc.Color(.06,.06,.06);tyreMat.update();
 function release(car){
  car.revision=(car.revision||0)+1;car.pending?.lease.release();car.pending=null;
  car.model?.destroy();car.driver?.root.destroy();for(const w of [...car.wheels||[],...car.brakes||[]])w?.destroy();
  car.lease?.release();car.lease=null;car.model=null;car.wheels=null;car.brakes=null;car.driver=null;car.wheel=null;car.proxy.enabled=true;
 }
 async function upgrade(car){
  if(car.pending||car.model||Date.now()<(car.retryAt||0)||!profiles[car.vehicle])return;
  const id=car.vehicle,revision=car.revision||0,lease=vehicleAssets.acquire(profiles[id].url),job={lease};car.pending=job;
  const current=()=>cars.get(car.id)===car&&car.pending===job&&(car.revision||0)===revision&&car.vehicle===id&&wanted.has(car.id);
  try{
   const asset=await lease.promise;if(!current())return;
   const model=asset.resource.instantiateRenderEntity(),profile=profiles[id];model.setLocalScale(1.12,1.12,1.12);car.entity.addChild(model);car.model=model;car.lease=lease;
   for(const a of asset.resource.materials){const m=a.resource;m.useDynamicRefraction=false;m.refraction=0;m.cull=pc.CULLFACE_NONE;if(/glass|vitre/i.test(m.name)){m.blendType=pc.BLEND_NORMAL;m.opacity=.18;m.depthWrite=false;}m.update();}
   car.wheels=['Wheel_FL','Wheel_FR','Wheel_RL','Wheel_RR'].map(name=>model.findByName(name));for(const w of car.wheels)if(w){w.reparent(car.entity);w.setLocalScale(1.12,1.12,1.12);}
   car.brakes=['Brake_FL','Brake_FR','Brake_RL','Brake_RR'].map(name=>model.findByName(name));for(const w of car.brakes)if(w){w.reparent(car.entity);w.setLocalScale(1.12,1.12,1.12);}
   car.wheel=model.findByName('Steering');if(car.wheel){car.wheel.setLocalPosition(...profile.steeringPosition);car.rest=car.wheel.getLocalRotation().clone();}
   car.driver=createDriver(pc,app,car.entity);car.driver.fit(profile,1.12);car.proxy.enabled=false;
  }catch(e){if(current()){release(car);car.retryAt=Date.now()+5000;console.warn('Vehicle preview unavailable:',id,e);}}
  finally{if(car.pending===job)car.pending=null;if(car.lease!==lease)lease.release();}
 }
 function receive(peers){const ids=new Set(peers.map(p=>p.id));for(const [id,car] of cars)if(!ids.has(id)){release(car);car.entity.destroy();car.label.remove();cars.delete(id);}
  for(const p of peers){let car=cars.get(p.id);if(!car){const entity=new pc.Entity('Driver '+p.id),proxy=new pc.Entity('Distant vehicle');root.addChild(entity);proxy.addComponent('render',{type:'box',castShadows:false});proxy.render.material=bodyMat;proxy.setLocalScale(2,1.2,4.5);proxy.setLocalPosition(0,.3,0);const fallback=new pc.Entity('Loading vehicle');entity.addChild(fallback);fallback.addChild(proxy);const cabin=new pc.Entity('Cabin');cabin.addComponent('render',{type:'box',castShadows:false});cabin.render.material=bodyMat;cabin.setLocalScale(1.7,.8,2.3);cabin.setLocalPosition(0,1.2,0);fallback.addChild(cabin);for(let i=0;i<4;i++){const tyre=new pc.Entity('Tyre');tyre.addComponent('render',{type:'cylinder',castShadows:false});tyre.render.material=tyreMat;tyre.setLocalScale(.85,.3,.85);tyre.setLocalEulerAngles(0,0,90);tyre.setLocalPosition(i%2?1:-1,-.2,i<2?-1.4:1.4);fallback.addChild(tyre);}const label=document.createElement('span');label.className='remote-label';labels.append(label);car={id:p.id,entity,proxy:fallback,label,vehicle:p.vehicle,initial:true,position:new pc.Vec3(),rotation:new pc.Quat()};cars.set(p.id,car);}
   if(car.vehicle!==p.vehicle){release(car);car.vehicle=p.vehicle;car.proxy.enabled=true;}car.target=p.state||car.target;car.label.textContent=p.name;car.entity.enabled=!!car.target&&p.connected;car.label.hidden=!car.entity.enabled;
  }
 }
 const wheelQ=new pc.Quat(),spinQ=new pc.Quat(),screen=new pc.Vec3(),point=new pc.Vec3(),delta=new pc.Vec3();
 function update(dt,position){
  wanted=new Set([...cars.values()].filter(c=>c.target&&Math.hypot(c.target.p[0]-position.x,c.target.p[2]-position.z)<160).sort((a,b)=>Math.hypot(a.target.p[0]-position.x,a.target.p[2]-position.z)-Math.hypot(b.target.p[0]-position.x,b.target.p[2]-position.z)).slice(0,4).map(c=>c.id));
  for(const car of cars.values()){
   if(!car.target)continue;if(wanted.has(car.id))upgrade(car);else if(car.model){release(car);car.proxy.enabled=true;}
   const s=car.target,target=new pc.Vec3(...s.p),q=new pc.Quat(...s.q),alpha=car.initial||car.position.distance(target)>12?1:1-Math.exp(-dt*14);car.position.lerp(car.position,target,alpha);car.rotation.slerp(car.rotation,q,alpha);car.initial=false;car.entity.setPosition(car.position);car.entity.setRotation(car.rotation);
   const profile=profiles[car.vehicle];if(car.wheels&&profile){for(let i=0;i<4;i++){const w=s.w[i],x=(i%2?1:-1)*profile.track*.56,z=(i<2?-1:1)*profile.wheelbase*.56;wheelQ.setFromAxisAngle(pc.Vec3.UP,w[2]*180/Math.PI);if(car.brakes[i]){car.brakes[i].setLocalPosition(x,.12*1.12-w[0],z);car.brakes[i].setLocalRotation(wheelQ);}spinQ.setFromAxisAngle(pc.Vec3.RIGHT,w[1]*180/Math.PI);wheelQ.mul(spinQ);if(car.wheels[i]){car.wheels[i].setLocalPosition(x,.12*1.12-w[0],z);car.wheels[i].setLocalRotation(wheelQ);}}
    if(car.wheel){wheelQ.setFromAxisAngle(new pc.Vec3(...profile.steeringAxis).normalize(),s.steer*14*180/Math.PI);wheelQ.mul(car.rest);car.wheel.setLocalRotation(wheelQ);}car.driver.update(s.steer,0);
   }
   point.copy(car.position);point.y+=2.2;delta.sub2(point,camera.getPosition());camera.camera.worldToScreen(point,screen);const visible=car.entity.enabled&&delta.dot(camera.forward)>0&&delta.length()<180;car.label.hidden=!visible;if(visible){car.label.style.transform=`translate(${screen.x}px,${screen.y}px) translate(-50%,-100%)`;}
  }
 }
 return{receive,update,clear(){receive([]);}};
}
