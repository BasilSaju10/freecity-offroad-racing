import emissive from './vendor/playcanvas/scene/shader-lib/glsl/chunks/standard/frag/emissive.js';
// Mesh material names and lamp extents measured from each imported GLB, in chassis metres.
// Regions use absolute X, so both existing left/right lamps glow without added geometry.
export const lampProfiles={
 suv:{front:['Clear automotive glass.001','Detail 14'],rear:['Rear lamp'],f:[.56,.98,.36,.60,-2.26,-1.79],r:[.37,.93,.60,.77,2.15,2.55]},
 'range-rover':{front:['frontlights','Meshesrowersportglass1Mtl'],rear:['rearlights','Meshesrowersportglass0011Mtl'],f:[.45,.91,.17,.42,-2.18,-1.87],r:[.69,.91,.23,.51,2.22,2.49]},
 'defender-90':{front:['Headlights'],rear:['Taillights'],f:[.45,.85,.26,.52,-1.76,-1.48],r:[.47,.85,.20,.33,1.65,1.90]},
 'defender-grasmere':{front:['mascara negra 2','Cromados','Vidro - Lanterna'],rear:['Vidro -  Freio'],f:[.45,.82,.12,.49,-2.02,-1.85],r:[.49,.74,.04,.62,2.0,2.11]},
 'ram-trx':{front:['LightA'],rear:['RED_GLASS','LightA'],f:[.55,1.01,.25,.78,-2.7,-2.26],r:[.79,.97,.37,.78,2.72,2.99]},
 fortuner:{front:['emit .001','glass .001'],rear:['emit red.001','glass .001'],f:[.47,.85,.39,.62,-2.20,-1.53],r:[.31,.88,.52,.71,1.77,2.35]},
 gladiator:{front:['LightEmissiveA','LightA'],rear:['RED_GLASS','LightEmissiveA','LightA'],f:[.38,.84,.25,.58,-2.41,-2.01],r:[.59,.87,.05,.64,2.79,2.99]},
 sierra:{front:['emiss','chrome'],rear:['emiss','red_glass','Chrome_Line','Chrome_SQ'],f:[.67,.91,.27,.65,-2.59,-2.43],r:[.80,.98,.31,.78,2.69,2.94]},
 g63:{front:['LightA'],rear:['red_glass','LightA'],f:[.52,.83,.27,.58,-2.15,-1.92],r:[.56,.91,.11,.45,1.74,2.21]},
 raptor:{front:['Light','Light_glass'],rear:['Light','Light_glass'],f:[.52,1.01,.31,.81,-2.69,-2.28],r:[.81,1.09,.21,.76,2.33,3.01]},
 everest:{front:['glass.001'],rear:['boot_ok.4'],f:[.48,.93,.20,.55,-2.28,-1.87],r:[.53,.95,.45,.69,2.05,2.51]},
 safari:{front:['Material.007','Material.008'],rear:['Taillights','Material.008'],f:[.50,.89,.15,.40,-2.19,-1.92],r:[.72,.94,.12,.61,2.26,2.46]},
 hilux:{front:['right front light','hilux_headlight','glass.001'],rear:['right rear light','left rear light','glass.002'],f:[.49,.86,.44,.55,-2.35,-2.10],r:[.68,.90,.25,.66,2.43,2.74]},
 urus:{front:['Light ','Material.006','Material.004'],rear:['Light RED'],f:[.46,.94,.21,.40,-2.38,-1.82],r:[.40,.88,.41,.54,2.04,2.37]},
 sterrato:{front:['LightA'],rear:['RED_GLASS','LightA'],f:[.46,.83,-.10,.19,-2.12,-1.73],r:[.39,.97,.23,.42,1.66,2.02]}
};
const header=`uniform mat4 uLampInverse; uniform vec4 uLampPower;
uniform vec3 uLampFrontMin; uniform vec3 uLampFrontMax; uniform vec3 uLampRearMin; uniform vec3 uLampRearMax;
float lampRegion(vec3 p,vec3 lo,vec3 hi){vec3 a=step(lo,p)*step(p,hi);return a.x*a.y*a.z;}
`;
const shader=header+emissive.replace('void getEmission()','void getOriginalEmission()')+`
void getEmission(){getOriginalEmission();vec3 p=(uLampInverse*vec4(vPositionW,1.0)).xyz;p.x=abs(p.x);
float front=lampRegion(p,uLampFrontMin,uLampFrontMax)*uLampPower.z;
float rear=lampRegion(p,uLampRearMin,uLampRearMax)*uLampPower.w;
dEmission+=vec3(.88,.95,1.0)*front*uLampPower.x+vec3(1.0,.012,.004)*rear*uLampPower.y;}
`;
export function createVehicleLights(pc){
 const patched=new WeakSet();
 function bounds(a){return [new Float32Array([a[0],a[2],a[4]]),new Float32Array([a[1],a[3],a[5]])];}
 return {attach(entry,id){const profile=lampProfiles[id],inverse=new pc.Mat4(),lamps=[];if(!profile)throw Error('No lamp profile for '+id);const [fmin,fmax]=bounds(profile.f),[rmin,rmax]=bounds(profile.r);
  for(const render of entry.model.findComponents('render'))for(const mi of render.meshInstances){const m=mi.material,name=m.name,front=profile.front.some(s=>name.includes(s)),rear=profile.rear.some(s=>name.includes(s));if(!front&&!rear)continue;
   // Clone per mesh: other vehicles using the same source material keep their own state.
   const lit=m.clone();lit.name=m.name+' · working lamps';mi.material=lit;lit.emissive.set(0,0,0);lit.getShaderChunks(pc.SHADERLANGUAGE_GLSL).set('emissivePS',shader);lit.shaderChunksVersion='2.24';lit.setParameter('uLampInverse',inverse.data);lit.setParameter('uLampPower',new Float32Array([0,0,Number(front),Number(rear)]));lit.setParameter('uLampFrontMin',fmin);lit.setParameter('uLampFrontMax',fmax);lit.setParameter('uLampRearMin',rmin);lit.setParameter('uLampRearMax',rmax);lit.update();lamps.push({mi,material:lit,power:new Float32Array([0,0,Number(front),Number(rear)])});
  }entry.lights={inverse,lamps};return lamps.length;
 },update(entry,headlights,braking){if(!entry?.lights)return;const {inverse,lamps}=entry.lights;inverse.copy(entry.model.getWorldTransform()).invert();for(const lamp of lamps){lamp.power[0]=headlights?5.5:0;lamp.power[1]=braking?6:headlights?.65:0;lamp.mi.setParameter('uLampInverse',inverse.data);lamp.mi.setParameter('uLampPower',lamp.power);}},destroy(entry){for(const lamp of entry.lights?.lamps||[])lamp.material.destroy();}};
}
