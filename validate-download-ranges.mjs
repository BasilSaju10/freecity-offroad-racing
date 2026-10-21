import assert from 'node:assert/strict';
import {createAssetPreloader} from './asset-preloader.js';
const bytes=new Uint8Array(9*1024*1024+19).fill(73),file={path:'vehicle.glb',url:'./vehicle.glb?v=test',bytes:bytes.length};
const calls=[];let interrupted=false;
const loader=createAssetPreloader({files:[file],baseUrl:'https://example.test/',fetcher:async(url,options)=>{
 const range=options.headers.Range;calls.push(range);const [,start,end]=/bytes=(\d+)-(\d+)/.exec(range).map(Number);
 if(start===4*1024*1024&&!interrupted){interrupted=true;throw new TypeError('Failed to fetch');}
 return new Response(bytes.slice(start,end+1),{status:206,headers:{'Content-Range':`bytes ${start}-${end}/${bytes.length}`}});
}});
await loader.download([file]);loader.assertReady([file]);
assert.deepEqual(new Uint8Array(await(await fetch(loader.url(file.path))).arrayBuffer()),bytes);
assert.equal(calls.length,4);assert.equal(calls[1],calls[2]);assert.notEqual(calls[0],calls[2]);
console.log('Large asset bytes preserved; interrupted segment retried without restarting earlier segments.');
