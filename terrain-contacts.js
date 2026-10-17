// Cull individual terrain cells using the hull's true bounds before Cannon's SAT.
// Cannon's default uses a large sphere and deep triangle pillars, even above flat ground.
export function optimizeTerrainContacts(C,world){
 const narrow=world.narrowphase;
 narrow.convexHeightfield=function(shape,hf,position,hfPosition,rotation,hfRotation,body,hfBody,rsi,rsj,justTest){
  const local=new C.Vec3(),point=new C.Vec3(),min=new C.Vec3(Infinity,Infinity,Infinity),max=new C.Vec3(-Infinity,-Infinity,-Infinity);
  for(const v of shape.vertices){C.Transform.pointToWorldFrame(position,rotation,v,point);C.Transform.pointToLocalFrame(hfPosition,hfRotation,point,local);for(const axis of ['x','y','z']){min[axis]=Math.min(min[axis],local[axis]);max[axis]=Math.max(max[axis],local[axis]);}}
  const step=hf.elementSize,data=hf.data;
  const x0=Math.max(0,Math.floor(min.x/step)-1),x1=Math.min(data.length-2,Math.ceil(max.x/step));
  const y0=Math.max(0,Math.floor(min.y/step)-1),y1=Math.min(data[0].length-2,Math.ceil(max.y/step));
  for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){
   if(Math.max(data[x][y],data[x+1][y],data[x][y+1],data[x+1][y+1])<min.z-.01)continue;
   for(const upper of [false,true]){hf.getConvexTrianglePillar(x,y,upper);C.Transform.pointToWorldFrame(hfPosition,hfRotation,hf.pillarOffset,point);if(this.convexConvex(shape,hf.pillarConvex,position,point,rotation,hfRotation,body,hfBody,rsi||shape,rsj||hf,justTest,[0],null)&&justTest)return true;}
  }
 };
}
