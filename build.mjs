import {build} from 'esbuild';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
await build({entryPoints:['main.js'],outfile:'app.bundle.js',bundle:true,format:'esm',target:'es2022',minify:true,legalComments:'none',alias:{fflate:'./vendor/fflate.js'}});
const names=['app.bundle.js','assets/map/physics.json','assets/map/heights.bin','assets/map/freecity.glb',...['vehicle','range-rover','defender-90','defender-grasmere','ram-trx','fortuner','gladiator','sierra','g63','raptor','everest','safari','hilux','urus','sterrato'].map(n=>'assets/'+n+'.glb')];
names.push('assets/audio/acceleration-loop.wav','assets/audio/braking.mp3','assets/audio/headlight-switch.mp3','assets/audio/drive-brake-switch.mp3');
names.push('assets/hands-on-wheel.glb');
const files=[];await mkdir('.compressed',{recursive:true});let raw=0,compressed=0;
for(const path of names){const bytes=await readFile(path),hash=createHash('sha256').update(bytes).digest('hex').slice(0,16),packed=gzipSync(bytes,{level:6});await writeFile('.compressed/'+hash+'.gz',packed);files.push({path,url:'./'+path+'?v='+hash,bytes:bytes.length,hash});raw+=bytes.length;compressed+=packed.length;}
const id=createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0,16);await writeFile('asset-manifest.json',JSON.stringify({id,files}));await writeFile('build-report.json',JSON.stringify({rawBytes:raw,transferBytes:compressed,lossless:true,engineRequests:1,vehicles:15,version:id},null,2));console.log(`Build: ${files.length} files, ${(raw/1e6).toFixed(1)} MB -> ${(compressed/1e6).toFixed(1)} MB lossless gzip`);
