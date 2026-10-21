// Keep the upload's BC7 blocks and mipmaps intact. BC4/BC5 data retains its
// original R/RG channels instead of expanding every image to four GPU channels.
export function gutterTextures(pc,app,scene,url){
 const cache=new Map(),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
 async function load(p){
  const native=scene.nativeTextures[p];
  if(native&&app.graphicsDevice.extTextureCompressionBPTC){
   const response=await fetch(url(native.url));if(!response.ok)throw Error('Texture failed: '+native.url);const data=await response.arrayBuffer(),levels=[];let offset=148;
   for(let i=0;i<native.mips;i++){const w=Math.max(1,native.width>>i),h=Math.max(1,native.height>>i),size=Math.ceil(w/4)*Math.ceil(h/4)*16;levels.push(new Uint8Array(data,offset,size));offset+=size;}
   const resource=new pc.Texture(app.graphicsDevice,{name:p,width:native.width,height:native.height,format:pc.PIXELFORMAT_BC7,levels,mipmaps:levels.length>1,addressU:pc.ADDRESS_REPEAT,addressV:pc.ADDRESS_REPEAT,anisotropy:4});resource.upload();
   const asset=new pc.Asset(p,'texture');asset.resource=resource;asset.loaded=true;app.assets.add(asset);return asset;
  }
  const asset=await new Promise((resolve,reject)=>app.assets.loadFromUrl(url(p),'texture',(e,a)=>e?reject(Error(String(e))):resolve(a)));
  const channelFormat=scene.textureFormats[p];
  if(channelFormat){
   const old=asset.resource,image=old.getSource(),count=channelFormat==='BC4U'?1:2;canvas.width=image.width;canvas.height=image.height;ctx.drawImage(image,0,0);const rgba=ctx.getImageData(0,0,canvas.width,canvas.height).data,pixels=new Uint8Array(image.width*image.height*count);
   for(let i=0,j=0;i<rgba.length;i+=4){pixels[j++]=rgba[i];if(count===2)pixels[j++]=rgba[i+1];}
   asset.resource=new pc.Texture(app.graphicsDevice,{name:p,width:image.width,height:image.height,format:count===1?pc.PIXELFORMAT_R8:pc.PIXELFORMAT_RG8,levels:[pixels],mipmaps:true,addressU:pc.ADDRESS_REPEAT,addressV:pc.ADDRESS_REPEAT,anisotropy:4});asset.resource.upload();old.destroy();canvas.width=canvas.height=1;
  }
  asset.resource.addressU=pc.ADDRESS_REPEAT;asset.resource.addressV=pc.ADDRESS_REPEAT;asset.resource.anisotropy=4;return asset;
 }
 function textureAsset(p){if(!cache.has(p))cache.set(p,load(p));return cache.get(p);}
 return {textureAsset,texture:p=>p?textureAsset(p).then(a=>a.resource):Promise.resolve(null)};
}

// Original BC5 normal images contain X/Y only; restore Z for the browser shader.
export const gutterNormalRG=`
uniform float material_bumpiness;
#ifdef STD_NORMALDETAIL_TEXTURE
uniform float material_normalDetailMapBumpiness;
#endif
vec3 gutterNormal(vec2 rg){vec2 xy=rg*2.-1.;return vec3(xy,sqrt(max(.001,1.-dot(xy,xy))));}
void getNormal(){
 vec3 n=gutterNormal(texture2DBias({STD_NORMAL_TEXTURE_NAME},{STD_NORMAL_TEXTURE_UV},{STD_TEXTURE_BIAS}).rg);
 n=mix(vec3(0.,0.,1.),n,material_bumpiness);
 #ifdef STD_NORMALDETAIL_TEXTURE
 vec3 detail=gutterNormal(texture2DBias({STD_NORMALDETAIL_TEXTURE_NAME},{STD_NORMALDETAIL_TEXTURE_UV},{STD_TEXTURE_BIAS}).rg);
 n=normalize(vec3(n.xy+detail.xy*material_normalDetailMapBumpiness,n.z*detail.z));
 #endif
 dNormalW=normalize(dTBN*n);
}`;
