import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {vehicleIds} from './multiplayer-server.mjs';
const manifest=JSON.parse(readFileSync('asset-manifest.json'));
assert.equal(vehicleIds.length,27);assert(vehicleIds.includes('africa-twin')&&vehicleIds.includes('stark-varg'));
assert(!manifest.files.some(f=>/gamblers/.test(f.path)));
for(const path of ['assets/map/freecity.glb','assets/map/heights.bin','assets/map/physics.json','server.mjs','render.yaml','weather-state.js'])execFileSync('git',['diff','--exit-code','origin/main','--',path]);
const source=readFileSync('main.js','utf8');assert(source.includes('loadFreeCity(pc,C,app,world)'));assert(!/loadGamblers|lowRange/.test(source));
const files=[{path:'app.bundle.js',url:'./app.bundle.js?v=test',bytes:4},{path:'assets/vehicle.glb',url:'./assets/vehicle.glb?v=test',bytes:5*1024*1024}];
const dom=new Map(),document={getElementById(id){if(!dom.has(id))dom.set(id,{style:{},hidden:false,setAttribute(){}});return dom.get(id);}};
const window={addEventListener(){}},cache={async match(){},async put(url,response){await response.arrayBuffer();throw new TypeError('Failed to fetch');}},caches={async open(){return cache;},async keys(){return[];}};
let requests=0,ready=false;
const fetcher=async url=>{if(url==='./asset-manifest.json')return Response.json({files});requests++;return new Response(new Uint8Array(url.includes('app.bundle')?4:files[1].bytes).fill(71));};
const boot=readFileSync('boot.js','utf8').replace("await import(window.offrideAssets.url('./app.bundle.js'))",'await onReady(window.offrideAssets)');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
await new AsyncFunction('window','document','location','caches','fetch','navigator','performance','onReady',boot)(window,document,{href:'https://example.test/'},caches,fetcher,{},performance,async assets=>{
 for(const file of files){const url=assets.url('./'+file.path);assert(url.startsWith('blob:'));const bytes=new Uint8Array(await(await fetch(url)).arrayBuffer());assert.equal(bytes.length,file.bytes);assert(bytes.every(n=>n===71));}
 ready=true;
});
assert(ready);assert.equal(requests,2,'a failed cache write keeps the completed download');
console.log('Passed: original map and automatic weather cycle retained, 27 multiplayer vehicles, no BeamNG files, cache-failure recovery preserves complete files.');
