import {optimizeTerrainContacts} from './terrain-contacts.js';
export function createMapPhysics(C,world,meta,buffer) {
    optimizeTerrainContacts(C,world);
    world.collisionMatrix=new C.ObjectCollisionMatrix();world.collisionMatrixPrevious=new C.ObjectCollisionMatrix();
    const samples=new Float32Array(buffer),n=meta.n,step=meta.step,horizontalScale=meta.horizontalScale||1;
    const heights=Array.from({length:n},(_,i)=>Array.from(samples.subarray(i*n,(i+1)*n)));
    const ground=new C.Body({mass:0,shape:new C.Heightfield(heights,{elementSize:step})});
    ground.position.set(meta.minX,0,meta.maxZ);ground.quaternion.setFromEuler(-Math.PI/2,0,0);ground.aabbNeedsUpdate=true;world.addBody(ground);
    const fenceMaterial=new C.Material('Sliding fence contact');fenceMaterial.friction=.04;fenceMaterial.restitution=0;
    for(const w of meta.walls){
        const direction=new C.Vec3(w.bx-w.ax,w.by-w.ay,w.bz-w.az),length=direction.length(),q=new C.Quaternion();direction.normalize();q.setFromVectors(new C.Vec3(0,0,1),direction);
        const body=new C.Body({mass:0,material:fenceMaterial});body.position.set(w.ax,w.ay,w.az);
        // Smooth continuous contact under the visible rails keeps bumpers from wedging
        // between them and covers the post edges during a glancing strike.
        body.addShape(new C.Box(new C.Vec3(.18*horizontalScale,.68,length/2+.12*horizontalScale)),new C.Vec3((w.bx-w.ax)/2,(w.by-w.ay)/2+.55,(w.bz-w.az)/2),q);
        for(const [lift,radius] of [[.7,.10],[.30,.065]])body.addShape(new C.Box(new C.Vec3(radius*horizontalScale,radius,length/2)),new C.Vec3((w.bx-w.ax)/2,(w.by-w.ay)/2+lift,(w.bz-w.az)/2),q);
        body.addShape(new C.Box(new C.Vec3(.11*horizontalScale,.625,.11*horizontalScale)),new C.Vec3(0,.60,0));body.mapKind='fence';world.addBody(body);
    }
    // Match the actual scaled scenery geometry, rather than oversized spheres.
    for(const o of meta.scenery){const shape=o.kind==='tree'?new C.Cylinder(o.top,o.bottom,o.height,7):new C.ConvexPolyhedron({vertices:o.vertices.map(v=>new C.Vec3(...v)),faces:o.faces});const body=new C.Body({mass:0,shape});body.position.set(...o.position);body.aabbNeedsUpdate=true;body.mapKind=o.kind;world.addBody(body);}
    function heightAt(x,z){const u=Math.max(0,Math.min(n-1.00001,(x-meta.minX)/step)),v=Math.max(0,Math.min(n-1.00001,(meta.maxZ-z)/step));const i=Math.floor(u),j=Math.floor(v),tx=u-i,tz=v-j;const a=heights[i][j],b=heights[i+1][j],c=heights[i][j+1],d=heights[i+1][j+1];return tx+tz<=1?a+(b-a)*tx+(c-a)*tz:d+(c-d)*(1-tx)+(b-d)*(1-tz);}
    const rockRoutes=(meta.routes||[]).filter(r=>r.kind==='rock');
    function inRockRoute(x,z){for(const r of rockRoutes)for(let i=0;i<r.points.length-1;i++){const a=r.points[i],b=r.points[i+1],dx=b.x-a.x,dz=b.z-a.z,den=dx*dx+dz*dz;if(den<1e-8)continue;const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/den));if((x-a.x-t*dx)**2+(z-a.z-t*dz)**2<(r.width*.5)**2)return true;}return false;}
    function surfaceAt(x,z){for(const p of meta.pools)if(((x-p.x)/p.rx)**2+((z-p.z)/p.rz)**2<1){const depth=p.y+.015-heightAt(x,z);if(depth>0)return {name:'WATER CROSSING',grip:.9,resistance:Math.min(.38,depth/.8),depth};}if(inRockRoute(x,z))return {name:'ROCK TRAIL',grip:1.9,resistance:.045,depth:0};const sx=x/horizontalScale,sz=z/horizontalScale,v=Math.sin(sx*.045+sz*.029)+Math.cos(sz*.071-sx*.032);return v>.85?{name:'MUD',grip:1.15,resistance:.08,depth:0}:v<-.65?{name:'ROCK TRAIL',grip:1.9,resistance:.045,depth:0}:{name:'DIRT TRAIL',grip:1.65,resistance:.035,depth:0};}
    const velocity=new C.Vec3(),force=new C.Vec3(),relative=new C.Vec3();
    function applyWheelSurface(vehicle,body,tuning,i,handbrake){const wheel=vehicle.wheelInfos[i];if(!wheel.isInContact)return;const point=wheel.raycastResult.hitPointWorld,s=surfaceAt(point.x,point.z);wheel.frictionSlip=s.grip*(handbrake?.4:1);body.getVelocityAtWorldPoint(point,velocity);force.set(-velocity.x*tuning.mass*s.resistance/4,0,-velocity.z*tuning.mass*s.resistance/4);point.vsub(body.position,relative);body.applyForce(force,relative);}
    function surfaceInfo(body){return surfaceAt(body.position.x,body.position.z);}
    return {meta,ground,fenceMaterial,heightAt,surfaceAt,surfaceInfo,applyWheelSurface};
}
export async function loadFreeCity(pc,C,app,world){
    const assetUrl=path=>globalThis.offrideAssets?.url(path)||path;const responses=await Promise.all([fetch(assetUrl('./assets/map/physics.json')),fetch(assetUrl('./assets/map/heights.bin'))]);
    if(responses.some(r=>!r.ok))throw Error('Could not load map collision data');
    const [meta,buffer]=await Promise.all([responses[0].json(),responses[1].arrayBuffer()]);
    const result=createMapPhysics(C,world,meta,buffer);
    const asset=await new Promise((resolve,reject)=>app.assets.loadFromUrlAndFilename(assetUrl('./assets/map/freecity.glb'),'freecity.glb','container',(err,a)=>err?reject(Error(String(err))):resolve(a)));
    const model=asset.resource.instantiateRenderEntity();model.name='FreeCity offroad map';app.root.addChild(model);
    for(const a of asset.resource.materials){const m=a.resource;m.useDynamicRefraction=false;m.refraction=0;m.update();}
    // Geometry is split into spatial chunks at build time. Nearby geometry and shadows
    // are unchanged; distant chunks leave the draw list behind the fog curtain.
    const chunks=model.findComponents('render').map(render=>{let minX=Infinity,minZ=Infinity,maxX=-Infinity,maxZ=-Infinity;for(const mi of render.meshInstances){const b=mi.aabb,c=b.center,h=b.halfExtents;minX=Math.min(minX,c.x-h.x);maxX=Math.max(maxX,c.x+h.x);minZ=Math.min(minZ,c.z-h.z);maxZ=Math.max(maxZ,c.z+h.z);}return{render,minX,maxX,minZ,maxZ};});
    let visibilityClock=1;result.updateVisibility=(position,dt)=>{visibilityClock+=dt;if(visibilityClock<.2)return;visibilityClock=0;for(const c of chunks){const dx=Math.max(c.minX-position.x,0,position.x-c.maxX),dz=Math.max(c.minZ-position.z,0,position.z-c.maxZ);c.render.enabled=dx*dx+dz*dz<265*265;}};
    globalThis.offrideLoading?.stage(97,'World and collision surfaces ready');return result;
}
