export function createRemoteDrivers(pc,app,camera,profiles,createDriver){
 const root=new pc.Entity('Other drivers');app.root.addChild(root);const cars=new Map(),assets=new Map();let wanted=new Set();
 const labels=document.createElement('div');labels.id='remote-driver-labels';document.body.append(labels);
 const bodyMat=new pc.StandardMaterial();bodyMat.diffuse=new pc.Color(.28,.48,.42);bodyMat.update();
 function release(car){car.model?.destroy();car.driver?.root.destroy();for(const w of car.wheels||[])w?.destroy();car.model=null;car.wheels=null;car.driver=null;if(car.assetId){const shared=assets.get(car.assetId);shared?.users.delete(car.id);car.assetId=null;}}
 function collect(){for(const [id,shared] of assets)if(!shared.users.size&&!shared.loading){app.assets.remove(shared.asset);shared.asset.unload();assets.delete(id);}}
 async function upgrade(car){
  if(car.loading||car.model||!profiles[car.vehicle])return;car.loading=true;const id=car.vehicle;let shared=assets.get(id);
  if(!shared){const asset=new pc.Asset('Peer '+id,'container',{url:profiles[id].url+'?peer=1'});shared={asset,users:new Set(),loading:true};assets.set(id,shared);app.assets.add(asset);shared.promise=new Promise((resolve,reject)=>{asset.ready(()=>{shared.loading=false;resolve(asset);});asset.once('error',e=>{shared.loading=false;reject(e);});app.assets.load(asset);});}
  shared.users.add(car.id);car.assetId=id;
  try{await shared.promise;if(!cars.has(car.id)||car.vehicle!==id||!wanted.has(car.id)){shared.users.delete(car.id);car.loading=false;collect();return;}
   const model=shared.asset.resource.instantiateRenderEntity(),profile=profiles[id];model.setLocalScale(1.12,1.12,1.12);car.entity.addChild(model);car.model=model;
   for(const a of shared.asset.resource.materials){const m=a.resource;m.useDynamicRefraction=false;m.refraction=0;m.cull=pc.CULLFACE_NONE;if(/glass|vitre/i.test(m.name)){m.blendType=pc.BLEND_NORMAL;m.opacity=.18;m.depthWrite=false;}m.update();}
   car.wheels=['Wheel_FL','Wheel_FR','Wheel_RL','Wheel_RR'].map(name=>model.findByName(name));for(const w of car.wheels)if(w){w.reparent(car.entity);w.setLocalScale(1.12,1.12,1.12);}
   car.brakes=['Brake_FL','Brake_FR','Brake_RL','Brake_RR'].map(name=>model.findByName(name));for(const w of car.brakes)if(w){w.reparent(car.entity);w.setLocalScale(1.12,1.12,1.12);}
   car.wheel=model.findByName('Steering');if(car.wheel){car.wheel.setLocalPosition(...profile.steeringPosition);car.rest=car.wheel.getLocalRotation().clone();}
   car.driver=createDriver(pc,app,car.entity);car.driver.fit(profile,1.12);car.proxy.enabled=false;
  }catch{shared.users.delete(car.id);car.assetId=null;}finally{car.loading=false;collect();}
 }
 function receive(peers){const ids=new Set(peers.map(p=>p.id));for(const [id,car] of cars)if(!ids.has(id)){release(car);car.entity.destroy();car.label.remove();cars.delete(id);}
  for(const p of peers){let car=cars.get(p.id);if(!car){const entity=new pc.Entity('Driver '+p.id),proxy=new pc.Entity('Distant vehicle');root.addChild(entity);proxy.addComponent('render',{type:'box',castShadows:false});proxy.render.material=bodyMat;proxy.setLocalScale(2,1.2,4.5);proxy.setLocalPosition(0,.3,0);entity.addChild(proxy);const label=document.createElement('span');label.className='remote-label';labels.append(label);car={id:p.id,entity,proxy,label,vehicle:p.vehicle,initial:true,position:new pc.Vec3(),rotation:new pc.Quat()};cars.set(p.id,car);}
   if(car.vehicle!==p.vehicle){release(car);for(const b of car.brakes||[])b?.destroy();car.vehicle=p.vehicle;car.proxy.enabled=true;}car.target=p.state;car.label.textContent=p.name;car.entity.enabled=!!p.state&&p.connected;car.label.hidden=!car.entity.enabled;
  }collect();
 }
 const wheelQ=new pc.Quat(),spinQ=new pc.Quat(),screen=new pc.Vec3(),point=new pc.Vec3(),delta=new pc.Vec3();
 function update(dt,position){
  wanted=new Set([...cars.values()].filter(c=>c.target&&Math.hypot(c.target.p[0]-position.x,c.target.p[2]-position.z)<160).sort((a,b)=>Math.hypot(a.target.p[0]-position.x,a.target.p[2]-position.z)-Math.hypot(b.target.p[0]-position.x,b.target.p[2]-position.z)).slice(0,4).map(c=>c.id));
  for(const car of cars.values()){
   if(!car.target)continue;if(wanted.has(car.id))upgrade(car);else if(car.model){release(car);for(const b of car.brakes||[])b?.destroy();car.proxy.enabled=true;}
   const s=car.target,target=new pc.Vec3(...s.p),q=new pc.Quat(...s.q),alpha=car.initial||car.position.distance(target)>12?1:1-Math.exp(-dt*14);car.position.lerp(car.position,target,alpha);car.rotation.slerp(car.rotation,q,alpha);car.initial=false;car.entity.setPosition(car.position);car.entity.setRotation(car.rotation);
   const profile=profiles[car.vehicle];if(car.wheels&&profile){for(let i=0;i<4;i++){const w=s.w[i],x=(i%2?1:-1)*profile.track*.56,z=(i<2?-1:1)*profile.wheelbase*.56;wheelQ.setFromAxisAngle(pc.Vec3.UP,w[2]*180/Math.PI);if(car.brakes[i]){car.brakes[i].setLocalPosition(x,.12*1.12-w[0],z);car.brakes[i].setLocalRotation(wheelQ);}spinQ.setFromAxisAngle(pc.Vec3.RIGHT,w[1]*180/Math.PI);wheelQ.mul(spinQ);if(car.wheels[i]){car.wheels[i].setLocalPosition(x,.12*1.12-w[0],z);car.wheels[i].setLocalRotation(wheelQ);}}
    if(car.wheel){wheelQ.setFromAxisAngle(new pc.Vec3(...profile.steeringAxis).normalize(),s.steer*14*180/Math.PI);wheelQ.mul(car.rest);car.wheel.setLocalRotation(wheelQ);}car.driver.update(s.steer,0);
   }
   point.copy(car.position);point.y+=2.2;delta.sub2(point,camera.getPosition());camera.camera.worldToScreen(point,screen);const visible=car.entity.enabled&&delta.dot(camera.forward)>0&&delta.length()<180;car.label.hidden=!visible;if(visible){car.label.style.transform=`translate(${screen.x}px,${screen.y}px) translate(-50%,-100%)`;}
  }collect();
 }
 return{receive,update,clear(){receive([]);}};
}
