import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createVehicleAssets} from './vehicle-assets.js';
import {createRemoteDrivers} from './remote-drivers.js';
import {Vec3} from './vendor/playcanvas/core/math/vec3.js';
import {Quat} from './vendor/playcanvas/core/math/quat.js';

class Entity{
 constructor(name){this.name=name;this.children=[];this.enabled=true;}
 addChild(child){child.parent=this;this.children.push(child);}
 addComponent(){this.render={};}
 setLocalScale(){} setLocalPosition(){} setLocalEulerAngles(){} setPosition(){} setRotation(){}
 findByName(){return null;}
 destroy(){this.parent?.children.splice(this.parent.children.indexOf(this),1);this.parent=null;this.destroyed=true;for(const child of [...this.children])child.destroy();}
}
class Asset extends EventEmitter{
 constructor(name,type,file){super();Object.assign(this,{name,type,file});this.unloads=0;}
 unload(){this.unloads++;if(this.resource)this.resource.alive=false;}
}
class Material{constructor(){this.diffuse={};}update(){}}
function setup(){
 const pending=[],removed=[],app={root:new Entity('root'),assets:{add(){},load(asset){pending.push(asset);},remove(asset){removed.push(asset);}}};
 const pc={Asset,Entity,StandardMaterial:Material,Color:class{},Vec3,Quat};
 const pool=createVehicleAssets(pc,app);
 const finish=asset=>{asset.resource={alive:true,materials:[],instantiateRenderEntity(){assert(this.alive,'render resources are still resident');return new Entity('Vehicle model');}};asset.emit('load',asset);};
 return{app,pc,pool,pending,removed,finish};
}
const flush=async()=>{await Promise.resolve();await Promise.resolve();};

// Reproduce the race: both cars use the host vehicle, then remotes are cleared.
{
 const {pool,pending,finish}=setup();const local=pool.acquire('host.glb'),peer=pool.acquire('host.glb');
 assert.equal(pending.length,1,'one container for both owners');finish(pending[0]);
 const asset=await local.promise;assert.equal(asset,await peer.promise);
 peer.release();peer.release();assert.equal(asset.unloads,0,'leaving multiplayer cannot unload the local car');
 const other=pool.acquire('host.glb');local.release();assert.equal(asset.unloads,0,'garage eviction cannot unload a remote car');
 other.release();assert.equal(asset.unloads,1,'unload only after every owner releases');
}
// Cancellation during loading and retry after a failed request.
{
 const {pool,pending,finish}=setup();const abandoned=pool.acquire('car.glb');abandoned.release();
 const retained=pool.acquire('car.glb');finish(pending[0]);await retained.promise;
 assert.equal(pending[0].unloads,0);retained.release();assert.equal(pending[0].unloads,1);
 const failed=pool.acquire('car.glb');const rejected=assert.rejects(failed.promise,/network/);pending[1].emit('error',Error('network'));await rejected;failed.release();
 const retry=pool.acquire('car.glb');finish(pending[2]);await retry.promise;retry.release();assert.equal(pending[2].unloads,1);
}

globalThis.document={createElement:()=>({append(){},remove(){},style:{}}),body:{append(){}}};
const profiles={a:{url:'a.glb',track:1.7,wheelbase:2.8},b:{url:'b.glb',track:1.7,wheelbase:2.8}};
const pose={p:[0,1,0],q:[0,0,0,1],w:Array.from({length:4},()=>[.36,0,0]),steer:0};
const peer=(vehicle='a')=>({id:'peer',vehicle,name:'Other driver',connected:true,state:pose});
function remotes(s){return createRemoteDrivers(s.pc,s.app,{getPosition:()=>new Vec3(),forward:new Vec3(0,0,1),camera:{worldToScreen(){}}},profiles,()=>({root:new Entity('driver'),fit(){},update(){}}),s.pool);}
{
 const s=setup(),remote=remotes(s),local=s.pool.acquire('a.glb');
 remote.receive([peer()]);remote.update(.016,new Vec3());s.finish(s.pending[0]);await local.promise;await flush();
 const root=s.app.root.children[0];assert.equal(root.children[0].children.filter(c=>c.name==='Vehicle model').length,1);
 remote.clear();assert.equal(s.pending[0].unloads,0,'clearing race participants preserves host resources');local.release();assert.equal(s.pending[0].unloads,1);
}
{
 const s=setup(),remote=remotes(s);remote.receive([peer()]);remote.update(.016,new Vec3());
 remote.receive([peer('b')]);remote.update(.016,new Vec3());remote.receive([peer()]);remote.update(.016,new Vec3());
 s.finish(s.pending[0]);s.finish(s.pending[1]);await flush();
 const car=s.app.root.children[0].children[0];assert.equal(car.children.filter(c=>c.name==='Vehicle model').length,1,'stale loads do not add a duplicate or replace the current car');
 assert.equal(s.pending[0].unloads,0);assert.equal(s.pending[1].unloads,1);
 remote.clear();assert.equal(s.pending[0].unloads,1);
}
{
 const s=setup(),remote=remotes(s);remote.receive([peer()]);remote.update(.016,new Vec3());remote.clear();remote.receive([peer()]);remote.update(.016,new Vec3());
 s.finish(s.pending[0]);await flush();assert.equal(s.app.root.children[0].children[0].children.filter(c=>c.name==='Vehicle model').length,1,'a reconnect cannot attach the old player instance');remote.clear();
}
delete globalThis.document;
console.log('Passed: shared local/remote assets, race cleanup, cache eviction, cancelled loads, retries, rapid switching and reconnects.');
