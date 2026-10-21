export const weatherPresets={
 day:{label:'Day',sky:[.52,.72,.91],ambient:[.28,.31,.36],sun:[1,.96,.89],power:1.7,reflection:1,fogStart:165,fogEnd:240,rain:0},
 night:{label:'Night',sky:[.018,.026,.047],ambient:[.07,.085,.13],sun:[.48,.61,1],power:.18,reflection:.13,fogStart:100,fogEnd:215,rain:0}
};
export const weatherCycle=[['day',80],['night',80]];
export function createWeatherState(){
 let selection='auto',index=0,elapsed=0;
 return{select(value){if(value!=='auto'&&!weatherPresets[value])return;selection=value;elapsed=0;if(value==='auto')index=0;},
 update(dt){if(selection==='auto'){elapsed+=Math.max(0,dt);while(elapsed>=weatherCycle[index][1]){elapsed-=weatherCycle[index][1];index=(index+1)%weatherCycle.length;}}const mode=selection==='auto'?weatherCycle[index][0]:selection;return{mode,automatic:selection==='auto',preset:weatherPresets[mode]};}};
}
