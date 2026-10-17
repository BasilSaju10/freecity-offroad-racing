import {advanceSoil} from './soil-state.js';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const clean=()=>({dust:0,mud:0,wet:0});
const a=clean(),b=clean();for(let i=0;i<600;i++)advanceSoil(a,'MUD',5/60,1/60);for(let i=0;i<300;i++)advanceSoil(b,'MUD',5/30,1/30);assert(Math.abs(a.mud-b.mud)<1e-10,'mud pickup independent of FPS');assert(a.mud>.9,'mud builds while driving');
const mud=a.mud;advanceSoil(a,'MUD',0,10);assert.equal(a.mud,mud,'mud sticks when stationary');
advanceSoil(a,'WATER CROSSING',15,3);assert(a.mud<mud*.15,'water rinses off stuck mud');assert.equal(a.wet,1);
const dry=clean();advanceSoil(dry,'DIRT TRAIL',40,8);assert(dry.dust>.3&&dry.mud===0,'dirt produces a dry dust layer');
const report={passed:true,frameRateIndependent:true,staysAttachedWhenStopped:true,waterWashesMud:true,dirtAndMudDistinct:true};console.log(report);writeFileSync(new URL('./soil-validation.json',import.meta.url),JSON.stringify(report,null,2));
