import assert from 'node:assert/strict';
import {createWeatherState,weatherCycle,weatherPresets} from './weather-state.js';
import {createWeather} from './weather.js';
const state=createWeatherState();assert.deepEqual(weatherCycle.map(([name])=>name),['day','night']);
for(let i=0;i<10;i++){assert.equal(state.update(0).mode,i%2?'night':'day');assert.equal(state.update(80).mode,i%2?'day':'night');}
assert.equal(state.update(1600).mode,'day');assert.equal(state.update(-50).mode,'day');
for(const name of ['rain','storm','invalid']){state.select(name);assert.equal(state.update(0).mode,'day');}
assert(Object.values(weatherPresets).every(p=>p.rain===0));assert(weatherPresets.night.power<weatherPresets.day.power*.2);
class Color{set(){}copy(){}}
const app={scene:{ambientLight:new Color(),fog:{color:new Color()}}},camera={camera:{clearColor:new Color()}},sun={light:{color:new Color()}};
const weather=createWeather({Color},app,camera,sun,{viewDistance:{fogStart:90,fogEnd:145}});
for(let i=0;i<480;i++){weather.update(1);assert.equal(weather.rain,0);assert(app.scene.fog.end<=145);}
console.log('Passed: repeated day/night cycle, no rain/storm modes or rain geometry, and distance fog preserved.');
