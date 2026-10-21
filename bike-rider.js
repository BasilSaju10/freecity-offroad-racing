import {bikeSteeringLimit} from './bike-physics.js';
export function createBikeRider(pc,model,parent,profile,scale,map){
 const cameraArms=model.findByName('Rider camera arms'),cameraMeshes=new Set((cameraArms?.findComponents('render')||[]).flatMap(r=>r.meshInstances));
 const riderMeshes=model.findComponents('render').flatMap(r=>r.meshInstances);
 for(const component of model.findComponents('render'))for(const mi of component.meshInstances){mi.cull=false;mi.material.cull=pc.CULLFACE_NONE;mi.material.update();}
 const root=new pc.Entity('Supplied motorcycle rider');parent.addChild(root);root.addChild(model);const riderScale=scale*1.02;model.setLocalScale(riderScale,riderScale,riderScale);
 const names=['Hips','Spine','Spine1','Spine2','Neck','Head','LeftArm','LeftForeArm','LeftHand','RightArm','RightForeArm','RightHand','LeftUpLeg','LeftLeg','LeftFoot','RightUpLeg','RightLeg','RightFoot'];
 const bones=Object.fromEntries(names.map(n=>[n,model.findByName('mixamorig:'+n)]));
 const rests=new Map();for(const node of model.find(n=>true))rests.set(node,{p:node.getLocalPosition().clone(),q:node.getLocalRotation().clone(),s:node.getLocalScale().clone()});
 const hip=bones.Hips;let phase=0,support=1,cornerLeg=0,cornerLegVelocity=0;
 const footRest=Object.fromEntries(['Left','Right'].map(side=>[side,bones[side+'Foot'].getRotation().clone()]));
 const handRest=Object.fromEntries(['Left','Right'].map(side=>[side,bones[side+'Hand'].getRotation().clone()]));
 const fingers=Object.fromEntries(['Left','Right'].map(side=>[side,Object.fromEntries(['Thumb','Index','Middle','Ring','Pinky'].map(name=>[name,[1,2,3].map(i=>model.findByName('mixamorig:'+side+'Hand'+name+i))]))]));
 const v=(...a)=>new pc.Vec3(...a),q=new pc.Quat(),inv=new pc.Mat4(),rotation=new pc.Quat(),direction=new pc.Vec3(),old=new pc.Vec3();
 function world(point){return parent.getWorldTransform().transformPoint(v(...point).mulScalar(scale));}
 function align(node,child,target){
  const start=node.getPosition().clone();old.sub2(child.getPosition(),start).normalize();direction.sub2(target,start).normalize();
  const dot=Math.max(-1,Math.min(1,old.dot(direction))),axis=new pc.Vec3().cross(old,direction);
  if(axis.lengthSq()<1e-10)return;
  q.setFromAxisAngle(axis.normalize(),Math.acos(dot)*180/Math.PI);rotation.mul2(q,node.getRotation());node.setRotation(rotation);
 }
 function limb(a,b,c,target,pole){
  if(!a||!b||!c)return;const A=a.getPosition().clone(),B=b.getPosition().clone(),D=c.getPosition().clone();const l1=A.distance(B),l2=B.distance(D),delta=target.clone().sub(A),d=Math.min(l1+l2-.002,Math.max(.02,delta.length()));delta.normalize();
  const bend=pole.clone().sub(A);bend.addScaled(delta,-bend.dot(delta));if(bend.lengthSq()<.0001)bend.set(0,0,1);bend.normalize();
  const along=(l1*l1-l2*l2+d*d)/(2*d),height=Math.sqrt(Math.max(0,l1*l1-along*along)),elbow=A.clone().addScaled(delta,along).addScaled(bend,height);
  align(a,b,elbow);align(b,c,target);
 }
 function update({speed,steer,reverse,dt,view,grounded=true}){
  for(const [node,rest] of rests){node.setLocalPosition(rest.p);node.setLocalRotation(rest.q);node.setLocalScale(rest.s);}
  root.setLocalScale(1,1,1);root.setLocalPosition(0,0,0);
  const inverseParent=new pc.Mat4().copy(parent.getWorldTransform()).invert();const hipLocal=inverseParent.transformPoint(hip.getPosition());root.setLocalPosition(profile.seat[0]*scale-hipLocal.x,profile.seat[1]*scale-hipLocal.y,profile.seat[2]*scale-hipLocal.z);
  if(bones.Spine&&bones.Neck){const lean=parent.getWorldTransform().transformVector(v(0,-.025,-.13)).mulScalar(scale);align(bones.Spine,bones.Neck,bones.Neck.getPosition().clone().add(lean));}
  const stopped=Math.abs(speed)<.65;support+=(Number(stopped||reverse)-support)*(1-Math.exp(-dt*9));phase+=dt*(reverse?Math.max(1.5,Math.abs(speed)*4.5):0);
  const turnDemand=Math.abs(steer)/Math.max(.005,bikeSteeringLimit(speed,profile.wheelbase*scale));
  const extension=!reverse&&grounded?Math.min(1,Math.max(0,(turnDemand-.15)/.75))*Math.min(1,Math.max(0,(speed-.8)/1.8)):0;
  const legTarget=-Math.sign(steer)*extension,legDelta=cornerLeg-legTarget,legDecay=Math.exp(-dt*12),legStep=(cornerLegVelocity+12*legDelta)*dt;
  cornerLeg=legTarget+(legDelta+legStep)*legDecay;cornerLegVelocity=(cornerLegVelocity-12*legStep)*legDecay;
  for(const side of ['Left','Right']){
   const sign=side==='Left'?-1:1,index=side==='Left'?0:1;
   const grip=profile.grips[index],bar=profile.barOrigin,angle=steer,c=Math.cos(angle),s=Math.sin(angle),x=grip[0]-bar[0],z=grip[2]-bar[2];
   // Place the palm over the grip; the wrist sits behind it, with fingers wrapped underneath.
   const target=world([bar[0]+x*c+(z+.055)*s,grip[1]+.02,bar[2]-x*s+(z+.055)*c]);
   limb(bones[side+'Arm'],bones[side+'ForeArm'],bones[side+'Hand'],target,world([sign*.48,profile.seat[1]+.24,profile.seat[2]-.10]));
   const hand=bones[side+'Hand'],digits=fingers[side],forward=parent.getWorldTransform().transformVector(v(-s,0,-c)).normalize(),across=parent.getWorldTransform().transformVector(v(c,0,-s)).normalize();
   rotation.mul2(parent.getRotation(),handRest[side]);hand.setRotation(rotation);align(hand,digits.Middle[0],hand.getPosition().clone().add(forward));
   const lateral=digits.Pinky[0].getPosition().clone().sub(digits.Index[0].getPosition());lateral.addScaled(forward,-lateral.dot(forward)).normalize();const desired=across.clone().mulScalar(sign);
   q.setFromAxisAngle(forward,Math.atan2(new pc.Vec3().cross(lateral,desired).dot(forward),lateral.dot(desired))*180/Math.PI);rotation.mul2(q,hand.getRotation());hand.setRotation(rotation);
   for(const name of ['Index','Middle','Ring','Pinky'])for(let i=0;i<3;i++){const joint=digits[name][i];if(joint){q.setFromAxisAngle(across,[-28,-60,-50][i]);rotation.mul2(q,joint.getRotation());joint.setRotation(rotation);}}
   // Both boots paddle backward in alternating strokes; left boot supports a stationary bike.
   const peg=world(profile.pegs[index]),amount=reverse?support:side==='Left'?support:0;
   const ground=world([sign*.30,-.4,profile.seat[2]+(reverse?Math.sin(phase+(index?Math.PI:0))*.23:.12)]);
   ground.y=map.heightAt(ground.x,ground.z)+.085+(reverse?Math.max(0,Math.cos(phase+(index?Math.PI:0)))*.07:0);
   const ankle=peg.clone().lerp(peg,ground,amount);
   const cornerAmount=Math.max(0,sign*cornerLeg)*(1-support);
   if(cornerAmount>.001){const extended=world([sign*.48,profile.seat[1]-.45,profile.seat[2]-.68]);extended.y=Math.max(extended.y,map.heightAt(extended.x,extended.z)+.18);ankle.lerp(ankle,extended,cornerAmount);}
   limb(bones[side+'UpLeg'],bones[side+'Leg'],bones[side+'Foot'],ankle,world([sign*.31,profile.seat[1]-.24,profile.seat[2]-.48]));
   const foot=bones[side+'Foot'],toe=model.findByName('mixamorig:'+side+'ToeBase');
   if(foot){rotation.mul2(parent.getRotation(),footRest[side]);foot.setRotation(rotation);if(toe){const forward=parent.getWorldTransform().transformVector(v(0,-.075+.06*cornerAmount,-.2));align(foot,toe,foot.getPosition().clone().add(forward));}}
  }
  // Use the same skinned arms in the eye camera, with the torso and helmet hidden.
  for(const mi of riderMeshes)mi.visible=cameraMeshes.has(mi)?view===2:view!==2;
 }
 return{root,update,destroy(){root.destroy();},bones};
}
