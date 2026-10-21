// Local garage entries and remote drivers must retain the same container together.
// Unloading a container destroys the meshes/materials of every instance using it.
export function createVehicleAssets(pc,app){
 const entries=new Map();
 function dispose(entry){
  if(entry.users||entry.loading)return;
  if(entries.get(entry.url)===entry)entries.delete(entry.url);
  app.assets.remove(entry.asset);entry.asset.unload();
 }
 return{acquire(path){
  const url=globalThis.offrideAssets?.url(path)||path;
  let entry=entries.get(url);
  if(!entry){
   const asset=new pc.Asset('Shared vehicle '+path,'container',{url,filename:path});
   entry={url,asset,users:0,loading:true};entries.set(url,entry);app.assets.add(asset);
   entry.promise=new Promise((resolve,reject)=>{
    const loaded=()=>{asset.off('error',failed);entry.loading=false;resolve(asset);dispose(entry);};
    const failed=error=>{asset.off('load',loaded);entry.loading=false;if(entries.get(url)===entry)entries.delete(url);reject(error instanceof Error?error:Error(String(error)));dispose(entry);};
    asset.once('load',loaded);asset.once('error',failed);
   });
   // Start only after acquiring the first reference, including synchronous loaders.
   entry.users++;app.assets.load(asset);
  }else entry.users++;
  let released=false;
  return{promise:entry.promise,release(){if(released)return;released=true;entry.users--;dispose(entry);}};
 }};
}
