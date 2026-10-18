import {buildOffroadHelmet} from './driver-helmet.js';
// A seated, articulated driver built from local meshes; no remote assets required.
export function createHelmetDriver(pc,app,parent){
 const root=new pc.Entity('Helmeted driver');parent.addChild(root);
 const mat=(name,color,rough=.8,metal=0)=>{const m=new pc.StandardMaterial();m.name=name;m.diffuse=new pc.Color(...color);m.useMetalness=true;m.metalness=metal;m.gloss=1-rough;m.update();return m;};
 const suit=mat('Unbranded graphite race suit',[.035,.047,.055]),seam=mat('Suit reinforcement',[.075,.09,.10]),accent=mat('Safety orange',[.85,.20,.035],.35),glove=mat('Driving gloves',[.018,.022,.025]),skin=mat('Driver skin',[.40,.24,.15],.7),black=mat('Helmet trim',[.012,.018,.022],.35),white=mat('Eye whites',[.7,.72,.67]),iris=mat('Eyes',[.025,.045,.035]);
 const helmetMat=mat('Plain safety helmet',[.88,.28,.035],.26,.15);
 const part=(name,type,material,pos,scale,owner=root)=>{const e=new pc.Entity(name);e.addComponent('render',{type});e.render.material=material;e.setLocalPosition(...pos);e.setLocalScale(...scale);owner.addChild(e);return e;};
 const head=new pc.Entity('Driver head and helmet');root.addChild(head);
 part('Face','sphere',skin,[0,-.015,.005],[.205,.255,.205],head);
 part('Nose','sphere',skin,[0,-.005,-.099],[.035,.050,.030],head);
 for(const x of [-.038,.038]){part('Eye','sphere',white,[x,.024,-.084],[.032,.015,.013],head);part('Iris','sphere',iris,[x,.024,-.091],[.013,.013,.007],head);part('Brow','box',black,[x,.042,-.084],[.037,.008,.012],head);}
 part('Neck','capsule',skin,[0,-.19,.015],[.09,.15,.09]);
 buildOffroadHelmet(pc,app,head,helmetMat,black,part);
 part('Torso','sphere',suit,[0,-.43,.07],[.37,.48,.24]);
 part('Seat belt','box',black,[-.08,-.43,-.055],[.055,.43,.018]).setLocalEulerAngles(0,0,-24);
 part('Suit chest panel','sphere',seam,[0,-.38,-.048],[.29,.21,.045]);
 part('Hips','sphere',suit,[0,-.67,.12],[.34,.21,.27]);
 const up=new pc.Vec3(0,1,0),direction=new pc.Vec3(),rotation=new pc.Quat();
 function link(e,a,b,width){direction.sub2(b,a);e.setLocalPosition((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);rotation.setFromDirections(up,direction.clone().normalize());e.setLocalRotation(rotation);e.setLocalScale(width,direction.length()*.5,width);}
 for(const side of [-1,1]){
  const hip=new pc.Vec3(side*.105,-.68,.10),knee=new pc.Vec3(side*.12,-.73,-.28),ankle=new pc.Vec3(side*.12,-.78,-.47);
  link(part('Thigh','capsule',suit,[0,0,0],[1,1,1]),hip,knee,.14);link(part('Lower leg','capsule',suit,[0,0,0],[1,1,1]),knee,ankle,.115);
  part('Boot','box',glove,[ankle.x,-.82,-.54],[.12,.105,.23]);
 }
 function makeHand(side){
  const hand=new pc.Entity('Gloved hand');root.addChild(hand);
  // Local X points outwards along the rim; Y follows it, Z faces the driver.
  // The palm rests behind the rim and the fingers curl around its front.
  part('Glove palm','sphere',glove,[.009,0,.027],[.070,.085,.033],hand);
  part('Knuckle padding','sphere',seam,[.012,0,.043],[.065,.073,.014],hand);
  for(let finger=0;finger<4;finger++){
   const y=(finger-1.5)*.018,points=[new pc.Vec3(.032,y,.018),new pc.Vec3(.037,y,-.008),new pc.Vec3(.016,y,-.025),new pc.Vec3(-.012,y,-.019)];
   for(let i=0;i<3;i++)link(part('Finger '+finger+' segment '+i,'capsule',glove,[0,0,0],[1,1,1],hand),points[i],points[i+1],.013);
  }
  const thumb=[new pc.Vec3(-.014,side*.038,.028),new pc.Vec3(-.030,side*.025,.008),new pc.Vec3(-.022,side*.006,-.009)];
  for(let i=0;i<2;i++)link(part('Thumb segment '+i,'capsule',glove,[0,0,0],[1,1,1],hand),thumb[i],thumb[i+1],.020);
  return hand;
 }
 const arms=[-1,1].map(side=>({side,upper:part('Upper arm','capsule',suit,[0,0,0],[1,1,1]),lower:part('Forearm','capsule',seam,[0,0,0],[1,1,1]),hand:makeHand(side),cuff:part('Wrist cuff','sphere',accent,[0,0,0],[.072,.045,.060])}));
 let fit=null,importedHands=null,fitScale=1;const seatOrigin=new pc.Vec3(),handBasis=new pc.Quat(),wheelRotation=new pc.Quat(),radialRotation=new pc.Quat(),handRotation=new pc.Quat(),wrist=new pc.Vec3();const steeringRotation=new pc.Quat(),axis=new pc.Vec3(),grip=new pc.Vec3(),shoulder=new pc.Vec3(),elbow=new pc.Vec3(),hand=new pc.Vec3();
 return{root,head,seatOrigin,
  attachHands(model){importedHands=model;model.name='Supplied hands on steering wheel';const handSkin=mat('Supplied hands skin tone',[.68,.40,.25],.75);for(const render of model.findComponents?.('render')||[])for(const mi of render.meshInstances)mi.material=handSkin;parent.addChild(model);for(const arm of arms){arm.hand.enabled=false;arm.cuff.enabled=false;}},
  fit(profile,scale){fit=profile;fitScale=scale;seatOrigin.set(profile.steeringPosition[0],Math.min(profile.cockpitEye[1]-.10,(profile.hullTop||1.3)-.22),Math.max(profile.cockpitEye[2]-.05,profile.steeringPosition[2]+.20));root.setLocalScale(scale,scale,scale);root.setLocalPosition(seatOrigin.x*scale,seatOrigin.y*scale,seatOrigin.z*scale);},
  update(steering,view){if(!fit)return;head.enabled=view!==2;axis.set(...(fit.steeringAxis||[0,.445,.895])).normalize();steeringRotation.setFromAxisAngle(axis,steering*14*180/Math.PI);
   handBasis.setFromDirections(new pc.Vec3(0,0,1),axis);wheelRotation.mul2(steeringRotation,handBasis);
   const radius=(fit.steeringGripRadius||.165)+.012;
   if(importedHands){importedHands.setLocalPosition(...fit.steeringPosition.map(v=>v*fitScale));importedHands.setLocalRotation(wheelRotation);const scale=radius/.20*fitScale;importedHands.setLocalScale(scale,scale,scale);}
   for(const arm of arms){
    grip.set(arm.side*radius*.8660254,radius*.5,0);wheelRotation.transformVector(grip,grip);hand.set(...fit.steeringPosition).add(grip).sub(seatOrigin);
    radialRotation.setFromAxisAngle(new pc.Vec3(0,0,1),arm.side<0?150:30);handRotation.mul2(wheelRotation,radialRotation);
    if(importedHands){handRotation.transformVector(new pc.Vec3(.012,-arm.side*.060,.113).mulScalar(radius/.20),wrist);wrist.add(hand);}else{handRotation.transformVector(new pc.Vec3(.025,-arm.side*.055,.075),wrist);wrist.add(hand);}shoulder.set(arm.side*.18,-.20,.055);elbow.lerp(shoulder,wrist,.52);elbow.x+=arm.side*.055;elbow.y-=.105;
    link(arm.upper,shoulder,elbow,.105);link(arm.lower,elbow,wrist,.08);arm.hand.setLocalPosition(hand);arm.hand.setLocalRotation(handRotation);arm.cuff.setLocalPosition(wrist);arm.cuff.setLocalRotation(handRotation);
   }
  }
 };
}
