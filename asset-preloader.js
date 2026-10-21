import {assetPath} from './asset-plan.js';

export function createAssetPreloader({files,baseUrl,cache=null,fetcher=fetch,onProgress=()=>{}}){
 const byPath=new Map(files.map(f=>[f.path,f])),ready=new Set(),pending=new Map(),memory=new Map(),received=new Map();
 const stats={downloads:0,cacheHits:0,memoryFiles:0,networkBytes:0};let writable=!!cache,streamWrites=true;
 const absolute=file=>new URL(file.url,baseUrl).href;
 const networkUrl=file=>{const url=new URL(absolute(file));url.searchParams.set('offride-download','1');return url.href;};
 async function request(file){
  const size=4*1024*1024;
  if(file.bytes<=size)return fetcher(networkUrl(file),{cache:'no-store'});
  // Static hosting supports byte ranges. Retry a short segment instead of
  // restarting a 50 MB vehicle when a connection drops near the end.
  async function segment(start){
   const end=Math.min(file.bytes-1,start+size-1);let error;
   for(let attempt=0;attempt<4;attempt++)try{
    const response=await fetcher(networkUrl(file),{cache:'no-store',headers:{Range:`bytes=${start}-${end}`}});
    if(start===0&&response.status===200)return {response};
    if(response.status!==206||response.headers.get('Content-Range')!==`bytes ${start}-${end}/${file.bytes}`)throw Error('Invalid partial download');
    const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length!==end-start+1)throw Error('Incomplete download segment');
    return {bytes,headers:response.headers};
   }catch(cause){console.warn('OFFRIDE download segment',file.path,start,cause.stack||String(cause));error=cause;if(attempt<3)await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));}
   throw error;
  }
  const first=await segment(0);if(first.response)return first.response;
  let offset=0;const headers=new Headers(first.headers);headers.delete('Content-Range');headers.delete('Content-Encoding');headers.set('Content-Length',String(file.bytes));
  return new Response(new ReadableStream({async pull(controller){try{
   const part=offset===0?first:await segment(offset);controller.enqueue(part.bytes);offset+=part.bytes.length;
   if(offset===file.bytes)controller.close();
  }catch(error){controller.error(error);}}}),{headers});
 }
 function progress(file,bytes){received.set(file.path,bytes);onProgress({file,bytes,ready,received,stats});}
 async function transfer(file){
  const cached=cache&&await cache.match(absolute(file));
  if(cached&&Number(cached.headers.get('X-Offride-Bytes'))===file.bytes){stats.cacheHits++;ready.add(file.path);progress(file,file.bytes);return;}
  if(cached)await cache.delete(absolute(file));
  let lastError;
  for(let attempt=0;attempt<3;attempt++){
   let count=0;
   try{
    // Cache Storage is the durable copy; avoid duplicating large files in the
    // browser's separate HTTP disk cache as well.
    const response=await request(file);if(!response.ok)throw Error(`${file.path}: HTTP ${response.status}`);
    const headers=new Headers(response.headers);headers.delete('Content-Encoding');headers.set('Content-Length',String(file.bytes));headers.set('X-Offride-Bytes',String(file.bytes));
    const stream=response.body.pipeThrough(new TransformStream({transform(chunk,controller){count+=chunk.byteLength;stats.networkBytes+=chunk.byteLength;if(count>file.bytes)throw Error('Unexpected download size: '+file.path);progress(file,count);controller.enqueue(chunk);}}));
    const stored=new Response(stream,{headers});let blob;
    if(writable){
     if(streamWrites){
      // Some embedded browsers reject streaming Cache.put responses. A clone
      // preserves the completed bytes for a buffered write without fetching twice.
      const backup=stored.clone();
      try{await cache.put(absolute(file),stored);await backup.body.cancel();}
      catch(error){
       blob=await backup.blob();await stored.body.cancel().catch(()=>{});
       if(blob.size!==file.bytes)throw Error('Incomplete download: '+file.path);
       streamWrites=false;
       if(/quota|storage|disk|security/i.test(error.name+' '+error.message)){writable=false;memory.set(file.path,{blob});}
       else{try{await cache.put(absolute(file),new Response(blob,{headers}));}catch{writable=false;memory.set(file.path,{blob});}}
      }
     }else{
      blob=await stored.blob();if(blob.size!==file.bytes)throw Error('Incomplete download: '+file.path);
      try{await cache.put(absolute(file),new Response(blob,{headers}));}catch{writable=false;memory.set(file.path,{blob});}
     }
    }else{
     blob=await stored.blob();memory.set(file.path,{blob});
    }
    stats.memoryFiles=memory.size;
    if(count!==file.bytes){await cache?.delete(absolute(file));memory.delete(file.path);throw Error('Incomplete download: '+file.path);}
    stats.downloads++;ready.add(file.path);progress(file,file.bytes);return;
   }catch(error){console.warn('OFFRIDE download transfer',file.path,error.stack||String(error));lastError=Error(file.path+': '+error.message,{cause:error});progress(file,0);}
  }
  throw lastError||Error('Could not store download: '+file.path);
 }
 function ensure(file){if(ready.has(file.path))return Promise.resolve();if(!pending.has(file.path)){const task=transfer(file).catch(error=>{pending.delete(file.path);throw error;});pending.set(file.path,task);}return pending.get(file.path);}
 async function download(group,concurrency=3){let cursor=0,stopped=false;async function worker(){while(!stopped&&cursor<group.length)try{await ensure(group[cursor++]);}catch(error){stopped=true;throw error;}}await Promise.all(Array.from({length:Math.min(concurrency,group.length)},worker));}
 function url(path){const key=assetPath(path),file=byPath.get(key),entry=memory.get(key);if(entry){entry.url??=URL.createObjectURL(entry.blob);return entry.url;}return file?absolute(file):path;}
 function assertReady(required){const missing=required.filter(f=>!ready.has(f.path));if(missing.length)throw Error('Required downloads are not ready: '+missing.map(f=>f.path).join(', '));}
 async function prune(required){if(!cache)return;const keep=new Set(required.map(absolute));for(const request of await cache.keys())if(!keep.has(request.url))await cache.delete(request);}
 return {download,url,assertReady,prune,ready,received,stats};
}
