import {createWeatherState,weatherPresets} from './weather-state.js';
// Dry day/night only; rain geometry and thunder timers are not allocated.
export function createWeather(pc,app,camera,sun,map){
 const state=createWeatherState(),current=structuredClone(weatherPresets.day),color=new pc.Color();
 function update(dt,{paused=false}={}){
  const {preset}=state.update(paused?0:dt),mix=1-Math.exp(-dt/2.6);
  for(const key of ['sky','ambient','sun'])for(let i=0;i<3;i++)current[key][i]+=(preset[key][i]-current[key][i])*mix;
  for(const key of ['power','reflection','fogStart','fogEnd'])current[key]+=(preset[key]-current[key])*mix;
  color.set(...current.sky);camera.camera.clearColor.copy(color);app.scene.fog.color.copy(color);
  app.scene.fog.start=Math.min(current.fogStart,map.viewDistance?.fogStart??Infinity);app.scene.fog.end=Math.min(current.fogEnd,map.viewDistance?.fogEnd??Infinity);
  app.scene.ambientLight.set(...current.ambient);sun.light.color.set(...current.sun);sun.light.intensity=current.power;app.scene.skyboxIntensity=current.reflection;
 }
 return {update,get rain(){return 0;}};
}
