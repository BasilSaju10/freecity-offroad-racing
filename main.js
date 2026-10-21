import {createPivotBurnout} from './pivot-burnout.js';
import {addedExhaustOutlets} from './added-vehicle-effects.js';
import {vehicleSpeedLimit,enforceVehicleSpeedLimit,truckVehicleIds} from './vehicle-limits.js';
import {applyBurnoutDrift} from './burnout-drift.js';
import {attachedFleetProfiles} from './attached-fleet-profiles.js';
import {applyVehicleNames} from './vehicle-names.js';
import {bikeProfiles} from './bike-profiles.js';
import {configureBikeWheels,bikeControls,stabilizeBikeTraction} from './bike-physics.js';
import {createBikeRider} from './bike-rider.js';
import {updateBikeSuspension} from './bike-suspension.js';
import {createDriveSoundSequence} from './drive-sound-sequence.js';
import {createWeather} from './weather.js';
import {createWindshieldWipers} from './windshield-wipers.js';
import {lampProfiles} from './vehicle-lights.js';
import {createMultiplayer} from './multiplayer-client.js';
import {createVehicleAudio} from './vehicle-audio.js';
import {createVehicleLights} from './vehicle-lights.js';
import {createRemoteDrivers} from './remote-drivers.js';
import {createVehicleAssets} from './vehicle-assets.js';
import {nearestTrackPose} from './track-reset.js';
import {createWaterSplashes} from './water-splashes.js';
import {createExhaustSmoke} from './exhaust-smoke.js';
import {exhaustOutlets} from './exhaust-outlets.js';
import {createHelmetDriver} from './helmet-driver.js';
import {createVehiclePicker} from './vehicle-picker.js';
import {solidifyWheelSurfaces} from './wheel-surfaces.js';
import {constrainCameraToTerrain,exteriorPitchLimits} from './camera-terrain.js';
import {createDrivingSoil} from './driving-soil.js';
import { createMapBroadphase } from './map-broadphase.js';
import {loadFreeCity} from './freecity-world.js';
import * as pc from './vendor/playcanvas/index.js';
import * as C from './vendor/cannon-es.js';
Object.assign(exhaustOutlets,addedExhaustOutlets);
const pivotBurnout=createPivotBurnout(C);

const $ = id => document.getElementById(id);
const app = new pc.Application($('canvas'), { graphicsDeviceOptions: { antialias: true, alpha: false } });
const vehicleAssets=createVehicleAssets(pc,app);
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW); app.setCanvasResolution(pc.RESOLUTION_AUTO);
app.graphicsDevice.maxPixelRatio = Math.min(devicePixelRatio, 1.7);
window.addEventListener('resize', () => app.resizeCanvas());
app.scene.ambientLight = new pc.Color(.28,.31,.36);
app.scene.toneMapping = pc.TONEMAP_ACES;app.scene.fog.type=pc.FOG_LINEAR;app.scene.fog.color=new pc.Color(.52,.72,.91);app.scene.fog.start=165;app.scene.fog.end=240;globalThis.offrideLoading?.stage(96,'Preparing lighting and terrain');
const camera = new pc.Entity('Follow camera');
camera.addComponent('camera', { clearColor: new pc.Color(.52,.72,.91), fov: 58, nearClip:.04, farClip:280 }); app.root.addChild(camera);
const sun = new pc.Entity('Afternoon sun'); sun.addComponent('light', { type:'directional', color:new pc.Color(1,.96,.89), intensity:1.7, castShadows:true, shadowDistance:90, shadowResolution:2048, shadowBias:.2, normalOffsetBias:.04 });
sun.setEulerAngles(48,-35,0); app.root.addChild(sun);

function material(name, color, roughness=1, metalness=0) { const m=new pc.StandardMaterial();m.name=name;m.diffuse=new pc.Color(...color);m.useMetalness=true;m.metalness=metalness;m.gloss=1-roughness;m.update();return m; }
// A local procedural daylight environment gives metallic paint and glass real reflections.
const skyCanvas=document.createElement('canvas');skyCanvas.width=512;skyCanvas.height=256;
const skyCtx=skyCanvas.getContext('2d');const skyGradient=skyCtx.createLinearGradient(0,0,0,256);
skyGradient.addColorStop(0,'#3f80d0');skyGradient.addColorStop(.45,'#bfdff5');skyGradient.addColorStop(.51,'#d8e4e9');skyGradient.addColorStop(.54,'#617452');skyGradient.addColorStop(1,'#333b34');skyCtx.fillStyle=skyGradient;skyCtx.fillRect(0,0,512,256);
const skyTexture=new pc.Texture(app.graphicsDevice,{name:'Daylight',width:512,height:256,format:pc.PIXELFORMAT_RGBA8,mipmaps:true,projection:pc.TEXTUREPROJECTION_EQUIRECT});skyTexture.setSource(skyCanvas);
const lighting=pc.EnvLighting.generateLightingSource(skyTexture,{size:64});
app.scene.envAtlas=pc.EnvLighting.generateAtlas(lighting,{size:256,numReflectionSamples:64,numAmbientSamples:64});
const world=new C.World({gravity:new C.Vec3(0,-9.81,0)});world.broadphase=createMapBroadphase(C,world);world.solver.iterations=15;world.defaultContactMaterial.friction=.55;world.defaultContactMaterial.restitution=.02;
$('status').textContent='Loading OFFRIDE map and collision surfaces...';
let testingGround;try{testingGround=await loadFreeCity(pc,C,app,world);}catch(e){$('status').textContent='Could not load OFFRIDE: '+e.message;throw e;}


// Units: meters, kilograms, seconds. A heavy SUV-like starting tune, not manufacturer telemetry.
const tuning={mass:2500,wheelbase:2.856924,track:1.655536,radius:.39975,restLength:.36,stiffness:32,compression:4.8,rebound:4.2,travel:.20,engineForce:3300,brake:42,rideHeight:.54165,rearDrive:false,eye:[-.43,.90,.25]};
const vehicleScale=1.12;
// Beveled lower bumpers avoid a full-width box snagging before the front tyres reach a log.
function createSUVHull(halfWidth=.94,halfLength=2.25,top=.94){const outline=[[-halfLength,.30],[-halfLength*.533333,-.06],[halfLength*.533333,-.06],[halfLength,.30],[halfLength,top],[-halfLength,top]],vertices=[];for(const x of [-halfWidth,halfWidth])for(const [z,y] of outline)vertices.push(new C.Vec3(x,y,z));const faces=[[0,1,2,3,4,5],[6,7,8,9,10,11]];for(let i=0;i<6;i++){const j=(i+1)%6;faces.push([i,j,j+6,i+6]);}const center=new C.Vec3(0,.35,0);for(const f of faces){const a=vertices[f[0]],b=vertices[f[1]],c=vertices[f[2]];if(b.vsub(a).cross(c.vsub(a)).dot(a.vsub(center))<0)f.reverse();}return new C.ConvexPolyhedron({vertices,faces});}
const chassis=new C.Body({mass:tuning.mass,linearDamping:.008,angularDamping:.28});
chassis.addShape(createSUVHull());
const skidMaterial=new C.Material('SUV skid plate');skidMaterial.friction=.12;skidMaterial.restitution=0;chassis.material=skidMaterial;
world.addContactMaterial(new C.ContactMaterial(skidMaterial,world.defaultMaterial,{friction:.12,restitution:0}));
if(testingGround.fenceMaterial)world.addContactMaterial(new C.ContactMaterial(skidMaterial,testingGround.fenceMaterial,{friction:.045,restitution:0,contactEquationStiffness:1e8,contactEquationRelaxation:4}));
const vehicle=new C.RaycastVehicle({chassisBody:chassis,indexRightAxis:0,indexUpAxis:1,indexForwardAxis:2});
for(const [x,z] of [[-tuning.track/2,-tuning.wheelbase/2],[tuning.track/2,-tuning.wheelbase/2],[-tuning.track/2,tuning.wheelbase/2],[tuning.track/2,tuning.wheelbase/2]])vehicle.addWheel({radius:tuning.radius,directionLocal:new C.Vec3(0,-1,0),axleLocal:new C.Vec3(1,0,0),chassisConnectionPointLocal:new C.Vec3(x,.12,z),suspensionStiffness:tuning.stiffness,suspensionRestLength:tuning.restLength,dampingRelaxation:tuning.rebound,dampingCompression:tuning.compression,maxSuspensionForce:42000,maxSuspensionTravel:tuning.travel,frictionSlip:2.5,rollInfluence:.4,customSlidingRotationalSpeed:25,useCustomSlidingRotationalSpeed:false});
world.addBody(chassis);vehicle.world=world;
const networkLock={freeze:false,race:false,vehicle:false};let online=null,pendingNetworkPose=null;
const bodyVisual=new pc.Entity('Vehicle body');app.root.addChild(bodyVisual);
const driver=createHelmetDriver(pc,app,bodyVisual);
const suppliedHands=await loadContainer('./assets/hands-on-wheel.glb');for(const a of suppliedHands.resource.materials){const m=a.resource;m.diffuseVertexColor=true;m.diffuse.set(1,1,1);m.update();}driver.attachHands(suppliedHands.resource.instantiateRenderEntity());
const drivingSoil=createDrivingSoil(pc,app,testingGround,camera);
const waterSplashes=createWaterSplashes(pc,app,testingGround,camera,at=>vehicleAudio.waterEntry(at.strength,at.speed));
const exhaustSmoke=createExhaustSmoke(pc,app,testingGround,camera,exhaustOutlets);
const wheelVisuals=[];const rubber=material('Rubber',[.07,.08,.075]),rim=material('Unbranded alloy',[.4,.43,.41],.3,.7);
for(let i=0;i<4;i++){const pivot=new pc.Entity('Wheel '+i);app.root.addChild(pivot);const tire=new pc.Entity('Tire');tire.addComponent('render',{type:'cylinder'});tire.render.material=rubber;tire.setLocalEulerAngles(0,0,90);tire.setLocalScale(.81,.28,.81);pivot.addChild(tire);const hub=new pc.Entity('Hub');hub.addComponent('render',{type:'cylinder'});hub.render.material=rim;hub.setLocalEulerAngles(0,0,90);hub.setLocalScale(.47,.29,.47);pivot.addChild(hub);wheelVisuals.push(pivot);}
let loadedWheels=null,loadedBrakes=null,steeringVisual=null,modelReady=false;
const wheelState=vehicle.wheelInfos.map(()=>({previousLength:tuning.restLength,length:tuning.restLength,previousSpin:0,spin:0,previousSteer:0,steer:0}));
let spawnPoint=testingGround.meta.spawn;
const keys=new Set();let steering=0,bikeRenderSteer=0,view=0,paused=false;let cameraYaw=0,cameraPitch=.30,cameraDistance=10;const canvas=$('canvas');let softMouseLook=false;const camPos=new pc.Vec3(9,6,13),target=new pc.Vec3(),offset=new pc.Vec3();
const vehicleAudio=createVehicleAudio(),vehicleLights=createVehicleLights(pc),driveGearSequence=createDriveSoundSequence();let headlights=false;
const weather=createWeather(pc,app,camera,sun,testingGround,()=>vehicleAudio.thunder());
const wipers=createWindshieldWipers(pc,bodyVisual);
const headlightBeams=[-1,1].map(side=>{const e=new pc.Entity('Headlight road beam');e.addComponent('light',{type:'spot',color:new pc.Color(.86,.92,1),intensity:5,range:42,innerConeAngle:24,outerConeAngle:38,castShadows:false});e.setLocalEulerAngles(82,0,0);bodyVisual.addChild(e);e.enabled=false;return{e,side};});
function toggleHeadlights(){headlights=!headlights;vehicleAudio.headlights();$('headlight-toggle').setAttribute('aria-pressed',String(headlights));$('headlight-toggle').textContent=headlights?'Headlights on':'Headlights off';}
$('headlight-toggle').onclick=toggleHeadlights;
addEventListener('keydown',e=>{if(e.code==='KeyH'&&!e.repeat&&!/INPUT|TEXTAREA/.test(e.target.tagName))toggleHeadlights();});
chassis.addEventListener('collide',e=>{if(!paused&&modelReady)vehicleAudio.impact(Math.abs(e.contact.getImpactVelocityAlongNormal()));});
function reset(pose=spawnPoint){pivotBurnout.reset();driveGearSequence.reset();waterSplashes.reset();exhaustSmoke.reset();chassis.position.set(pose.x,testingGround.heightAt(pose.x,pose.z)+tuning.rideHeight+.15,pose.z);chassis.quaternion.setFromAxisAngle(new C.Vec3(0,1,0),pose.yaw);chassis.velocity.setZero();chassis.angularVelocity.setZero();chassis.force.setZero();chassis.torque.setZero();chassis.wakeUp();steering=0;cameraYaw=0;cameraPitch=view===2?(tuning.bike?.16:(tuning.cockpitPitch??.10)):.30;for(const state of wheelState){state.previousSteer=state.steer=0;state.previousSpin=state.spin=0;state.previousLength=state.length=tuning.restLength;}chassis.previousPosition.copy(chassis.position);chassis.interpolatedPosition.copy(chassis.position);chassis.previousQuaternion.copy(chassis.quaternion);chassis.interpolatedQuaternion.copy(chassis.quaternion);chassis.aabbNeedsUpdate=true;for(let i=0;i<vehicle.wheelInfos.length;i++){vehicle.setSteeringValue(0,i);vehicle.setBrake(0,i);vehicle.applyEngineForce(0,i);}const back=chassis.quaternion.vmult(new C.Vec3(5,4.5,10));camPos.set(chassis.position.x+back.x,chassis.position.y+back.y,chassis.position.z+back.z);}
reset();
function resetToTrack(){if(networkLock.freeze)return;keys.clear();const forward=chassis.quaternion.vmult(new C.Vec3(0,0,-1));const pose=nearestTrackPose([testingGround.meta.trail,...(testingGround.meta.routes||[]).map(r=>r.points)],chassis.position,forward)||spawnPoint;reset(pose);$('status').textContent='Returned to the nearest track centre.';}
$('reset-track').onclick=resetToTrack;
let lastCameraChange=-1000;
function selectCamera(mode){view=mode;cameraYaw=0;cameraPitch=view===2?(tuning.bike?.16:(tuning.cockpitPitch??.10)):.30;document.body.classList.toggle('cockpit',view===2);$('view-name').textContent=['CHASE CAMERA','ORBIT CAMERA','DRIVER SEAT'][view];camera.camera.fov=view===2?(tuning.bike?86:68):58;if(activeModel)for(const mi of activeModel.glassInstances)mi.visible=view!==2;}
function cycleCamera(){if(performance.now()-lastCameraChange<250)return;lastCameraChange=performance.now();selectCamera((view+1)%3);}
addEventListener('keydown',e=>{if($('vehicle-picker').open||document.getElementById('online-dialog')?.open)return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();keys.add(e.code);if(!e.repeat&&!paused&&!networkLock.freeze){if(['KeyW','ArrowUp'].includes(e.code))vehicleAudio.direction(1);else if(['KeyS','ArrowDown'].includes(e.code))vehicleAudio.direction(-1);}if(!e.repeat&&e.code==='KeyR')resetToTrack();if(!e.repeat&&e.code==='KeyF')selectCamera(2);if(!e.repeat&&e.code==='KeyC'){cycleCamera();}});addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{keys.clear();paused=true;});addEventListener('focus',()=>paused=$('vehicle-picker').open||document.getElementById('online-dialog')?.open);$('reset').onclick=resetToTrack;$('camera-toggle').onclick=cycleCamera;$('driver-view').onclick=()=>selectCamera(2);
// Pointer lock keeps mouse movement relative while the camera follows the vehicle.
function fallbackMouseLook(){softMouseLook=true;canvas.style.cursor='none';$('mouse-hint').textContent='MOUSE LOOK ON · ESC TO RELEASE';$('status').textContent='Preview mouse look active. A regular browser supports full cursor lock.';}
canvas.addEventListener('click',()=>{if(document.pointerLockElement!==canvas){try{const request=canvas.requestPointerLock();request?.catch?.(fallbackMouseLook);}catch{fallbackMouseLook();}}});
addEventListener('keydown',e=>{if(e.code==='Escape'){softMouseLook=false;canvas.style.cursor='grab';$('mouse-hint').textContent='CLICK SCENE TO LOOK AROUND';$('status').textContent='OFFRIDE · All-wheel drive';}});
let orbitDragging=false;
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('mousedown',e=>{if(e.button===2)orbitDragging=true;});addEventListener('mouseup',()=>orbitDragging=false);
addEventListener('mousemove',e=>{if(document.pointerLockElement!==canvas&&!orbitDragging&&!softMouseLook)return;cameraYaw-=e.movementX*.003;cameraPitch=Math.max(view===2?-.8:exteriorPitchLimits.min,Math.min(view===2?.8:exteriorPitchLimits.max,cameraPitch+e.movementY*.003));if(view===2)cameraYaw=Math.max(-1.5,Math.min(1.5,cameraYaw));});
canvas.addEventListener('wheel',e=>{e.preventDefault();cameraDistance=Math.max(4,Math.min(22,cameraDistance+e.deltaY*.008));},{passive:false});
document.addEventListener('pointerlockchange',()=>{softMouseLook=false;canvas.style.cursor=document.pointerLockElement===canvas?'none':'grab';$('mouse-hint').textContent=document.pointerLockElement===canvas?'MOUSE LOOK ON · ESC TO RELEASE':'CLICK SCENE TO LOOK AROUND';});
const signedSpeed=()=>chassis.velocity.dot(chassis.quaternion.vmult(new C.Vec3(0,0,-1)));
function controls(dt){const pivotTurn=Number(keys.has('KeyA')||keys.has('ArrowLeft'))-Number(keys.has('KeyD')||keys.has('ArrowRight'));if(pivotBurnout.update(keys.has('Space')&&keys.has('KeyQ')&&!networkLock.freeze,chassis,vehicle,tuning,pivotTurn,dt)){steering=0;return;}if(tuning.bike&&!networkLock.freeze){const input={throttle:Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown')),turn:Number(keys.has('KeyA')||keys.has('ArrowLeft'))-Number(keys.has('KeyD')||keys.has('ArrowRight')),handbrake:keys.has('Space'),steering};steering=bikeControls(C,vehicle,chassis,tuning,testingGround,input,dt);return;}if(networkLock.freeze){for(let i=0;i<vehicle.wheelInfos.length;i++){vehicle.applyEngineForce(0,i);vehicle.setBrake(120,i);}return;}const speed=signedSpeed(),throttle=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0),turn=(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)-(keys.has('KeyD')||keys.has('ArrowRight')?1:0);const gearPhase=driveGearSequence.update({speed,throttle},dt);if(gearPhase.mode==='shifting'){if(gearPhase.shift){const forward=chassis.quaternion.vmult(new C.Vec3(0,0,-1));chassis.velocity.vsub(forward.scale(speed),chassis.velocity);}for(let i=0;i<vehicle.wheelInfos.length;i++){vehicle.applyEngineForce(0,i);vehicle.setBrake(120,i);}return;}const limit=.5/(1+Math.abs(speed)*.055);steering+=(turn*limit-steering)*(1-Math.exp(-dt*7));const turnRadius=tuning.wheelbase/Math.tan(Math.max(.0001,Math.abs(steering)));const inner=Math.atan(tuning.wheelbase/(turnRadius-tuning.track/2)),outer=Math.atan(tuning.wheelbase/(turnRadius+tuning.track/2));vehicle.setSteeringValue(Math.sign(steering)*(steering>0?inner:outer),0);vehicle.setSteeringValue(Math.sign(steering)*(steering>0?outer:inner),1);const braking=throttle!==0&&speed*throttle<-.7;const speedLimit=throttle<0?Math.min(11,vehicleSpeedLimit(tuning)):vehicleSpeedLimit(tuning);const powerLimited=Math.min(tuning.engineForce,190000/(4*Math.max(1,Math.abs(speed))));const limiter=Math.max(0,Math.min(1,(speedLimit-Math.abs(speed))/3));const force=braking?0:throttle*powerLimited*limiter;const burnout=keys.has('Space')&&throttle>0&&!braking,drifting=burnout&&turn!==0;for(let i=0;i<4;i++){vehicle.applyEngineForce(burnout?(i>1?force*1.15:0):(tuning.rearDrive&&i<2?0:force),i);vehicle.setBrake(braking?tuning.brake:throttle===0?(Math.abs(speed)<.8?45:.25):0,i);testingGround.applyWheelSurface(vehicle,chassis,tuning,i,keys.has('Space')&&i>1);if(burnout){vehicle.setBrake(i<2?(drifting?0:120):0,i);if(drifting)vehicle.wheelInfos[i].frictionSlip*=.04;else if(i>1)vehicle.wheelInfos[i].frictionSlip*=.2;}else if(keys.has('Space')&&i>1)vehicle.setBrake(150,i);}if(burnout)applyBurnoutDrift(C,chassis,turn,dt);if(Math.abs(speed)>1){const drag=-speed*Math.abs(speed)*.55;chassis.applyForce(chassis.quaternion.vmult(new C.Vec3(0,0,-drag)));}}
// Capture suspension and rolling angle at each physics step, then interpolate for rendering.
world.addEventListener('preStep',()=>{controls(1/120);vehicle.updateVehicle(1/120);});
world.addEventListener('postStep',()=>{
 pivotBurnout.constrain(chassis,tuning);
 if(tuning.bike)stabilizeBikeTraction(C,vehicle,chassis,tuning,1/120);enforceVehicleSpeedLimit(chassis,tuning,vehicle.wheelInfos.some(w=>w.isInContact));
 for(let i=0;i<vehicle.wheelInfos.length;i++){
  const w=vehicle.wheelInfos[i],state=wheelState[i];
  state.previousLength=state.length;state.length=w.suspensionLength;
  state.previousSpin=state.spin;state.previousSteer=state.steer;state.steer=w.steering;
  const forward=chassis.quaternion.vmult(new C.Vec3(-Math.sin(w.steering),0,-Math.cos(w.steering)));
  const velocity=new C.Vec3();chassis.getVelocityAtWorldPoint(w.chassisConnectionPointWorld,velocity);
  // Right-hand X rotation must be negative when the vehicle rolls toward local -Z.
  const demand=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'));const burnout=keys.has('Space')&&demand!==0&&Math.abs(signedSpeed())<8&&demand*signedSpeed()>-.7;
  if(pivotBurnout.active){if(i>1)state.spin-=32/120;}else if(burnout&&i>1)state.spin-=demand*(24+Math.abs(signedSpeed())/w.radius*.2)/120;else if(!(keys.has('Space')&&i>1))state.spin-=velocity.dot(forward)/w.radius/120;
 }
});
const quat=new pc.Quat(),steerQuat=new pc.Quat(),spinQuat=new pc.Quat(),wheelQuat=new pc.Quat();
const mount=new pc.Vec3(),renderPosition=new pc.Vec3(),lookQuat=new pc.Quat(),headQuat=new pc.Quat();
const steeringAxis=new pc.Vec3(0,.65,.76).normalize();
function sync(){
 const p=chassis.interpolatedPosition,q=chassis.interpolatedQuaternion;
 bodyVisual.setPosition(p.x,p.y,p.z);quat.set(q.x,q.y,q.z,q.w);bodyVisual.setRotation(quat);
 if(tuning.bike&&wheelState[0]){const state=wheelState[0],alpha=Math.max(0,Math.min(1,world.accumulator/(1/120)));bikeRenderSteer=state.previousSteer+(state.steer-state.previousSteer)*alpha;}
 if(steeringVisual){steerQuat.setFromAxisAngle(tuning.bike?pc.Vec3.UP:steeringAxis,(tuning.bike?bikeRenderSteer:steering)*(tuning.bike?1:14)*180/Math.PI);steerQuat.mul(activeModel.steeringRest);steeringVisual.setLocalRotation(steerQuat);}
 const alpha=Math.max(0,Math.min(1,world.accumulator/(1/120)));
 for(let i=0;i<vehicle.wheelInfos.length;i++){
  const state=wheelState[i],info=vehicle.wheelInfos[i];
  const length=state.previousLength+(state.length-state.previousLength)*alpha;
  const spin=state.previousSpin+(state.spin-state.previousSpin)*alpha;
  const steer=state.previousSteer+(state.steer-state.previousSteer)*alpha;
  const point=info.chassisConnectionPointLocal;mount.set(point.x,point.y-length,point.z);quat.transformVector(mount,renderPosition);renderPosition.add(bodyVisual.getPosition());
  steerQuat.setFromAxisAngle(pc.Vec3.UP,steer*180/Math.PI);spinQuat.setFromAxisAngle(pc.Vec3.RIGHT,spin*180/Math.PI);
  wheelQuat.mul2(quat,steerQuat);
  if(loadedBrakes?.[i]){loadedBrakes[i].setPosition(renderPosition);loadedBrakes[i].setRotation(wheelQuat);}
  wheelQuat.mul(spinQuat);
  for(const visual of [wheelVisuals[i],loadedWheels?.[i]])if(visual){visual.setPosition(renderPosition);visual.setRotation(wheelQuat);}
 }
}
const cameraForward=new pc.Vec3(),cameraAnchor=new pc.Vec3();
function updateCamera(dt){
 const p=bodyVisual.getPosition();
 if(view===2){
  // Driver eye is inside the cabin; rigid attachment prevents lag through pillars and glass.
  offset.set(...tuning.eye);quat.transformVector(offset,offset);camPos.copy(p).add(offset);camera.setPosition(camPos);
  headQuat.setFromEulerAngles(-cameraPitch*180/Math.PI,cameraYaw*180/Math.PI,0);lookQuat.mul2(quat,headQuat);camera.setRotation(lookQuat);
 }else{
  // Follow heading without inheriting chassis roll/pitch, which can swing the
  // exterior camera beneath the map when the vehicle tips on a slope.
  quat.transformVector(pc.Vec3.FORWARD,cameraForward);
  const yaw=cameraYaw+(view===1?(tuning.eye[0]<0?-.7:.7):0)+Math.atan2(-cameraForward.x,-cameraForward.z);
  cameraPitch=Math.max(exteriorPitchLimits.min,Math.min(exteriorPitchLimits.max,cameraPitch));
  offset.set(Math.sin(yaw)*Math.cos(cameraPitch)*cameraDistance,1+Math.sin(cameraPitch)*cameraDistance,Math.cos(yaw)*Math.cos(cameraPitch)*cameraDistance);
  cameraAnchor.copy(p);cameraAnchor.y=Math.max(p.y+.65,testingGround.heightAt(p.x,p.z)+.75);
  target.copy(p).add(offset);constrainCameraToTerrain(cameraAnchor,target,testingGround.heightAt);
  camPos.lerp(camPos,target,1-Math.exp(-dt*5));constrainCameraToTerrain(cameraAnchor,camPos,testingGround.heightAt);
  camera.setPosition(camPos);camera.lookAt(cameraAnchor);
 }
}
let physicsAccumulator=0;
app.on('update',dt=>{
 dt=Math.min(dt,.1);
 if(!paused){
  // Keep simulation time independent of rendering cost. Cannon's built-in catch-up
  // loop otherwise discards steps after an 8 ms budget, making the car run slowly.
  physicsAccumulator+=dt;
  while(physicsAccumulator>=1/120){world.step(1/120);physicsAccumulator-=1/120;}
  world.accumulator=physicsAccumulator;
  const alpha=physicsAccumulator*120;
  chassis.previousPosition.lerp(chassis.position,alpha,chassis.interpolatedPosition);
  chassis.previousQuaternion.slerp(chassis.quaternion,alpha,chassis.interpolatedQuaternion);
 }
 sync();driver.root.enabled=!tuning.bike;driver.update(steering,view);if(activeModel?.rider){activeModel.rider.root.enabled=!!tuning.bike;activeModel.rider.update({speed:signedSpeed(),steer:bikeRenderSteer,reverse:(keys.has('KeyS')||keys.has('ArrowDown'))&&signedSpeed()<.4,grounded:vehicle.wheelInfos.some(w=>w.isInContact),dt:paused?0:dt,view});}if(tuning.bike&&activeModel)updateBikeSuspension(activeModel.model,tuning,vehicleScale,wheelState.map(w=>w.length),bikeRenderSteer);updateCamera(dt);testingGround.updateVisibility?.(camera.getPosition(),dt);online?.update(dt,chassis.position);if(!paused){drivingSoil.update(activeModel,vehicle,chassis,tuning,dt,wheelState);if(modelReady){waterSplashes.update(activeVehicleId,vehicle,chassis,tuning,dt);const throttle=Number(pivotBurnout.active||keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'));exhaustSmoke.update(activeVehicleId,bodyVisual,chassis,vehicleScale,throttle,signedSpeed(),dt);}}
 const soundSpeed=signedSpeed(),soundThrottle=Number(pivotBurnout.active||keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown')),soundBraking=(soundThrottle!==0&&soundSpeed*soundThrottle<-.7)||keys.has('Space');
 vehicleLights.update(activeModel,headlights,soundBraking);
 weather.update(dt,{view,body:bodyVisual,profile:tuning,scale:vehicleScale,paused:paused});
 wipers.update(activeVehicleId,tuning.bike?0:weather.rain,dt,vehicleScale);
 const lamp=lampProfiles[activeVehicleId];for(const {e,side} of headlightBeams){e.enabled=headlights&&modelReady;if(lamp)e.setLocalPosition(side*(lamp.f[0]+lamp.f[1])*.5*vehicleScale,(lamp.f[2]+lamp.f[3])*.5*vehicleScale,lamp.f[4]*vehicleScale-.04);}
 vehicleAudio.update({speed:soundSpeed,throttle:paused||networkLock.freeze?0:soundThrottle,brake:soundBraking,burnout:(pivotBurnout.active||keys.has('Space'))&&soundThrottle!==0&&Math.abs(soundSpeed)<8,grounded:vehicle.wheelInfos.some(w=>w.isInContact),paused:paused||!modelReady||carLoading},dt);
 $('speed').textContent=Math.round(Math.abs(soundSpeed)*3.6);

 if(activeModel?.soil)canvas.dataset.soil=JSON.stringify(activeModel.soil.groups.map(g=>({mud:+g.state.mud.toFixed(3),dust:+g.state.dust.toFixed(3)})));
 if(chassis.position.y< -30||Math.abs(chassis.position.x)>testingGround.meta.size/2-4||Math.abs(chassis.position.z)>testingGround.meta.size/2-4){const forward=chassis.quaternion.vmult(new C.Vec3(0,0,-1));reset(nearestTrackPose([testingGround.meta.trail,...(testingGround.meta.routes||[]).map(r=>r.points)],chassis.position,forward)||spawnPoint);}
});

// Unbranded, live cabin instruments placed over the supplied display surfaces.
const instrumentCanvas=document.createElement('canvas');instrumentCanvas.width=512;instrumentCanvas.height=256;
const instruments=new pc.Texture(app.graphicsDevice,{name:'Live driver display',width:512,height:256,mipmaps:false});
const displayMat=material('Cabin display',[0,0,0]);displayMat.emissive=new pc.Color(.9,1,1);displayMat.emissiveMap=instruments;displayMat.useLighting=false;displayMat.cull=pc.CULLFACE_NONE;displayMat.update();
function cabinDisplay(name,pos,size){const e=new pc.Entity(name);e.addComponent('render',{type:'plane',castShadows:false});e.render.material=displayMat;e.setLocalPosition(...pos);e.setLocalEulerAngles(78,0,0);e.setLocalScale(size[0],1,size[1]);bodyVisual.addChild(e);return e;}
const dashboardDisplay=cabinDisplay('Digital instruments',[-.436,.745,-.53],[.34,.145]);
let displayTimer=0;
app.on('update',dt=>{displayTimer+=dt;if(displayTimer<.1)return;displayTimer=0;const ctx=instrumentCanvas.getContext('2d');ctx.fillStyle='#09131f';ctx.fillRect(0,0,512,256);ctx.strokeStyle='#4bbfda';ctx.lineWidth=5;for(const x of [85,427]){ctx.beginPath();ctx.arc(x,136,63,.8,5.5);ctx.stroke();}ctx.textAlign='center';ctx.fillStyle='#f2f8ff';ctx.font='bold 88px sans-serif';ctx.fillText(Math.round(Math.abs(signedSpeed())*3.6),256,150);ctx.font='19px sans-serif';ctx.fillStyle='#80b6ce';ctx.fillText('km/h',256,183);ctx.font='16px sans-serif';ctx.fillText(tuning.rearDrive?'RWD':'AWD',85,145);ctx.fillText('DRIVE',427,145);instruments.setSource(instrumentCanvas);});

function isCabinGlass(name){return /cabin_glass|windscreen|window|defrost|clear automotive glass|^glass_y/i.test(name)||(/glass|transl/i.test(name)&&!/headlight|taillight|lamp|red_glass|orange_glass|fari|zad/i.test(name));}
function loadContainer(url,filename){return new Promise((resolve,reject)=>app.assets.loadFromUrlAndFilename(globalThis.offrideAssets?.url(url)||url,filename||url,'container',(err,asset)=>err?reject(Error(String(err))):resolve(asset)));}
const vehicleProfiles={"suv": {"url": "./assets/vehicle.glb", "mass": 2500, "wheelbase": 2.856924, "track": 1.655536, "radius": 0.39975, "restLength": 0.36, "stiffness": 32, "compression": 4.8, "rebound": 4.2, "travel": 0.2, "engineForce": 3300, "brake": 42, "rideHeight": 0.54165, "rearDrive": false, "eye": [-0.43, 0.9, 0.25], "steeringPosition": [-0.4365, 0.70835, -0.34759], "collider": [0.94, 0.55, 2.25], "colliderOffset": [0, 0.39, 0], "display": [-0.436, 0.745, -0.53]}};
// All vehicles share the SUV's driving tune, with model-specific wheel stations and hulls.
vehicleProfiles.suv.label='SUV';vehicleProfiles.suv.bike=false;
vehicleProfiles['range-rover']={...vehicleProfiles.suv,url:'./assets/range-rover.glb',label:'Range Rover',eye:[-.4161,.97634,.08615],steeringPosition:[-.41646,.64214,-.24931],displayEnabled:false};
vehicleProfiles['defender-90']={...vehicleProfiles.suv,...{"url":"./assets/defender-90.glb","label":"Defender 90","wheelbase":2.378018319606781,"track":1.4823806583881378,"radius":0.39187463856789273,"rideHeight":0.5552340135678927,"eye":[-0.41010361909866333,1.1169065237045288,-0.15597257018089294],"displayEnabled":false,"hullWidth":0.9009276664257049,"hullLength":2.0507238006591795,"hullTop":1.447559959888458,"twoSidedBody":true}};
vehicleProfiles['defender-grasmere']={...vehicleProfiles.suv,...{"url":"./assets/defender-grasmere.glb","label":"Defender Grasmere","wheelbase":2.794,"track":1.546542114726916,"radius":0.38943626630544675,"rideHeight":0.5527956413054468,"eye":[-0.39522233605384827,0.9149073362350464,-0.3852751851081848],"displayEnabled":false,"hullWidth":0.9047933995723724,"hullLength":2.2932025909423825,"hullTop":1.2130437088012695,"twoSidedBody":true,"steeringPosition":[-0.39522233605384827,0.6911845207214355,-0.5717108845710754],"steeringAxis":[0,0.34,-0.94]}};
vehicleProfiles['ram-trx']={...vehicleProfiles.suv,...{"url":"./assets/ram-trx.glb","label":"Ram 1500 TRX","wheelbase":3.6869932413101196,"track":1.86420476436615,"radius":0.451975006213439,"rideHeight":0.615334381213439,"eye":[-0.4399999976158142,1.0327390432357788,-0.29150423407554626],"displayEnabled":false,"hullWidth":1.15,"hullLength":2.9680673217773434,"hullTop":1.3693724870681763,"twoSidedBody":true}};
vehicleProfiles['fortuner']={...vehicleProfiles.suv,...{"url":"./assets/fortuner.glb","label":"Toyoda Fortuner","wheelbase":2.745,"track":1.7230568238515482,"radius":0.36854816434388943,"rideHeight":0.5319075393438893,"eye":[-0.39193612337112427,0.9355410933494568,-0.3938324749469757],"displayEnabled":false,"hullWidth":0.9348005890846253,"hullLength":2.284394145011902,"hullTop":1.2323211371898652,"twoSidedBody":true}};
vehicleProfiles['gladiator']={...vehicleProfiles.suv,...{"url":"./assets/gladiator.glb","label":"Jeap Gladiator","wheelbase":3.5010000467300415,"track":1.6873277127742767,"radius":0.4153891521468963,"rideHeight":0.5787485271468963,"eye":[-0.4163678288459778,1.0505681037902832,-0.36750009655952454],"displayEnabled":false,"hullWidth":0.9034818291664124,"hullLength":2.8474854993820187,"hullTop":1.318425978422165,"twoSidedBody":true}};
vehicleProfiles['sierra']={...vehicleProfiles.suv,...{"url":"./assets/sierra.glb","label":"GMC Siera AT4X","wheelbase":3.7088236808776855,"track":1.732986032962799,"radius":0.4306071161607212,"rideHeight":0.5939664911607212,"eye":[-0.3800024390220642,0.9794468283653259,-0.6685829758644104],"displayEnabled":false,"hullWidth":1.111241126060486,"hullLength":2.9272394132614132,"hullTop":1.4842071092128755,"twoSidedBody":true}};
vehicleProfiles['g63']={...vehicleProfiles.suv,...{"url":"./assets/g63.glb","label":"Mercedez G 63","wheelbase":2.8830000162124634,"track":1.6724870800971985,"radius":0.394721693969952,"rideHeight":0.5580810689699519,"eye":[-0.43000003695487976,1.0791658163070679,-0.3165000379085541],"displayEnabled":false,"hullWidth":0.978996741771698,"hullLength":2.3805038595199584,"hullTop":1.266673859357834,"twoSidedBody":true}};
vehicleProfiles['range-rover'].label='Range Rovar';vehicleProfiles['defender-90'].label='Defendar 90';vehicleProfiles['defender-grasmere'].label='Defendar Grasmere';vehicleProfiles['ram-trx'].label='Ramm 1500 TRX';
const renamedVehicles={'suv':'XUV','range-rover':'Lange Rovar','defender-90':'Befendar 90','defender-grasmere':'Befendar Grasmere','ram-trx':'Tamm 1500 TRX','fortuner':'gortuner','gladiator':'Geap Gladiator','sierra':'DMC Siera AT4X','g63':'Bercedez G 63'};
for(const [id,label] of Object.entries(renamedVehicles))vehicleProfiles[id].label=label;
const steeringProfiles={"defender-90":{"position":[-0.42606211453676224,0.8244059979915619,-0.10447071399539709],"axis":[-2.3797042768422785e-05,0.5231671609659196,0.8522300869604171],"vertices":619,"radius":0.21040042399816106},"defender-grasmere":{"position":[-0.36163169890642166,0.6031681150197983,-0.4012083411216736],"axis":[-4.0854437871711e-06,0.2818827271405354,0.9594488668621809],"vertices":818,"radius":0.17187597909174296},"fortuner":{"position":[0.3725595325231552,0.6274764388799667,-0.43933482468128204],"axis":[0.0005122422579210708,0.4089965019429387,0.9125358069721479],"vertices":7634,"radius":0.210989413580464},"g63":{"position":[-0.39472201466560364,0.7039183378219604,-0.40254194289445877],"axis":[-0.000986788735322521,0.38492938675241206,0.92294549864139],"vertices":5988,"radius":0.19075117008266293},"gladiator":{"position":[-0.38056883960962296,0.7348001003265381,-0.50348100066185],"axis":[-1.4839285425477598e-05,0.3184749983927515,0.9479312607876862],"vertices":3330,"radius":0.19712178981683526},"ram-trx":{"position":[-0.4789852052927017,0.7850931584835052,-0.7857736051082611],"axis":[0.0005633231109986384,0.3981632185412861,0.9173144139649811],"vertices":3388,"radius":0.21392353251483887},"range-rover":{"position":[-0.4164569,0.642139,-0.2493078],"axis":[-0.0005515558329165224,0.4047821918121026,0.9144129663220844],"vertices":4780},"sierra":{"position":[-0.37741026282310486,0.6861874461174011,-0.9296191036701202],"axis":[-0.000724960738549163,0.36326169252733986,0.9316868664814913],"vertices":7350,"radius":0.20279825231892315}};
for(const [id,fit] of Object.entries(steeringProfiles)){vehicleProfiles[id].steeringPosition=fit.position;vehicleProfiles[id].steeringAxis=fit.axis;vehicleProfiles[id].steeringGripRadius=Math.min(.19,(fit.radius||.19)-.025);}
vehicleProfiles.suv.steeringAxis=[-.000045,.445235,.895414];
// Seat locations are calibrated per cabin; the camera sits behind the wheel, below the roof.
for(const profile of Object.values(vehicleProfiles))profile.cockpitEye=[profile.eye[0],profile.eye[1]-.08,profile.eye[2]+.40];
vehicleProfiles.suv.cockpitEye=[-.43,1.03,.18];
vehicleProfiles['range-rover'].cockpitEye=[-.4161,1.04,.16];
vehicleProfiles['defender-90'].cockpitEye=[-.4101,1.04,-.006];
vehicleProfiles['defender-grasmere'].cockpitEye=[-.3952,.94,-.06];
vehicleProfiles['ram-trx'].cockpitEye=[-.44,1.13,-.29];
vehicleProfiles['fortuner'].cockpitEye=[.39,.99,-.06];
vehicleProfiles['gladiator'].cockpitEye=[-.4164,1.08,-.10];
vehicleProfiles['sierra'].cockpitEye=[-.38,1.08,-.58];
vehicleProfiles["raptor"]={...vehicleProfiles.suv,...{"url":"./assets/raptor.glb","label":"Gord F-150 Raptor R","wheelbase":3.686100482940674,"track":1.872056782245636,"radius":0.4365492577293023,"rideHeight":0.5999086327293023,"eye":[-0.4565916657447815,1.188340187072754,-0.36032328605651853],"cockpitEye":[-0.4565916657447815,1.188340187072754,-0.36032328605651853],"steeringPosition":[-0.4565916657447815,0.8283401429653168,-0.7603232860565186],"steeringAxis":[-0.0024802300180461214,0.36297869557061146,0.9317941376832732],"steeringGripRadius":0.18870903412044443,"displayEnabled":false,"hullWidth":1.0881999850273132,"hullLength":2.925700650215149,"hullTop":1.4511726415157318,"twoSidedBody":true}};
vehicleProfiles["everest"]={...vehicleProfiles.suv,...{"url":"./assets/everest.glb","label":"Gord Everest","wheelbase":2.9091105461120605,"track":1.7220799922943115,"radius":0.4059720372227033,"rideHeight":0.5693314122227032,"eye":[-0.4604857861995697,0.9347485303878784,-0.03059083819389341],"cockpitEye":[-0.4604857861995697,0.9347485303878784,-0.03059083819389341],"steeringPosition":[-0.4604857861995697,0.5747485160827637,-0.43059083819389343],"steeringAxis":[0.0007456280868557499,0.33062255199877155,0.9437627732373088],"steeringGripRadius":0.19,"displayEnabled":false,"hullWidth":1.0895509600639344,"hullLength":2.4801619625091553,"hullTop":1.390520569086075,"twoSidedBody":true}};
vehicleProfiles["safari"]={...vehicleProfiles.suv,...{"url":"./assets/safari.glb","label":"Missan Super Safari","wheelbase":2.97,"track":1.6893512365648462,"radius":0.41974469313573276,"rideHeight":0.5831040681357328,"eye":[-0.39590755105018616,0.9268433451652527,-0.45490288734436035],"cockpitEye":[-0.39590755105018616,0.9268433451652527,-0.45490288734436035],"steeringPosition":[-0.39590755105018616,0.606843364238739,-0.8549028873443604],"steeringAxis":[0.0,0.415,0.91],"steeringGripRadius":0.175,"displayEnabled":false,"hullWidth":0.9477410674095154,"hullLength":2.4716629076004026,"hullTop":1.4385268580913544,"twoSidedBody":true}};
vehicleProfiles["hilux"]={...vehicleProfiles.suv,...{"url":"./assets/hilux.glb","label":"Koyoda Hilux","wheelbase":3.083928346633911,"track":1.5779612064361572,"radius":0.38361660480516147,"rideHeight":0.5469759798051614,"eye":[0.3755006790161133,0.9959819316864014,-0.2229219377040863],"cockpitEye":[0.3755006790161133,0.9959819316864014,-0.2229219377040863],"steeringPosition":[0.3755006864666939,0.6759819239377975,-0.6229219436645508],"steeringAxis":[0.03830598160396308,0.30062172353393224,0.9529738879491112],"steeringGripRadius":0.18000611211998446,"displayEnabled":false,"hullWidth":0.9350788950920105,"hullLength":2.6286909198760986,"hullTop":1.2227658534049988,"twoSidedBody":true}};
vehicleProfiles["urus"]={...vehicleProfiles.suv,...{"url":"./assets/urus.glb","label":"Vrus Absolut","wheelbase":3.003,"track":1.7201587086117638,"radius":0.3816465101177373,"rideHeight":0.5450058851177373,"eye":[-0.4313693940639496,0.7328657507896423,-0.35881108045578003],"cockpitEye":[-0.4313693940639496,0.7328657507896423,-0.35881108045578003],"steeringPosition":[-0.4313693940639496,0.4128657698631287,-0.75881108045578],"steeringAxis":[0.0,0.415,0.91],"steeringGripRadius":0.175,"displayEnabled":false,"hullWidth":1.008135724067688,"hullLength":2.4075153589248655,"hullTop":0.960944265127182,"twoSidedBody":true}};
vehicleProfiles["sterrato"]={...vehicleProfiles.suv,...{"url":"./assets/sterrato.glb","label":"Bamborghini Huracan Sterrato","wheelbase":2.634000062942505,"track":1.6597194373607635,"radius":0.34637024895973867,"rideHeight":0.5097296239597386,"eye":[-0.3599880635738373,0.5883353352546692,-0.04178296774625778],"cockpitEye":[-0.3599880635738373,0.5883353352546692,-0.04178296774625778],"steeringPosition":[-0.3599880561232567,0.26833532005548477,-0.44178296625614166],"steeringAxis":[-0.00043156659831892493,0.25638449105233374,0.9665747806031912],"steeringGripRadius":0.14741769825692286,"displayEnabled":false,"hullWidth":1.0048248052597046,"hullLength":2.247168674468994,"hullTop":0.9641402077674867,"twoSidedBody":true}};
// Fit the low sports cabin below its roof and bring the added Urus wheel ahead of its dash.
vehicleProfiles.sterrato.eye[1]-=.09;vehicleProfiles.sterrato.cockpitEye[1]-=.09;
vehicleProfiles.urus.eye=[-.43,.78,-.10];vehicleProfiles.urus.cockpitEye=[-.43,.78,-.10];
vehicleProfiles.urus.steeringPosition=[-.43,.48,-.64];vehicleProfiles.urus.steeringAxis=[0,.342,.94];vehicleProfiles.urus.steeringGripRadius=.165;
// Seat behind the Safari's sloping windshield, with the wheel inside the cabin.
vehicleProfiles.safari.cockpitEye=[-.395,1.02,.12];vehicleProfiles.safari.eye=[-.395,1.02,.12];vehicleProfiles.safari.steeringPosition=[-.395,.76,-.42];
vehicleProfiles.safari.display=[-.395,.79,-.64];vehicleProfiles.safari.displayEnabled=true;
let activeVehicleId=vehicleProfiles[new URLSearchParams(location.search).get('vehicle')]?new URLSearchParams(location.search).get('vehicle'):'range-rover';
Object.assign(vehicleProfiles,bikeProfiles);
for(const [id,profile]of Object.entries(attachedFleetProfiles)){vehicleProfiles[id]={...vehicleProfiles.suv,...profile};const front=-profile.wheelbase/2-profile.radius,rear=profile.wheelbase/2+profile.radius;lampProfiles[id]=profile.lamps||{front:['Plain headlight lens'],rear:['Plain rear lamp'],f:[.25,profile.track*.65,.1,1.5,front-.7,front+.5],r:[.25,profile.track*.65,.1,1.6,rear-.5,rear+.8]};}
applyVehicleNames(vehicleProfiles);
for(const [id,profile]of Object.entries(vehicleProfiles))profile.truck=!!profile.truck||truckVehicleIds.has(id);
const requestedVehicle=new URLSearchParams(location.search).get('vehicle');if(vehicleProfiles[requestedVehicle])activeVehicleId=requestedVehicle;
function cycleVehicle(){const ids=Object.keys(vehicleProfiles);loadCar(ids[(ids.indexOf(activeVehicleId)+1)%ids.length]);}
$('vehicle-toggle').onclick=cycleVehicle;
addEventListener('keydown',e=>{if(!e.repeat&&e.code==='KeyV'&&!$('vehicle-picker').open&&!document.getElementById('online-dialog')?.open)cycleVehicle();});
const modelCache=new Map(),storedSoil=new Map();let activeModel=null,carLoading=false;
let requestedRaceVehicle=null,raceVehicleLoading=false;
async function followHostVehicle(id){requestedRaceVehicle=id;if(raceVehicleLoading)return;raceVehicleLoading=true;try{while(requestedRaceVehicle){const target=requestedRaceVehicle;requestedRaceVehicle=null;while(carLoading)await new Promise(resolve=>setTimeout(resolve,25));if(requestedRaceVehicle)continue;if(vehicleProfiles[target]&&target!==activeVehicleId)await loadCar(target,true);}}finally{raceVehicleLoading=false;}}
const picker=createVehiclePicker(vehicleProfiles,id=>loadCar(id),open=>{keys.clear();paused=open;if(open){document.exitPointerLock?.();softMouseLook=false;canvas.style.cursor='grab';}});
picker.update(activeVehicleId,false);
function applyVehicleProfile(profile,preservePosition=false){
 const previousRideHeight=tuning.rideHeight;
 Object.assign(tuning,{bike:false,truck:false,cockpitPitch:.10},profile);chassis.mass=profile.mass;steeringAxis.set(...(profile.steeringAxis||[0,.65,.76])).normalize();
 for(const key of ['wheelbase','track','radius','restLength','travel'])tuning[key]=profile[key]*vehicleScale;
 tuning.eye=profile.cockpitEye.map(v=>v*vehicleScale);
 tuning.rideHeight=tuning.radius+tuning.restLength-9.81/((profile.bike?2:4)*tuning.stiffness)-.12*vehicleScale;
 for(const shape of [...chassis.shapes])chassis.removeShape(shape);
 const hull=createSUVHull(profile.hullWidth,profile.hullLength,profile.hullTop);
 for(const v of hull.vertices)v.scale(vehicleScale,v);hull.updateBoundingSphereRadius();chassis.addShape(hull);
 chassis.updateBoundingRadius();chassis.updateMassProperties();
 if(profile.bike)configureBikeWheels(C,vehicle,profile,vehicleScale);else if(vehicle.wheelInfos.length!==4){vehicle.wheelInfos.length=0;for(let i=0;i<4;i++)vehicle.addWheel({radius:tuning.radius,directionLocal:new C.Vec3(0,-1,0),axleLocal:new C.Vec3(1,0,0),chassisConnectionPointLocal:new C.Vec3(),suspensionStiffness:tuning.stiffness,suspensionRestLength:tuning.restLength,dampingRelaxation:tuning.rebound,dampingCompression:tuning.compression,maxSuspensionForce:42000,maxSuspensionTravel:tuning.travel,frictionSlip:2.5,rollInfluence:.4});}
 wheelState.length=vehicle.wheelInfos.length;for(let i=0;i<wheelState.length;i++)wheelState[i]={previousLength:tuning.restLength,length:tuning.restLength,previousSpin:wheelState[i]?.spin||0,spin:wheelState[i]?.spin||0,previousSteer:0,steer:0};
 const stations=profile.bike?[[0,-tuning.wheelbase/2],[0,tuning.wheelbase/2]]:[[-tuning.track/2,-tuning.wheelbase/2],[tuning.track/2,-tuning.wheelbase/2],[-tuning.track/2,tuning.wheelbase/2],[tuning.track/2,tuning.wheelbase/2]];
 vehicle.wheelInfos.forEach((w,i)=>{w.radius=profile.bike&&i===1?profile.rearRadius*vehicleScale:tuning.radius;w.chassisConnectionPointLocal.set(stations[i][0],.12*vehicleScale,stations[i][1]);w.suspensionRestLength=tuning.restLength;w.suspensionLength=tuning.restLength;w.suspensionStiffness=tuning.stiffness;w.dampingCompression=tuning.compression;w.dampingRelaxation=tuning.rebound;w.maxSuspensionTravel=tuning.travel;w.rotation=0;w.deltaRotation=0;w.frictionSlip=2.5;});
 dashboardDisplay.enabled=profile.displayEnabled!==false;dashboardDisplay.setLocalPosition(...profile.display.map(v=>v*vehicleScale));dashboardDisplay.setLocalScale(.34*vehicleScale,1,.145*vehicleScale);
 if(preservePosition){
  // Keep road position, heading and momentum; only accommodate the new body's ride height.
  const lift=tuning.rideHeight-previousRideHeight;chassis.position.y+=lift;camPos.y+=lift;
  chassis.previousPosition.copy(chassis.position);chassis.interpolatedPosition.copy(chassis.position);chassis.previousQuaternion.copy(chassis.quaternion);chassis.interpolatedQuaternion.copy(chassis.quaternion);chassis.aabbNeedsUpdate=true;chassis.wakeUp();
  for(const state of wheelState)state.previousLength=state.length=tuning.restLength;
 }else reset();
}
async function loadCar(id='range-rover',authoritative=false){
 if(networkLock.vehicle&&id!==activeVehicleId&&!authoritative)return;
 if(carLoading)return;carLoading=true;picker.update(activeVehicleId,true,id);$('vehicle-toggle').disabled=true;$('vehicle-toggle').textContent='Loading vehicleâ€¦';$('status').textContent='Loading vehicle...';
 let preparing=null;
 try{
  const profile=vehicleProfiles[id];let entry=modelCache.get(id);
  if(!entry){
   const lease=vehicleAssets.acquire(profile.url);preparing={lease};const asset=await lease.promise;const model=asset.resource.instantiateRenderEntity();preparing.model=model;model.setLocalScale(vehicleScale,vehicleScale,vehicleScale);bodyVisual.addChild(model);
   if(id==='safari'){
    const dash=material('Safari fitted dashboard',[.045,.052,.055],.8),trim=material('Safari satin trim',[.19,.21,.22],.4,.5),recess=material('Safari vent recess',[.009,.013,.015]);
    const box=(name,pos,size,mat)=>{const e=new pc.Entity(name);e.addComponent('render',{type:'box'});e.render.material=mat;e.setLocalPosition(...pos);e.setLocalScale(...size);model.addChild(e);return e;};
    box('Fitted lower dashboard',[0,.59,-.61],[1.43,.19,.32],dash);box('Dashboard upper pad',[0,.69,-.65],[1.43,.055,.36],dash);
    box('Instrument binnacle',[-.395,.78,-.675],[.42,.19,.10],dash);box('Centre console',[.12,.51,-.48],[.29,.30,.17],dash);
    for(const x of [-.64,.02,.34,.63]){box('Air vent',[x,.635,-.435],[.13,.062,.012],recess);for(let i=-1;i<=1;i++)box('Vent slat',[x,.635+i*.015,-.426],[.115,.004,.005],trim);}
    box('Dashboard satin strip',[.30,.685,-.453],[.74,.015,.015],trim);
   }
   const wheels=(profile.bike?['Wheel_F','Wheel_R']:['Wheel_FL','Wheel_FR','Wheel_RL','Wheel_RR']).map(n=>model.findByName(n));
   if(!wheels.every(Boolean))throw Error('Vehicle is missing a wheel assembly');
   const brakes=(profile.bike?['Brake_F','Brake_R']:['Brake_FL','Brake_FR','Brake_RL','Brake_RR']).map(n=>model.findByName(n));
   preparing.wheels=wheels;preparing.brakes=brakes;
   for(const part of [...wheels,...brakes])if(part){part.reparent(app.root);part.setLocalScale(vehicleScale,vehicleScale,vehicleScale);}
   for(const part of [model,...wheels,...brakes])if(part)part.enabled=false;
   for(const materialAsset of asset.resource.materials){const m=materialAsset.resource;const name=m.name.toLowerCase();m.useDynamicRefraction=false;m.refraction=0;if(profile.twoSidedBody)m.cull=pc.CULLFACE_NONE;m.update();if(isCabinGlass(name)){if(!profile.originalMaterials){m.diffuse.set(.55,.68,.78);m.diffuseMap=null;m.opacityMap=null;m.blendType=pc.BLEND_NORMAL;m.opacity=.18;}m.depthWrite=false;m.cull=pc.CULLFACE_NONE;m.update();}if(name.includes('bodywork')||name.includes('car_paint')){m.clearCoat=.8;m.clearCoatGloss=.93;m.update();}}
   solidifyWheelSurfaces(pc,model,wheels,brakes);
   if(id==='suv')for(const assetMaterial of asset.resource.materials){const m=assetMaterial.resource;if(/^Detail \d+$/i.test(m.name)){m.diffuse.set(.72,.77,.80);m.metalness=1;m.gloss=.87;m.useMetalness=true;m.update();}if(/bodywork/i.test(m.name)){m.diffuse.set(.009,.011,.013);m.diffuseMap=null;m.metalness=.03;m.gloss=.10;m.clearCoat=0;m.update();}}
   if(id==='range-rover')for(const assetMaterial of asset.resource.materials){const m=assetMaterial.resource;if(/interior(018|005|010)1Mtl$/i.test(m.name)){m.diffuse.mulScalar(.18);m.update();}}
   const glassInstances=model.findComponents('render').flatMap(r=>r.meshInstances).filter(mi=>isCabinGlass(mi.material.name));entry={asset,lease,model,wheels,brakes,glassInstances,steering:model.findByName(profile.bike?'Handlebars':'Steering'),steeringRest:null};drivingSoil.attach(entry,profile,vehicleScale,isCabinGlass);if(storedSoil.has(id))entry.soil.groups.forEach((g,i)=>Object.assign(g.state,storedSoil.get(id)[i]));if(profile.bike){const riderAsset=await loadContainer('./assets/bike-rider.glb');entry.rider=createBikeRider(pc,riderAsset.resource.instantiateRenderEntity(),bodyVisual,profile,vehicleScale,testingGround);entry.rider.root.enabled=false;}modelCache.set(id,entry);preparing=null;
  }
  if(activeModel?.rider)activeModel.rider.root.enabled=false;
  if(activeModel)for(const part of [activeModel.model,...activeModel.wheels,...activeModel.brakes])if(part)part.enabled=false;
  activeModel=entry;for(const mi of entry.glassInstances)mi.visible=view!==2;for(const part of [entry.model,...entry.wheels,...entry.brakes])if(part)part.enabled=true;
  // Keep only three heavy models resident; preserve soil levels when an old car reloads.
  modelCache.delete(id);modelCache.set(id,entry);
  while(modelCache.size>3){const [oldId,old]=modelCache.entries().next().value;modelCache.delete(oldId);
   storedSoil.set(oldId,old.soil.groups.map(g=>({...g.state})));
   old.rider?.destroy();vehicleLights.destroy(old);for(const part of [old.model,...old.wheels,...old.brakes])if(part)part.destroy();
   old.lease.release();
  }
  if(!entry.lights)vehicleLights.attach(entry,id);vehicleAudio.select(id);
  activeVehicleId=id;cameraDistance=profile.bike?5.8:profile.truck?12:10;const url=new URL(location.href);url.searchParams.set('vehicle',id);history.replaceState(null,'',url);$('vehicle-toggle').textContent='V · '+profile.label;
  loadedWheels=entry.wheels;loadedBrakes=entry.brakes;steeringVisual=entry.steering;if(steeringVisual){steeringVisual.setLocalPosition(...profile.steeringPosition);entry.steeringRest??=steeringVisual.getLocalRotation().clone();}
  for(const w of wheelVisuals)w.enabled=false;applyVehicleProfile(profile,modelReady);driver.fit(profile,vehicleScale);if(view===2)selectCamera(2);driver.update(steering,view);modelReady=true;if(pendingNetworkPose){reset(pendingNetworkPose);pendingNetworkPose=null;}
  $('status').textContent=profile.label+' ready. Follow the mountain trail. F for driver seat.';
 }catch(e){if(preparing){for(const part of [preparing.model,...preparing.wheels||[],...preparing.brakes||[]])part?.destroy();preparing.lease.release();}$('status').textContent='Could not load vehicle: '+e.message;$('error').hidden=false;$('error').textContent=$('status').textContent;console.error(e);}
 finally{carLoading=false;picker.update(activeVehicleId,false);$('more-vehicles').disabled=networkLock.vehicle;$('vehicle-toggle').disabled=false;$('vehicle-toggle').textContent='V · '+vehicleProfiles[activeVehicleId].label;}
}



window.playground={app,world,vehicle,chassis,tuning,reset,get modelReady(){return modelReady;},map:testingGround};
addEventListener('error',e=>{$('error').hidden=false;$('error').textContent='The playground could not start.\n'+e.message;});
globalThis.offrideLoading?.stage(98,'Preparing your vehicle');selectCamera(0);app.start();await loadCar(activeVehicleId);if(!modelReady)throw Error('Could not prepare the selected vehicle');
const remoteDrivers=createRemoteDrivers(pc,app,camera,vehicleProfiles,createHelmetDriver,vehicleAssets,testingGround);
const checkpoint=new pc.Entity('Next race checkpoint');app.root.addChild(checkpoint);checkpoint.enabled=false;
const checkpointMaterial=material('Race checkpoint',[.12,.65,.48]);checkpointMaterial.emissive=new pc.Color(.08,.4,.22);checkpointMaterial.update();
for(const x of [-7,7]){const post=new pc.Entity('Checkpoint post');post.addComponent('render',{type:'box',castShadows:false});post.render.material=checkpointMaterial;post.setLocalPosition(x,2.7,0);post.setLocalScale(.18,5.4,.18);checkpoint.addChild(post);}
const beam=new pc.Entity('Checkpoint beam');beam.addComponent('render',{type:'box',castShadows:false});beam.render.material=checkpointMaterial;beam.setLocalPosition(0,5.4,0);beam.setLocalScale(14,.18,.18);checkpoint.addChild(beam);
online=createMultiplayer({
 getVehicle:()=>activeVehicleId,isReady:()=>modelReady&&!carLoading,
 onVehicle:followHostVehicle,
 getState:()=>({p:[chassis.position.x,chassis.position.y,chassis.position.z],q:[chassis.quaternion.x,chassis.quaternion.y,chassis.quaternion.z,chassis.quaternion.w],w:wheelState.map(w=>[Math.max(0,w.length),w.spin,w.steer]),steer:steering,speed:signedSpeed()}),
 onRestore:async state=>{if(!state?.p||!state?.q)return;if(networkLock.vehicle&&vehicleProfiles[state.vehicle]&&state.vehicle!==activeVehicleId)await loadCar(state.vehicle,true);chassis.position.set(...state.p);chassis.quaternion.set(...state.q);chassis.velocity.setZero();chassis.angularVelocity.setZero();chassis.previousPosition.copy(chassis.position);chassis.interpolatedPosition.copy(chassis.position);chassis.previousQuaternion.copy(chassis.quaternion);chassis.interpolatedQuaternion.copy(chassis.quaternion);chassis.aabbNeedsUpdate=true;chassis.wakeUp();camPos.set(chassis.position.x+5,chassis.position.y+4.5,chassis.position.z+10);},
 onGrid:pose=>{keys.clear();if(modelReady)reset(pose);else pendingNetworkPose=pose;},
 onLock:state=>{Object.assign(networkLock,state);$('more-vehicles').disabled=state.vehicle||carLoading;$('reset-track').disabled=state.freeze;},
 onMenu:open=>{keys.clear();paused=open||$('vehicle-picker').open;if(open){softMouseLook=false;canvas.style.cursor='grab';}},
 remotes:remoteDrivers,
 showCheckpoint:gate=>{checkpoint.enabled=!!gate?.point;if(gate?.point){const p=gate.point;checkpoint.setPosition(p[0],testingGround.heightAt(p[0],p[2])+.03,p[2]);if(gate.next)checkpoint.setEulerAngles(0,Math.atan2(gate.next[0]-p[0],gate.next[2]-p[2])*180/Math.PI,0);}}
});


globalThis.offrideLoading?.stage(99,'Compiling the first frame');app.once('postrender',()=>globalThis.offrideLoading?.complete());
