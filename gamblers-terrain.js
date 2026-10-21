// Original terrain images at their supplied resolution, shared across spatial chunks.
// Texture arrays avoid exceeding the GPU sampler limit while retaining all four layers.
export async function createGutterTerrainMaterial(pc,app,world,url,texture){
 const imageCache=new Map();
 function image(path){if(!imageCache.has(path))imageCache.set(path,new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('Terrain texture failed: '+path));im.src=url(path);}));return imageCache.get(path);}
 const uniforms={};
 for(const frequency of ['Detail','Macro'])for(const channel of ['baseColor','normal','roughness','ao','height']){
  const field=channel+frequency+'Tex',paths=[...new Set(world.ground.map(g=>g.maps[field]).filter(Boolean))];
  const images=await Promise.all(paths.map(image)),first=images[0];
  if(!first||images.some(im=>im.width!==first.width||im.height!==first.height))throw Error('Incompatible source terrain texture dimensions: '+field);
  const t=new pc.Texture(app.graphicsDevice,{name:'Gutter '+field,width:first.width,height:first.height,arrayLength:images.length,format:pc.PIXELFORMAT_RGBA8,levels:[images],mipmaps:true,addressU:pc.ADDRESS_REPEAT,addressV:pc.ADDRESS_REPEAT,anisotropy:4});t.upload();
  uniforms[field]={texture:t,indices:world.ground.map(g=>paths.indexOf(g.maps[field]))};
 }
 const f=v=>Number(v).toFixed(8),component=['r','g','b','a'];
 const shared=`
 #ifndef GUTTER_SURFACE
 #define GUTTER_SURFACE
 uniform sampler2D uTerrainBase;
 ${Object.keys(uniforms).map(k=>`uniform highp sampler2DArray u_${k};`).join('\n')}
 vec4 gutterWeights(){vec4 w=max(vVertexColor,vec4(0.));return w/max(dot(w,vec4(1.)),.001);}
 vec2 gutterRelief(vec2 uv,float slice,float size,float macroSlice,float macroSize){
   float fade=1.-smoothstep(12.,35.,length(view_position-vPositionW));
   float h=texture(u_heightDetailTex,vec3(uv/size,slice)).r-.5;
   h+=(texture(u_heightMacroTex,vec3(uv/macroSize,macroSlice)).r-.5)*.2;
   return uv+clamp((view_position.xz-vPositionW.xz)/max(abs(view_position.y-vPositionW.y),1.),vec2(-2.),vec2(2.))*vec2(1.,-1.)*h*.025*fade;
 }
 #endif
 `;
 const sample=(channel,frequency,i,uv)=>`texture(u_${channel}${frequency}Tex,vec3(${uv}/${f(world.ground[i].settings[channel+frequency+'TexSize']??(frequency==='Detail'?4:200))},${f(uniforms[channel+frequency+'Tex'].indices[i])}))`;
 const strength=(channel,frequency,i)=>f(world.ground[i].settings[channel+frequency+'Strength']?.[0]??1);
 const uv=i=>`gutterRelief(vUv0,${f(uniforms.heightDetailTex.indices[i])},${f(world.ground[i].settings.heightDetailTexSize??4)},${f(uniforms.heightMacroTex.indices[i])},${f(world.ground[i].settings.heightMacroTexSize??200)})`;
 const m=new pc.StandardMaterial();m.name='Gambler original layered terrain';m.useMetalness=true;m.metalness=0;m.diffuseMap=await texture(world.ground[0].maps.baseColorBaseTex);m.normalMap=uniforms.normalDetailTex.texture;m.aoMap=uniforms.aoDetailTex.texture;m.diffuseVertexColor=true;m.gloss=.2;
 const chunks=m.getShaderChunks(pc.SHADERLANGUAGE_GLSL);
 chunks.set('diffusePS',shared+`void getAlbedo(){vec4 w=gutterWeights();vec3 base=texture2D(uTerrainBase,vUv0/512.).rgb;vec3 result=vec3(0.);
 ${world.ground.map((g,i)=>`if(w.${component[i]}>.001){vec2 p=${uv(i)};vec3 detail=${sample('baseColor','Detail',i,'p')}.rgb;vec3 macro=${sample('baseColor','Macro',i,'vUv0')}.rgb;result+=w.${component[i]}*clamp(base+(detail-.5)*${strength('baseColor','Detail',i)}+(macro-.5)*${strength('baseColor','Macro',i)},vec3(.005),vec3(1.));}`).join('\n')}
 dAlbedo=pow(result,vec3(2.2));}`);
 chunks.set('normalMapPS',shared+`void getNormal(){vec4 w=gutterWeights();vec3 result=vec3(0.);
 ${world.ground.map((g,i)=>`if(w.${component[i]}>.001){vec2 p=${uv(i)};vec3 detail=${sample('normal','Detail',i,'p')}.xyz*2.-1.;vec3 macro=${sample('normal','Macro',i,'vUv0')}.xyz*2.-1.;vec3 n=normalize(vec3(detail.xy*${strength('normal','Detail',i)}+macro.xy*${strength('normal','Macro',i)},max(.1,detail.z*macro.z)));result+=w.${component[i]}*n;}`).join('\n')}
 dNormalW=normalize(dTBN*normalize(result));}`);
 chunks.set('glossPS',shared+`void getGlossiness(){vec4 w=gutterWeights();float rough=0.;
 ${world.ground.map((g,i)=>`if(w.${component[i]}>.001){float r=${sample('roughness','Detail',i,'vUv0')}.r;float macro=${sample('roughness','Macro',i,'vUv0')}.r;rough+=w.${component[i]}*clamp(mix(1.,r,${strength('roughness','Detail',i)})+(macro-.5)*${strength('roughness','Macro',i)},.06,1.);}`).join('\n')}
 dGlossiness=1.-rough+.0000001;}`);
 chunks.set('aoPS',shared+`void getAO(){vec4 w=gutterWeights();dAo=0.;
 ${world.ground.map((g,i)=>`if(w.${component[i]}>.001){float a=${sample('ao','Detail',i,'vUv0')}.r;float b=${sample('ao','Macro',i,'vUv0')}.r;dAo+=w.${component[i]}*mix(1.,a,${strength('ao','Detail',i)})*mix(1.,b,${strength('ao','Macro',i)});}`).join('\n')}
 }`);
 m.shaderChunksVersion='2.24';for(const [k,v]of Object.entries(uniforms))m.setParameter('u_'+k,v.texture);m.setParameter('uTerrainBase',m.diffuseMap);m.update();
 return m;
}
