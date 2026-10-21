import {createServer} from 'node:http';
import {stat,readFile,realpath} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep,relative} from 'node:path';
import {attachMultiplayer} from './multiplayer-server.mjs';
const root=fileURLToPath(new URL('.',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.glb':'model/gltf-binary','.dds':'application/octet-stream','.png':'image/png','.jpg':'image/jpeg','.bin':'application/octet-stream','.wav':'audio/wav','.mp3':'audio/mpeg'};
let manifest={files:[]};try{manifest=JSON.parse(await readFile(new URL('./asset-manifest.json',import.meta.url)));}catch{}
const assets=new Map(manifest.files.map(f=>[f.path,f]));
const meta=JSON.parse(await readFile(new URL('./assets/gamblers/physics.json',import.meta.url)));
export const server=createServer(async(req,res)=>{try{
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
 const url=new URL(req.url,'http://localhost');if(url.pathname==='/healthz'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true}));return;}
 const publicOrigin=process.env.OFFRIDE_PUBLIC_URL;if(publicOrigin&&new URL(publicOrigin).host!==req.headers.host&&(url.pathname==='/'||url.pathname==='/index.html')){res.writeHead(302,{Location:new URL('/'+url.search,publicOrigin).href,'Cache-Control':'no-store'});res.end();return;}
 const indexingFiles={'/robots.txt':'text/plain; charset=utf-8','/sitemap.xml':'application/xml; charset=utf-8'};
 if(indexingFiles[url.pathname]){const content=await readFile(new URL('.'+url.pathname,import.meta.url));res.writeHead(200,{'Content-Type':indexingFiles[url.pathname],'Content-Length':content.length,'Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:content);return;}
 let name=decodeURIComponent(url.pathname);if(name==='/')name='/index.html';let path=resolve(root,'.'+name);const rel=relative(root,path);
 if(process.env.OFFRIDE_LOCAL_ONLY==='1'&&name==='/boot.js'){const boot='window.offridePrivatePreview=true;\n'+await readFile(new URL('./boot.js',import.meta.url),'utf8');res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});res.end(boot);return;}
 if(!path.startsWith(resolve(root)+sep)||rel.split(/[\\/]/).some(p=>p.startsWith('.'))||/node_modules|editable\.blend/i.test(rel)||!Object.keys(types).includes(extname(path))){res.writeHead(404);res.end('Not found');return;}
 const canonical=await realpath(path);if(!canonical.startsWith(resolve(root)+sep))throw Error('Outside public root');let info=await stat(path);if(!info.isFile())throw Error('Not a file');
 const asset=assets.get(rel.replaceAll('\\','/')),versioned=asset&&url.searchParams.get('v')===asset.hash,etag='"'+(asset?.hash||info.size+'-'+Math.floor(info.mtimeMs))+'"';
 const headers={'Content-Type':types[extname(path)],'Cache-Control':versioned?'public, max-age=31536000, immutable':'no-cache','ETag':etag,'Vary':'Accept-Encoding','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'};
 if(req.headers['if-none-match']===etag){res.writeHead(304,headers);res.end();return;}
 if(asset&&asset.gzip!==false&&/\bgzip\b/.test(req.headers['accept-encoding']||'')){path=resolve(root,'.compressed',asset.hash+'.gz');info=await stat(path);headers['Content-Encoding']='gzip';}
 headers['Content-Length']=info.size;res.writeHead(200,headers);
 if(req.method==='HEAD')res.end();else{const stream=createReadStream(path);stream.on('error',()=>res.destroy());stream.pipe(res);}
 }catch{if(!res.headersSent)res.writeHead(404);res.end('Not found');}});
export const multiplayer=attachMultiplayer(server,meta);
const port=Number(process.env.PORT||5173);server.listen(port,process.env.HOST||'0.0.0.0',()=>console.log(`OFFRIDE multiplayer ready on port ${port}`));
let stopping=false;function shutdown(){if(stopping)return;stopping=true;multiplayer.close();server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),8000).unref();}process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
