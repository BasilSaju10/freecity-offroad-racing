// Static map cells avoid testing every fence against every other fence each step.
export function createMapBroadphase(C,world){
 class MapBroadphase extends C.Broadphase{
  constructor(){super();this.useBoundingBoxes=true;this.cells=new Map();this.global=[];this.moving=[];this.rebuild=true;world.addEventListener('addBody',()=>this.rebuild=true);world.addEventListener('removeBody',()=>this.rebuild=true);}
  bounds(a){return [Math.floor(a.lowerBound.x/16),Math.floor(a.upperBound.x/16),Math.floor(a.lowerBound.z/16),Math.floor(a.upperBound.z/16)];}
  prepare(){if(!this.rebuild)return;this.cells.clear();this.global=[];this.moving=[];for(const b of world.bodies){if(b.type!==C.Body.STATIC){this.moving.push(b);continue;}b.updateAABB();const [x0,x1,z0,z1]=this.bounds(b.aabb);if((x1-x0+1)*(z1-z0+1)>256){this.global.push(b);continue;}for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){const key=x+','+z;if(!this.cells.has(key))this.cells.set(key,[]);this.cells.get(key).push(b);}}this.rebuild=false;}
  aabbQuery(unused,aabb,result=[]){this.prepare();const candidates=new Set([...this.global,...this.moving]);const [x0,x1,z0,z1]=this.bounds(aabb);for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++)for(const b of this.cells.get(x+','+z)||[])candidates.add(b);for(const b of candidates){if(b.aabbNeedsUpdate)b.updateAABB();if(b.aabb.overlaps(aabb))result.push(b);}return result;}
  collisionPairs(unused,p1,p2){this.prepare();for(const b of this.moving){if(b.aabbNeedsUpdate)b.updateAABB();for(const other of this.aabbQuery(world,b.aabb)){if(other===b||(other.type!==C.Body.STATIC&&other.id<b.id))continue;if(this.needBroadphaseCollision(b,other))this.intersectionTest(b,other,p1,p2);}}}
 }
 return new MapBroadphase();
}
