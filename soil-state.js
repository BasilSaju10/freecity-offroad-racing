// Distance-based pickup keeps accumulation independent of rendering frame rate.
export function advanceSoil(state,surface,distance,dt){
 state.wet*=Math.exp(-dt*.045);
 if(distance<=0)return state;
 if(surface==='WATER CROSSING'){
  state.mud*=Math.exp(-distance*.15);state.dust*=Math.exp(-distance*.3);state.wet=1;
 }else if(surface==='MUD'){
  state.mud=1-(1-state.mud)*Math.exp(-distance*.055);state.wet=Math.min(1,state.wet+distance*.025);
 }else{
  state.dust=1-(1-state.dust)*Math.exp(-distance*(surface==='DIRT TRAIL'?.012:.004));
 }
 return state;
}
