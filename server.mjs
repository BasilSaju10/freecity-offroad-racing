import {createServer} from 'node:http';
import {stat,readFile,realpath} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep,relative} from 'node:path';
import {attachMultiplayer} from './multiplayer-server.mjs';
const root=fileURLToPath(new URL('.',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.bin':'application/octet-stream'};
const meta=JSON.parse(await readFile(new URL('./assets/map/physics.json',import.meta.url)));
export const server=createServer(async(req,res)=>{try{
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
 const url=new URL(req.url,'http://localhost');if(url.pathname==='/healthz'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true}));return;}
 let name=decodeURIComponent(url.pathname);if(name==='/')name='/index.html';const path=resolve(root,'.'+name),rel=relative(root,path);
 if(!path.startsWith(resolve(root)+sep)||rel.split(/[\\/]/).some(p=>p.startsWith('.'))||/node_modules|editable\.blend/i.test(rel)||!['.html','.js','.css','.json','.glb','.png','.jpg','.bin'].includes(extname(path))){res.writeHead(404);res.end('Not found');return;}
 const canonical=await realpath(path);if(!canonical.startsWith(resolve(root)+sep))throw Error('Outside public root');const info=await stat(path);if(!info.isFile())throw Error('Not a file');
 res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':/\.(glb|png|jpg|bin)$/.test(path)?'public, max-age=3600':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'});
 if(req.method==='HEAD')res.end();else{const stream=createReadStream(path);stream.on('error',()=>res.destroy());stream.pipe(res);}
 }catch{if(!res.headersSent)res.writeHead(404);res.end('Not found');}});
export const multiplayer=attachMultiplayer(server,meta);
const port=Number(process.env.PORT||5173);server.listen(port,process.env.HOST||'0.0.0.0',()=>console.log(`OFFRIDE multiplayer ready on port ${port}`));
let stopping=false;function shutdown(){if(stopping)return;stopping=true;multiplayer.close();server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),8000).unref();}process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
