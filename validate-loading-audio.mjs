import assert from 'node:assert/strict';
import {createVehicleAudio,vehicleSoundFiles} from './vehicle-sampled-audio.js';
const events=new Map(),pending=[];let fetches=0,resumes=0,decodes=0;
const node=()=>({gain:{value:0},connect(next){return next;}});
class Audio{
 state='suspended';destination=node();
 createGain(){return node();}createDynamicsCompressor(){return node();}
 decodeAudioData(){decodes++;return new Promise(resolve=>pending.push(resolve));}
 resume(){resumes++;this.state='running';return Promise.resolve();}
}
const button={dataset:{},setAttribute(){}};
globalThis.window={AudioContext:Audio};globalThis.document={hidden:false,getElementById:()=>button,addEventListener:(name,fn)=>events.set(name,fn)};globalThis.addEventListener=(name,fn)=>events.set(name,fn);globalThis.fetch=async()=>{fetches++;return new Response(new Uint8Array(4));};
const audio=createVehicleAudio();let ready=false;const preparing=audio.prepare().then(()=>ready=true);
for(let i=0;i<8;i++)await Promise.resolve();
assert.equal(fetches,Object.keys(vehicleSoundFiles).length);assert.equal(decodes,6);assert.equal(ready,false,'loading waits for audio decoding');assert.equal(resumes,0,'preparing audio does not bypass autoplay');
for(const resolve of pending)resolve({duration:4});await preparing;assert.equal(button.dataset.audioReady,'true');assert.equal(button.dataset.audioClips,'6');
await events.get('pointerdown')();assert.equal(resumes,1);assert.equal(fetches,6,'driving input does not download sounds');assert.equal(decodes,6,'driving input does not decode sounds again');
console.log('Passed: all six sounds decoded during loading, no autoplay, and no audio downloads/decoding on first input.');
