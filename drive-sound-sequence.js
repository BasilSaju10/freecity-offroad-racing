// Gear changes follow the vehicle stopping, rather than the pedal/key edge.
export function createDriveSoundSequence(){
 let gear=0,hold=0;
 return {reset(){gear=0;hold=0;},update({speed=0,throttle=0,brake=false,burnout=false,paused=false},dt){
  if(paused){gear=0;hold=0;return{mode:'coasting',shift:false};}
  const demand=Math.sign(throttle),moving=Math.abs(speed)>.12,opposing=demand&&speed*demand<-.12;
  if(!gear)gear=moving?Math.sign(speed):demand;
  const reversal=demand&&gear&&demand!==gear;
  if(reversal&&opposing){hold=0;return{mode:'braking',shift:false};}
  // The supplied shift recording's main clunk is at about 0.5 seconds.
  if(reversal){gear=demand;hold=.55;return{mode:'shifting',shift:true};}
  if(hold>0){hold=Math.max(0,hold-dt);return{mode:'shifting',shift:false};}
  if(opposing)return{mode:'braking',shift:false};
  return{mode:brake&&!burnout?'braking':demand?'accelerating':'coasting',shift:false};
 }};
}
