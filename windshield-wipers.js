import {wiperProfiles} from './wiper-profiles.js';
export function createWindshieldWipers(pc,parent){
 const rubber=new pc.StandardMaterial();rubber.name='Wiper rubber';rubber.diffuse=new pc.Color(.015,.018,.020);rubber.gloss=.25;rubber.update();
 const metal=rubber.clone();metal.name='Wiper arm';metal.diffuse=new pc.Color(.075,.085,.09);metal.useMetalness=true;metal.metalness=.65;metal.update();
 const root=new pc.Entity('Automatic windshield wipers');parent.addChild(root);
 const rods=[0,1].map(()=>[metal,rubber].map((m,i)=>{const e=new pc.Entity(i?'Wiper blade':'Wiper arm');e.addComponent('render',{type:'box',castShadows:false});e.render.material=m;root.addChild(e);return e;}));
 const up=new pc.Vec3(0,1,0),direction=new pc.Vec3(),q=new pc.Quat(),a=new pc.Vec3(),b=new pc.Vec3();let phase=0;
 function rod(e,a,b,width,depth){direction.sub2(b,a);e.setLocalPosition((a.x+b.x)*.5,(a.y+b.y)*.5,(a.z+b.z)*.5);q.setFromDirections(up,direction.clone().normalize());e.setLocalRotation(q);e.setLocalScale(width,direction.length(),depth);}
 return{update(id,rain,dt,scale=1.12){const p=wiperProfiles[id];root.enabled=!!p;if(!p)return;
  if(rain>.08)phase=(phase+dt*(rain>.85?6.5:3.7))%(Math.PI*2);else if(phase>0){phase+=dt*4;if(phase>=Math.PI*2)phase=0;}
  const angle=.035+(1-Math.cos(phase))*.5*1.28,uy=1/Math.sqrt(1+p.slope*p.slope),uz=p.slope*uy;
  for(let i=0;i<2;i++){
   const x=i===0?-.58:.025,dx=Math.cos(angle),dy=Math.sin(angle)*uy,dz=Math.sin(angle)*uz;
   a.set(x*scale,p.y*scale,p.z*scale);b.set((x+dx*p.length*.70)*scale,(p.y+dy*p.length*.70)*scale,(p.z+dz*p.length*.70-.012)*scale);rod(rods[i][0],a,b,.013*scale,.012*scale);
   a.set((x+dx*p.length*.20)*scale,(p.y+dy*p.length*.20)*scale,(p.z+dz*p.length*.20-.025)*scale);b.set((x+dx*p.length)*scale,(p.y+dy*p.length)*scale,(p.z+dz*p.length-.025)*scale);rod(rods[i][1],a,b,.023*scale,.018*scale);
  }
  root.name=rain>.08?'Automatic windshield wipers · wiping':'Automatic windshield wipers · parked';
 }};
}
