import {bikeProfiles} from './bike-profiles.js';
import {engineLoopConfig} from './engine-loop-config.js';
import {createDriveSoundSequence} from './drive-sound-sequence.js';
import {createWaterEntryBuffer} from './water-entry-audio.js';
export const vehicleSoundFiles={acceleration:'./assets/audio/acceleration-loop.wav',braking:'./assets/audio/braking.mp3',headlights:'./assets/audio/headlight-switch.mp3',shift:'./assets/audio/drive-brake-switch.mp3',motorcycle:'./assets/audio/motorcycle-acceleration.wav',electricMotorcycle:'./assets/audio/electric-bike-acceleration.wav'};
export function drivingAudioState({speed=0,throttle=0,brake=false,burnout=false,grounded=false,paused=false}){
 const velocity=Math.abs(speed),gear=Math.min(5,Math.floor(velocity/8));
 return {rpm:Math.max(780,Math.min(6200,900+(velocity-gear*8)*390+Math.abs(throttle)*(burnout?3600:1200))),load:Math.abs(throttle),scrub:grounded&&brake?Math.min(1,Math.max(0,(velocity-1)/11)):0,active:!paused,mode:brake&&!burnout?'braking':throttle!==0?'accelerating':'coasting'};
}
export function driveModeTransition(previous,current){return (previous===1&&current===-1)||(previous===-1&&current===1);}
export function createVehicleAudio(){
 let bike=false,electric=false;
 let context,master,loading,enabled=true,lastHit=-10,lastWater=-10,lastDirection=null,active=true,acceleration=null,braking=null;
 const buffers={},voices=new Set(),sequence=createDriveSoundSequence(),button=document.getElementById('sound-toggle');
 function noise(seconds){const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*seconds),context.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;return buffer;}
 function play(name,{loop=false,volume=1,rate=1}={}){if(!context||!buffers[name]||!enabled||document.hidden||context.state!=='running')return null;
  const source=context.createBufferSource(),gain=context.createGain(),time=context.currentTime;source.buffer=buffers[name];source.loop=loop;source.playbackRate.value=rate;
  // The recording is preprocessed into a phase-aligned, level, crossfaded sustain.
  // Keep one voice alive throughout the throttle hold; never restart the rev clip per frame.
  if(loop&&name==='acceleration'){source.loopStart=engineLoopConfig.loopStart;source.loopEnd=engineLoopConfig.loopEnd;}
  // Soften the engine recording without dulling the brake, shift or switch sounds.
  const filter=['acceleration','motorcycle','electricMotorcycle'].includes(name)?context.createBiquadFilter():null;
  if(filter){filter.type='lowpass';filter.frequency.value=1800;filter.Q.value=.5;source.connect(filter).connect(gain);}else source.connect(gain);
  gain.gain.setValueAtTime(loop?0:volume,time);if(loop)gain.gain.linearRampToValueAtTime(volume,time+(filter?.12:.06));gain.connect(master);source.start();
  const voice={source,gain,filter,stopped:false};voices.add(voice);source.onended=()=>{voices.delete(voice);source.disconnect();filter?.disconnect();gain.disconnect();};return voice;
 }
 function stop(voice){if(!voice||voice.stopped)return;voice.stopped=true;const time=context.currentTime;voice.gain.gain.cancelScheduledValues(time);voice.gain.gain.setTargetAtTime(0,time,.025);voice.source.stop(time+.14);}
 function stopDriving(){stop(acceleration);stop(braking);acceleration=braking=null;}
 async function load(){await Promise.all(Object.entries(vehicleSoundFiles).filter(([name])=>!buffers[name]).map(async([name,path])=>{const response=await fetch(globalThis.offrideAssets?.url(path)||path);if(!response.ok)throw Error('Could not load '+name+' sound');buffers[name]=await context.decodeAudioData(await response.arrayBuffer());}));}
 function ensureContext(){if(context)return true;const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return false;context=new Audio();master=context.createGain();const limiter=context.createDynamicsCompressor();master.gain.value=.65;master.connect(limiter).connect(context.destination);return true;}
 async function prepare(){if(!ensureContext())return;loading??=load();try{await loading;button.dataset.audioReady='true';button.dataset.audioClips=String(Object.keys(buffers).length);}catch(error){loading=null;throw error;}}
 async function unlock(){if(!enabled)return;try{const prepared=prepare();if(context)await context.resume();await prepared;button.title='Toggle vehicle sound (M)';}catch(error){button.title='Audio could not start. Click Sound to retry.';button.dataset.audioReady='false';console.warn(error);}}
 function updateButton(){button.setAttribute('aria-pressed',String(enabled));button.textContent=enabled?'Sound on':'Sound off';button.title='Toggle vehicle sound (M)';}
 function toggle(){enabled=!enabled;updateButton();if(enabled)unlock();else{stopDriving();lastDirection=null;for(const voice of voices)stop(voice);if(master)master.gain.setTargetAtTime(0,context.currentTime,.025);}}
 button.onclick=toggle;updateButton();
 addEventListener('pointerdown',unlock,{passive:true});addEventListener('keydown',event=>{if(event.code==='KeyM'&&!event.repeat&&!/INPUT|TEXTAREA/.test(event.target.tagName))toggle();else unlock();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){stopDriving();lastDirection=null;context?.suspend();}});
 return {prepare,select(id){stopDriving();lastDirection=null;sequence.reset();bike=!!bikeProfiles[id];electric=!!bikeProfiles[id]?.electric;},
 direction(){/* Pedal edges do not change gear before the vehicle stops. */},
 headlights(){if(!enabled||document.hidden)return;unlock().then(()=>{if(active)play('headlights',{volume:.8});});},
 waterEntry(strength=.3,speed=0){if(!enabled||!active||!context||document.hidden||context.state!=='running'||context.currentTime-lastWater<.65)return;lastWater=context.currentTime;const source=context.createBufferSource(),gain=context.createGain();source.buffer=createWaterEntryBuffer(context);gain.gain.value=.16+Math.min(1,Math.max(0,strength)+Math.abs(speed)/80)*.38;source.connect(gain).connect(master);const voice={source,gain,stopped:false};voices.add(voice);source.start();source.onended=()=>{voices.delete(voice);source.disconnect();gain.disconnect();};},
 thunder(){if(!enabled||!active||!context||document.hidden||context.state!=='running')return;const source=context.createBufferSource(),gain=context.createGain(),filter=context.createBiquadFilter(),time=context.currentTime+.8;source.buffer=noise(3.2);filter.type='lowpass';filter.frequency.value=220;filter.Q.value=.5;gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(.34,time+.12);gain.gain.exponentialRampToValueAtTime(.0001,time+3.1);source.connect(filter).connect(gain).connect(master);const voice={source,gain,stopped:false};voices.add(voice);source.start(time);source.stop(time+3.2);source.onended=()=>{voices.delete(voice);source.disconnect();filter.disconnect();gain.disconnect();};},
 update(input,dt){const state=drivingAudioState(input);active=state.active;if(!context)return;const time=context.currentTime,audible=enabled&&active&&!document.hidden;master.gain.setTargetAtTime(audible ? .65 : 0,time,.04);
  if(!audible){stopDriving();lastDirection=null;sequence.reset();return;}
  if(!buffers.acceleration||!buffers.braking||!buffers.shift)return;
  if(bike&&(input.speed<-.05||input.throttle<0&&input.speed<=.3)){stopDriving();return;}
  const phase=bike?{mode:input.brake?'braking':input.throttle>0?'accelerating':'coasting'}:sequence.update(input,dt);if(!bike&&phase.shift)play('shift',{volume:.85});
  if(phase.mode==='accelerating'){acceleration??=play(bike?(electric?'electricMotorcycle':'motorcycle'):'acceleration',{loop:true,volume:bike?.22:.3,rate:.84});if(acceleration){const rev=Math.min(1,Math.abs(input.speed)/45+(input.burnout?.25:0));acceleration.source.playbackRate.setTargetAtTime(bike?.85+Math.min(1,Math.abs(input.speed)/25)*.75:.84+rev*.16,time,.3);acceleration.gain.gain.setTargetAtTime(bike?.16+state.load*.07:.25+state.load*.1,time,.12);acceleration.filter.frequency.setTargetAtTime(1800+rev*700,time,.25);}}else{stop(acceleration);acceleration=null;}
  const scrub=phase.mode==='braking'&&input.grounded&&Math.abs(input.speed)>.12?Math.min(1,.08+Math.abs(input.speed)/11):0;
  if(scrub>0){braking??=play('braking',{loop:true,volume:.65});braking?.gain.gain.setTargetAtTime(Math.min(.85,.25+scrub*.6),time,.05);}else{stop(braking);braking=null;}
 },
 impact(strength){if(!enabled||!active||!context||context.state!=='running'||document.hidden||strength<1.8)return;const time=context.currentTime;if(time-lastHit<.14)return;lastHit=time;const volume=Math.min(.58,(strength-1.3)*.035),source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();source.buffer=noise(.35);filter.type='lowpass';filter.frequency.value=600+Math.min(strength,15)*100;gain.gain.setValueAtTime(volume,time);gain.gain.exponentialRampToValueAtTime(.0001,time+.3);source.connect(filter).connect(gain).connect(master);source.start();source.stop(time+.35);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
  const thump=context.createOscillator(),envelope=context.createGain();thump.frequency.setValueAtTime(110,time);thump.frequency.exponentialRampToValueAtTime(35,time+.18);envelope.gain.setValueAtTime(volume*.65,time);envelope.gain.exponentialRampToValueAtTime(.0001,time+.22);thump.connect(envelope).connect(master);thump.start();thump.stop(time+.23);thump.onended=()=>{thump.disconnect();envelope.disconnect();};}
 };
}
