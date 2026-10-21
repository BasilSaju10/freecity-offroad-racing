import {coreAssetFiles,requiredMapTextures} from './asset-plan.js';
import {createAssetPreloader} from './asset-preloader.js';
const $=id=>document.getElementById(id);let progress=0,downloadsReady=false,failed=false;
function show(value,message,detail=''){if(failed)return;progress=Math.max(progress,Math.min(100,value));$('loading-progress').setAttribute('aria-valuenow',String(Math.floor(progress)));$('loading-percent').textContent=Math.floor(progress)+'%';$('loading-car').style.left=`calc(${progress}% - ${progress*.92}px)`;$('loading-message').textContent=message;$('loading-detail').textContent=detail;}
window.offrideLoading={stage:(value,message)=>show(value,message),complete(){if(failed)return;if(!downloadsReady)throw Error('Required files have not finished loading');show(100,'Ready to drive','All required files ready');$('loading-screen').dataset.downloadsReady='true';$('loading-screen').hidden=true;},fail(error){failed=true;$('loading-message').textContent='Loading stopped: '+error.message;$('loading-detail').textContent='Completed downloads will be reused when you retry.';$('retry-loading').hidden=false;}};
window.addEventListener('error',event=>{if(!$('loading-screen').hidden)window.offrideLoading.fail(event.error||Error(event.message));});
window.addEventListener('unhandledrejection',event=>{if(!$('loading-screen').hidden)window.offrideLoading.fail(event.reason instanceof Error?event.reason:Error(String(event.reason)));});
$('retry-loading').onclick=()=>location.reload();
try{
 const response=await fetch('./asset-manifest.json',{cache:'no-store'});if(!response.ok)throw Error('Could not load the asset list');const manifest=await response.json();
 let cache=null;try{for(const name of await caches.keys())if(/^offride-assets-v[0-9]+$/.test(name)&&name!=='offride-assets-v2')await caches.delete(name);cache=await caches.open('offride-assets-v2');}catch{}
 if('serviceWorker' in navigator){try{await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>{navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true});setTimeout(resolve,5000);});}catch{}}
 // Without a controlling service worker, blob URLs provide the same downloaded data.
 if(!navigator.serviceWorker?.controller)cache=null;
 let phase=null,lastPaint=0;
 function paint({ready,received,stats}){
  if(!phase)return;const now=performance.now(),completed=ready.size-phase.readyStart;if(now-lastPaint<80&&completed<phase.files.length)return;lastPaint=now;
  const loaded=phase.files.reduce((sum,f)=>sum+(received.get(f.path)||0),0),total=phase.total;
  show(phase.from+(phase.to-phase.from)*(total?loaded/total:1),`${phase.name} ${completed}/${phase.files.length}`,`${(loaded/1e6).toFixed(1)} / ${(total/1e6).toFixed(1)} MB`);
  Object.assign($('loading-screen').dataset,{readyFiles:String(ready.size),cacheHits:String(stats.cacheHits),networkDownloads:String(stats.downloads)});
 }
 const store=createAssetPreloader({files:manifest.files,baseUrl:location.href,cache,onProgress:paint}),core=coreAssetFiles(manifest);let required=core,mapPromise;
 window.offrideAssets={url:store.url,stats:store.stats,prepareMap(device){return mapPromise??=(async()=>{
   const scene=await(await fetch(store.url('./assets/gamblers/scene.json'))).json(),textures=requiredMapTextures(manifest,scene,!!device.extTextureCompressionBPTC);
   required=[...core,...textures];await store.prune(required);phase={files:textures,readyStart:store.ready.size,total:textures.reduce((sum,f)=>sum+f.bytes,0),from:65,to:95,name:'Loading map textures'};$('loading-screen').dataset.requiredFiles=String(required.length);
   await store.download(textures,3);store.assertReady(required);downloadsReady=true;
   Object.assign($('loading-screen').dataset,{readyFiles:String(store.ready.size),requiredFiles:String(required.length),downloadsReady:'true',cacheHits:String(store.stats.cacheHits),networkDownloads:String(store.stats.downloads),textureFormat:device.extTextureCompressionBPTC?'original BC7':'PNG fallback'});
  })();},async whenReady(){if(!mapPromise)throw Error('Map assets were not prepared');await mapPromise;store.assertReady(required);}};
 await store.prune(manifest.files);phase={files:core,readyStart:0,total:core.reduce((sum,f)=>sum+f.bytes,0),from:0,to:65,name:'Loading garage and world'};await store.download(core,3);
 show(65,'Preparing compatible map textures','All vehicles and audio files downloaded');await import(store.url('./app.bundle.js'));
}catch(error){console.error(error);window.offrideLoading.fail(error);}
