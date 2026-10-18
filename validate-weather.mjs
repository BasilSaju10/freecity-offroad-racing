import assert from 'node:assert/strict';
import {createWeatherState,weatherCycle,weatherPresets} from './weather-state.js';
const s=createWeatherState();assert.equal(s.update(0).mode,'day');
for(let round=0;round<3;round++)for(let i=0;i<weatherCycle.length;i++){assert.equal(s.update(0).mode,weatherCycle[i][0]);const end=s.update(weatherCycle[i][1]);assert(end.automatic);assert.equal(end.mode,weatherCycle[(i+1)%weatherCycle.length][0]);}
s.select('night');assert.equal(s.update(600).mode,'night');assert.equal(s.update(0).automatic,false);s.select('rain');assert.equal(s.update(1000).mode,'rain');assert.equal(s.update(0).preset.rain,.65);s.select('invalid');assert.equal(s.update(0).mode,'rain');s.select('auto');assert.equal(s.update(0).mode,'day');assert.equal(s.update(80+70).mode,'storm');assert.equal(s.update(-50).mode,'storm');
for(const k of ['rain','storm']){const sky=weatherPresets[k].sky;assert(Math.max(...sky)-Math.min(...sky)<.07,'Rain sky is grey');assert(Math.max(...sky)<.3,'Rain sky is dark');}
assert(weatherPresets.night.power<weatherPresets.day.power*.2);
console.log('Passed: automatic repeat cycle, long/manual holds, resume auto, invalid selection, grey rainy skies and night lighting.');
