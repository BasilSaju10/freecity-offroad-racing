import {build} from 'esbuild';
import {readFile,writeFile,mkdir,stat,readdir,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {posix} from 'node:path';
await build({entryPoints:['main.js'],outfile:'app.bundle.js',bundle:true,format:'esm',target:'es2022',minify:true,legalComments:'none',alias:{fflate:'./vendor/fflate.js'}});
const names=['app.bundle.js',...['vehicle','range-rover','defender-90','defender-grasmere','ram-trx','fortuner','gladiator','sierra','g63','raptor','everest','safari','hilux','urus','sterrato'].map(n=>'assets/'+n+'.glb')];
names.push('assets/audio/acceleration-loop.wav','assets/audio/braking.mp3','assets/audio/headlight-switch.mp3','assets/audio/drive-brake-switch.mp3');
names.push('assets/hands-on-wheel.glb','assets/africa-twin.glb','assets/stark-varg.glb','assets/bike-rider.glb');
names.push(...["trail-hauler", "desert-patrol", "rock-buggy", "trail-scout", "gortuner-classic", "summit-coupe", "rock-ranger", "expedition-hauler", "obsidian-4x4", "trail-mini"].map(n=>'assets/'+n+'.glb'),'assets/audio/motorcycle-acceleration.wav','assets/audio/electric-bike-acceleration.wav');
async function mapFiles(dir){const files=[];for(const entry of await readdir(dir,{withFileTypes:true})){const path=dir+'/'+entry.name;if(entry.isDirectory())files.push(...await mapFiles(path));else files.push(path);}return files;}
names.push(...await mapFiles('assets/gamblers'));
const files=[];await mkdir('.compressed',{recursive:true});let raw=0,compressed=0;
for(const path of names){
 const bytes=await readFile(path),hash=createHash('sha256').update(bytes).digest('hex').slice(0,16),target='.compressed/'+hash+'.gz',gzip=!/\.(png|jpg|dds|mp3)$/.test(path);let packedBytes=bytes.length;
 if(gzip){try{packedBytes=(await stat(target)).size;}catch{const packed=gzipSync(bytes,{level:6});await writeFile(target,packed);packedBytes=packed.length;}}
 else{try{await unlink(target);}catch{}}
 const dependencies=path.endsWith('.glb')?(JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12))).images||[]).filter(image=>image.uri&&!image.uri.startsWith('data:')).map(image=>posix.normalize(posix.join(posix.dirname(path),image.uri))):[];
 files.push({path,url:'./'+path+'?v='+hash,bytes:bytes.length,hash,gzip,dependencies,preload:!path.startsWith('assets/gamblers/textures/')&&!path.startsWith('assets/gamblers/compressed/')});raw+=bytes.length;compressed+=packedBytes;
}
const id=createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0,16);await writeFile('asset-manifest.json',JSON.stringify({id,files}));await writeFile('build-report.json',JSON.stringify({rawBytes:raw,transferBytes:compressed,initialPreloadBytes:files.filter(f=>f.preload).reduce((sum,f)=>sum+f.bytes,0),map:"gamblers-gutter",lossless:true,engineRequests:1,vehicles:25,bikes:2,version:id},null,2));console.log(`Build: ${files.length} files, ${(raw/1e6).toFixed(1)} MB -> ${(compressed/1e6).toFixed(1)} MB lossless gzip`);
