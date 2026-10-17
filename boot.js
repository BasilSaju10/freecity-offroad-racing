const $=id=>document.getElementById(id);let progress=0;
function show(value,message,detail=''){progress=Math.max(progress,Math.min(100,value));$('loading-progress').setAttribute('aria-valuenow',String(Math.floor(progress)));$('loading-percent').textContent=Math.floor(progress)+'%';$('loading-car').style.left=`calc(${progress}% - ${progress*.92}px)`;$('loading-message').textContent=message;$('loading-detail').textContent=detail;}
window.offrideLoading={stage:(value,message)=>show(value,message),complete(){show(100,'Ready to drive','All vehicles ready');$('loading-screen').hidden=true;},fail(error){$('loading-message').textContent='Loading stopped: '+error.message;$('loading-detail').textContent='Your completed downloads are saved.';$('retry-loading').hidden=false;}};
window.addEventListener('error',event=>{if(!$('loading-screen').hidden)window.offrideLoading.fail(event.error||Error(event.message));});
window.addEventListener('unhandledrejection',event=>{if(!$('loading-screen').hidden)window.offrideLoading.fail(event.reason instanceof Error?event.reason:Error(String(event.reason)));});
$('retry-loading').onclick=()=>location.reload();
try{
 const manifest=await(await fetch('./asset-manifest.json',{cache:'no-store'})).json();window.offrideAssets={url:path=>manifest.files.find(f=>f.path===path.replace(/^\.\//,''))?.url||path};
 let cache=null;try{cache=await caches.open('offride-assets-v2');}catch{}
 if('serviceWorker' in navigator){await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>{navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true});setTimeout(resolve,5000);});}
 const total=manifest.files.reduce((n,f)=>n+f.bytes,0),received=new Map();let completed=0,cursor=0,lastPaint=0;
 const report=(f,n)=>{received.set(f.path,Math.min(n,f.bytes));const now=performance.now();if(now-lastPaint<80&&n<f.bytes)return;lastPaint=now;const loaded=[...received.values()].reduce((a,b)=>a+b,0);show(loaded/total*95,`Loading garage and world · ${completed}/${manifest.files.length} files`,`${(loaded/1e6).toFixed(1)} / ${(total/1e6).toFixed(1)} MB`);};
 async function download(f){const url=new URL(f.url,location.href).href,cached=cache&&await cache.match(url);if(cached&&Number(cached.headers.get('X-Offride-Bytes'))===f.bytes){completed++;report(f,f.bytes);return;}
  let failure;for(let attempt=0;attempt<3;attempt++)try{const response=await fetch(url);if(!response.ok)throw Error(`${f.path}: HTTP ${response.status}`);const reader=response.body.getReader(),parts=[];let count=0;while(true){const {value,done}=await reader.read();if(done)break;parts.push(value);count+=value.byteLength;report(f,count);}if(count!==f.bytes)throw Error('Incomplete download: '+f.path);if(cache){const headers=new Headers(response.headers);headers.delete('Content-Encoding');headers.set('Content-Length',String(count));headers.set('X-Offride-Bytes',String(count));await cache.put(url,new Response(new Blob(parts),{headers}));}completed++;report(f,count);return;}catch(e){failure=e;}throw failure;
 }
 async function worker(){while(cursor<manifest.files.length){const file=manifest.files[cursor++];await download(file);}}
 await Promise.all(Array.from({length:3},worker));show(95,'Starting the engine','All 15 vehicle files downloaded');await import(window.offrideAssets.url('./app.bundle.js'));
 if(cache){const names=await caches.keys();for(const name of names)if(name.startsWith('offride-')&&name!=='offride-assets-v2')await caches.delete(name);}
}catch(error){console.error(error);window.offrideLoading.fail(error);}
