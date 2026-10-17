import {constrainCameraToTerrain,exteriorPitchLimits} from './camera-terrain.js';
import {Vec3} from './vendor/playcanvas/core/math/vec3.js';
import {Quat} from './vendor/playcanvas/core/math/quat.js';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
process.chdir(fileURLToPath(new URL('.',import.meta.url)));
const source=readFileSync('main.js','utf8'),update=source.slice(source.indexOf('function updateCamera('),source.indexOf('let physicsAccumulator='));
const create=new Function('pc','constrainCameraToTerrain','exteriorPitchLimits','heightAt',`let view=0,cameraYaw=0,cameraPitch=-1,cameraDistance=10;const p=new pc.Vec3(0,1,0),bodyVisual={getPosition:()=>p},quat=new pc.Quat(),camPos=new pc.Vec3(0,-4,10),offset=new pc.Vec3(),target=new pc.Vec3(),cameraForward=new pc.Vec3(),cameraAnchor=new pc.Vec3(),headQuat=new pc.Quat(),lookQuat=new pc.Quat(),tuning={eye:[-.4,1,0]},testingGround={heightAt};const camera={setPosition(){},lookAt(){},setRotation(){}};${update};return{camPos,quat,p,cameraAnchor,set(mode,yaw,pitch,distance){view=mode;cameraYaw=yaw;cameraPitch=pitch;cameraDistance=distance;},updateCamera};`);
const fields=[()=>0,(x,z)=>.4*x+.2*z,(x,z)=>5*Math.exp(-((z-5)**2+x*x)/3)];let cases=0;
for(const heightAt of fields)for(const mode of [0,1])for(const tilt of [-70,0,70,150])for(const yaw of [-3,-1,0,1,3])for(const distance of [4,10,22]){
 const r=create({Vec3,Quat},constrainCameraToTerrain,exteriorPitchLimits,heightAt);r.quat.setFromEulerAngles(tilt,35,tilt/2);r.p.y=heightAt(0,0)+.7;r.set(mode,yaw,-.8,distance);
 for(let i=0;i<30;i++){
  r.updateCamera(1/60);assert(r.camPos.y>=heightAt(r.camPos.x,r.camPos.z)+.649,'camera remains above terrain during smoothing');
  for(let n=0;n<=30;n++){const t=n/30,x=r.cameraAnchor.x+(r.camPos.x-r.cameraAnchor.x)*t,z=r.cameraAnchor.z+(r.camPos.z-r.cameraAnchor.z)*t,y=r.cameraAnchor.y+(r.camPos.y-r.cameraAnchor.y)*t;assert(y>=heightAt(x,z)+.63,'camera boom stops before hills');}
 }
 cases++;
}
const interior=create({Vec3,Quat},constrainCameraToTerrain,exteriorPitchLimits,()=>{throw Error('cockpit should not be terrain-clamped');});interior.set(2,0,.1,10);interior.updateCamera(1/60);assert(interior.camPos.distance(new Vec3(-.4,2,0))<1e-8);
const report={passed:true,cases,minimumExteriorAngleDegrees:+(exteriorPitchLimits.min*180/Math.PI).toFixed(1),terrainClearanceMeters:.65,slopesAndRoll:true,hillObstruction:true,cockpitUnchanged:true};writeFileSync('camera-validation.json',JSON.stringify(report,null,2));console.log(report);
