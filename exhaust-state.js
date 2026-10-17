const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));

// Rendering-independent engine load response. No changes to driving physics.
export function createExhaustState(){
 let previousDemand=0,tipIn=0,load=0,grade=0;
 function reset(){previousDemand=tipIn=load=grade=0;}
 function update({throttle,signedSpeed,roadGrade,bodyGrade=0},dt){
  const powering=Math.abs(signedSpeed)<.7||throttle*signedSpeed>=0;
  const demand=powering?Math.abs(throttle):0;
  tipIn=Math.max(tipIn,Math.max(0,demand-previousDemand));previousDemand=demand;
  const direction=Math.abs(throttle)>.01?Math.sign(throttle):Math.sign(signedSpeed)||1;
  grade+=(clamp((roadGrade*.75+bodyGrade*.25)*direction,0,.5)-grade)*(1-Math.exp(-dt*5));
  const climbing=demand*clamp(grade/.18),launch=demand*(1-clamp(Math.abs(signedSpeed)/9));
  const target=clamp(demand*.25+tipIn*.62+climbing*.65+launch*.10);
  load+=(target-load)*(1-Math.exp(-dt*12));tipIn*=Math.exp(-dt/ .65);
  return {load,climbing,burst:tipIn,rate:3+demand*4+load*17,opacity:.045+load*.31,
   shade:.015+.66*(1-load)**2,size:.045+load*.045,life:1.05+load*.65,jet:.55+load*1.9};
 }
 return {update,reset};
}
