import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {posix} from 'node:path';
import {createAssetPreloader} from './asset-preloader.js';
import {coreAssetFiles,requiredMapTextures} from './asset-plan.js';
import {vehicleSoundFiles} from './vehicle-sampled-audio.js';

const manifest=JSON.parse(readFileSync('asset-manifest.json')),scene=JSON.parse(readFileSync('assets/gamblers/scene.json')),core=coreAssetFiles(manifest);
const native=requiredMapTextures(manifest,scene,true),fallback=requiredMapTextures(manifest,scene,false);
for(const path of Object.values(vehicleSoundFiles))assert(core.some(f=>f.path===path.slice(2)),'audio downloads before driving');
assert.equal(core.filter(f=>f.path.endsWith('.glb')&&!f.path.includes('/gamblers/')&&!/hands-on-wheel|bike-rider/.test(f.path)).length,27);
assert(!core.some(f=>f.path.includes('/textures/')));
for(const [png,entry]of Object.entries(scene.nativeTextures)){
 assert(native.some(f=>f.path==='assets/gamblers/'+entry.url));assert(!native.some(f=>f.path==='assets/gamblers/'+png));assert(fallback.some(f=>f.path==='assets/gamblers/'+png));
}
for(const model of Object.values(scene.models)){
 const name='assets/gamblers/'+model.url,bytes=readFileSync(name),gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
 assert(core.some(f=>f.path===name));
 for(const image of gltf.images||[]){if(!image.uri)continue;const path=posix.normalize(posix.join(posix.dirname(name),image.uri)),png=path.slice('assets/gamblers/'.length),chosen=scene.nativeTextures[png]?.url;assert(fallback.some(f=>f.path===path));assert(native.some(f=>f.path===(chosen?'assets/gamblers/'+chosen:path)),'every model image is covered');}
}

function memoryCache(){const entries=new Map();return {entries,async match(url){return entries.get(url)?.clone();},async put(url,response){const bytes=await response.arrayBuffer();entries.set(url,new Response(bytes,{headers:response.headers}));},async delete(url){return entries.delete(typeof url==='string'?url:url.url);},async keys(){return [...entries.keys()].map(url=>({url}));}};}
const files=[{path:'a.bin',url:'./a.bin?v=1',bytes:4},{path:'b.bin',url:'./b.bin?v=2',bytes:6}],baseUrl='http://localhost/',cache=memoryCache();let fetches=0;
const fetcher=async url=>{fetches++;return new Response(new Uint8Array(url.includes('a.bin')?4:6));};
const first=createAssetPreloader({files,baseUrl,cache,fetcher});assert.throws(()=>first.assertReady(files),/not ready/);
await Promise.all([first.download(files),first.download(files)]);first.assertReady(files);assert.equal(fetches,2,'parallel requests share each download');
const second=createAssetPreloader({files,baseUrl,cache,fetcher:()=>{throw Error('warm load requested network');}});await second.download(files);second.assertReady(files);assert.equal(second.stats.cacheHits,2,'completed downloads survive reload');
const invalid=memoryCache();await invalid.put('http://localhost/a.bin?v=1',new Response(new Uint8Array(2),{headers:{'X-Offride-Bytes':'2'}}));
const recover=createAssetPreloader({files:[files[0]],baseUrl,cache:invalid,fetcher:async url=>{assert(!invalid.entries.has(url),'invalid service-worker response was removed before retry');return fetcher(url);}});await recover.download([files[0]]);recover.assertReady([files[0]]);
const compatible=memoryCache(),put=compatible.put;let writes=0,compatibleFetches=0;compatible.put=async(url,response)=>{if(++writes===1)throw new DOMException('Streaming cache unsupported','NetworkError');return put(url,response);};
const compatibility=createAssetPreloader({files,baseUrl,cache:compatible,fetcher:async url=>{compatibleFetches++;return fetcher(url);}});await compatibility.download(files,1);compatibility.assertReady(files);assert.equal(compatibleFetches,2,'buffered fallback reuses the downloaded bytes');assert.equal(compatible.entries.size,2);
await cache.put('http://localhost/stale.bin',new Response('old'));await second.prune(files);assert(!cache.entries.has('http://localhost/stale.bin'));assert.equal(cache.entries.size,2);

let quotaCalls=0;const quota=memoryCache();quota.put=async()=>{quotaCalls++;throw new DOMException('Storage quota exceeded','QuotaExceededError');};
const memory=createAssetPreloader({files,baseUrl,cache:quota,fetcher});await memory.download(files,1);memory.assertReady(files);assert.equal(quotaCalls,1,'storage failures do not repeat for every file');assert(memory.url('a.bin').startsWith('blob:'));assert.equal((await(await fetch(memory.url('b.bin'))).arrayBuffer()).byteLength,6);
const brokenCache=memoryCache(),broken=createAssetPreloader({files:[files[0]],baseUrl,cache:brokenCache,fetcher:async()=>new Response(new Uint8Array(2))});
await assert.rejects(broken.download([files[0]]),/Incomplete/);assert.throws(()=>broken.assertReady([files[0]]),/not ready/);assert.equal(brokenCache.entries.size,0,'partial downloads never become cache hits');
const report={passed:true,vehicles:27,audioClips:Object.keys(vehicleSoundFiles).length,coreFiles:core.length,nativeTextureFiles:native.length,fallbackTextureFiles:fallback.length,nativeRequiredMB:+([...core,...native].reduce((n,f)=>n+f.bytes,0)/1e6).toFixed(1),fallbackRequiredMB:+([...core,...fallback].reduce((n,f)=>n+f.bytes,0)/1e6).toFixed(1),allModelImagesCovered:true,warmCacheNoDownloads:true,deduplicatedRequests:true,quotaFallback:true,partialDownloadsRejected:true};
writeFileSync('loading-validation.json',JSON.stringify(report,null,2));console.log(report);
