import {attachedFleetProfiles} from './attached-fleet-profiles.js';
// Vehicle-local coordinates; windshield planes measured from the supplied GLBs.
export const addedWiperProfiles={
 'trail-hauler':{y:1.161,z:-2.297,slope:.286,length:.49,pivots:[-.77,.04]},
 'desert-patrol':{y:.597,z:-.346,slope:.304,length:.44,pivots:[-.65,.03]},
 'rock-buggy':{y:.736,z:-.461,slope:1.42,length:.25,pivots:[-.26]},
 'trail-scout':{y:.662,z:-.806,slope:.547,length:.42,pivots:[-.65,.03]},
 'gortuner-classic':{y:.708,z:-1.009,slope:1.123,length:.40,pivots:[-.67,.03]},
 'summit-coupe':{y:.677,z:-.905,slope:1.044,length:.43,pivots:[-.75,.03]},
 'rock-ranger':{y:.778,z:-.593,slope:.362,length:.44,pivots:[-.67,.03]},
 'expedition-hauler':{y:1.654,z:-1.921,slope:.09,length:.60,pivots:[-.89,.04]},
 'obsidian-4x4':{y:.728,z:-.769,slope:.422,length:.55,pivots:[-.75,.03]},
 'trail-mini':{y:.465,z:-.441,slope:.43,length:.40,pivots:[-.55,.025]}
};
export const addedExhaustOutlets=Object.fromEntries(Object.entries(attachedFleetProfiles).map(([id,p])=>[id,[{
 position:[-p.hullWidth*.62,-.16,p.hullLength+.10],direction:[0,0,1],radius:p.truck?.045:.032
}]]));
// This model has side-exit pipes beneath the running boards.
addedExhaustOutlets['obsidian-4x4']=[-1,1].map(side=>({position:[side*1.012,-.23,.80],direction:[side,0,0],radius:.034}));
