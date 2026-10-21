import {copyFile, link, mkdir, readFile, writeFile, unlink} from 'node:fs/promises';
import {dirname} from 'node:path';

// Serve the single-player game directly from the CDN. Large vehicle downloads
// must not depend on an HTTP function staying alive for the whole transfer.
const target='vercel-static';
const manifest=JSON.parse(await readFile('asset-manifest.json','utf8'));
const shell=['index.html','style.css','multiplayer.css','loading.css','boot.js','asset-plan.js','asset-preloader.js','sw.js','asset-manifest.json','robots.txt','sitemap.xml','assets/awd-favicon.png'];
for(const path of new Set([...shell,...manifest.files.map(file=>file.path)])){
 await mkdir(dirname(`${target}/${path}`),{recursive:true});
 if(path==='boot.js')await writeFile(`${target}/${path}`,'window.offrideSinglePlayer=true;\n'+await readFile(path,'utf8'));
 else {
  // Replace only this generated output file; hard links avoid a second local
  // copy of the garage while retaining ordinary static files on Vercel.
  await unlink(`${target}/${path}`).catch(error=>{if(error.code!=='ENOENT')throw error;});
  try{await link(path,`${target}/${path}`);}catch{await copyFile(path,`${target}/${path}`);}
 }
}
console.log(`Static single-player deployment: ${manifest.files.length} game assets, original bytes preserved.`);
