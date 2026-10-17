import {randomBytes,randomUUID} from 'node:crypto';
import {WebSocketServer,WebSocket} from 'ws';

export const vehicleIds=['suv','range-rover','defender-90','defender-grasmere','ram-trx','fortuner','gladiator','sierra','g63','raptor','everest','safari','hilux','urus','sterrato'];
const safeName=v=>String(v||'Driver').replace(/[\p{C}<>]/gu,'').trim().slice(0,24)||'Driver';
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
export function makeCourse(meta){
 const start=meta.trail.reduce((best,p,i)=>Math.hypot(p.x-meta.spawn.x,p.z-meta.spawn.z)<Math.hypot(meta.trail[best].x-meta.spawn.x,meta.trail[best].z-meta.spawn.z)?i:best,0);
 const line=meta.trail.slice(start),points=line.filter((_,i)=>i>0&&i%3===0);if(points.at(-1)!==line.at(-1))points.push(line.at(-1));
 const a=line[0],b=line[1],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz),forward=[dx/length,dz/length];
 return {name:'FreeCity mountain sprint',checkpoints:points.map(p=>[p.x,p.y,p.z]),radius:15,start:{x:a.x,z:a.z,yaw:Math.atan2(-dx,-dz)},forward};
}
export function attachMultiplayer(server,meta,{now=Date.now,autoTick=true,allowedOrigins=[]}={}){
 const wss=new WebSocketServer({noServer:true,maxPayload:4096,perMessageDeflate:false}),players=new Map(),rooms=new Map(),sockets=new Map(),course=makeCourse(meta);let closing=false;
 const publicPlayer=p=>({id:p.id,name:p.name,vehicle:p.vehicle,ready:p.ready,connected:p.connected});
 function send(ws,message){if(ws?.readyState===WebSocket.OPEN&&ws.bufferedAmount<128*1024)ws.send(JSON.stringify(message));}
 const members=r=>[...r.members].map(id=>players.get(id)).filter(Boolean);
 const roomState=r=>({code:r.code,hostId:r.hostId,phase:r.phase,maxPlayers:5,players:members(r).map(publicPlayer),race:r.race?{id:r.race.id,startAt:r.race.startAt,deadline:r.race.deadline,course,progress:[...r.race.progress].map(([id,v])=>({id,...v})),results:r.race.results}:null});
 function audience(p){return p.mode==='free'?[...players.values()].filter(q=>q.mode==='free'&&q.connected):p.room?members(rooms.get(p.room)||{members:[]}):[];}
 function broadcastRoom(r){for(const p of members(r))send(p.ws,{type:'room',room:roomState(r),serverTime:now()});}
 function error(p,message){send(p.ws,{type:'error',message});}
 function finishRace(r){if(r.phase==='results')return;r.phase='results';for(const [id,v] of r.race.progress)if(v.finishedAt==null){v.dnf=true;r.race.results.push({id,name:players.get(id)?.name||'Driver',time:null,dnf:true});}broadcastRoom(r);}
 function detach(p){
  if(p.room){const r=rooms.get(p.room);if(r){r.members.delete(p.id);if(r.race?.progress.has(p.id)&&!r.race.progress.get(p.id).finishedAt){r.race.progress.get(p.id).dnf=true;if(!r.race.results.some(v=>v.id===p.id))r.race.results.push({id:p.id,name:p.name,time:null,dnf:true});}
   if(!r.members.size)rooms.delete(r.code);else{if(r.hostId===p.id)r.hostId=[...r.members][0];if(r.phase==='countdown'){r.phase='lobby';r.race=null;for(const q of members(r))q.ready=false;}if(r.phase==='racing'&&[...r.race.progress.values()].every(v=>v.finishedAt!=null||v.dnf))finishRace(r);broadcastRoom(r);}
  }}p.room=null;p.mode=null;p.ready=false;p.state=null;
 }
 function gridPose(index){const row=Math.floor(index/2),side=index%2?1:-1,[fx,fz]=course.forward;return{x:course.start.x-fx*(row*7+3)+fz*side*1.8,z:course.start.z-fz*(row*7+3)-fx*side*1.8,yaw:course.start.yaw};}
 function enterFree(p){const count=[...players.values()].filter(q=>q.mode==='free'&&q.id!==p.id).length;if(count>=32)return error(p,'The shared area is full (32 drivers). Try again shortly.');detach(p);p.mode='free';send(p.ws,{type:'joined',mode:'free',serverTime:now(),spawn:{...meta.spawn,x:meta.spawn.x+(count%4)*3,z:meta.spawn.z-Math.floor(count/4)*6}});}
 function handle(p,m){
  if(!m||typeof m!=='object'||typeof m.type!=='string')return;
  if(m.type==='ping')return send(p.ws,{type:'pong',sent:m.sent,serverTime:now()});
  if(m.type==='joinFree'){p.name=safeName(m.name);if(vehicleIds.includes(m.vehicle))p.vehicle=m.vehicle;return enterFree(p);}
  if(m.type==='createRoom'){
   if(rooms.size>=100)return error(p,'All race rooms are busy. Try again shortly.');detach(p);p.name=safeName(m.name);if(vehicleIds.includes(m.vehicle))p.vehicle=m.vehicle;
   let code;do{code=randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(code));const r={code,hostId:p.id,phase:'lobby',members:new Set([p.id]),race:null};rooms.set(code,r);p.mode='room';p.room=code;send(p.ws,{type:'joined',mode:'room',code,spawn:gridPose(0),serverTime:now()});broadcastRoom(r);return;
  }
  if(m.type==='joinRoom'){
   const r=rooms.get(String(m.code||'').trim().toUpperCase());if(!r)return error(p,'Room not found. Check the six-character code.');if(r.phase!=='lobby')return error(p,'This race has already started. Join after the host opens a rematch.');if(r.members.size>=5&&!r.members.has(p.id))return error(p,'This room is full (5 drivers).');
   if(p.room!==r.code){detach(p);r.members.add(p.id);}p.mode='room';p.room=r.code;p.name=safeName(m.name);if(vehicleIds.includes(m.vehicle))p.vehicle=m.vehicle;p.ready=false;send(p.ws,{type:'joined',mode:'room',code:r.code,spawn:gridPose([...r.members].indexOf(p.id)),serverTime:now()});broadcastRoom(r);return;
  }
  if(m.type==='leave'){detach(p);send(p.ws,{type:'left'});return;}
  const r=rooms.get(p.room);
  if(m.type==='ready'){if(!r||r.phase!=='lobby')return;p.ready=!!m.ready;broadcastRoom(r);return;}
  if(m.type==='startRace'){
   if(!r||r.hostId!==p.id)return error(p,'Only the host can launch the race.');if(r.phase!=='lobby')return error(p,'The race is already running.');const list=members(r);if(list.length<2||!list.every(v=>v.connected&&v.ready))return error(p,'At least two connected drivers must be ready.');
   const startAt=now()+5000;r.phase='countdown';r.race={id:randomUUID(),startAt,deadline:startAt+8*60*1000,progress:new Map(list.map(q=>[q.id,{checkpoint:0,finishedAt:null,dnf:false}])),results:[]};list.forEach((q,i)=>{q.state=null;q.lastStateAt=0;send(q.ws,{type:'grid',pose:gridPose(i),startAt,serverTime:now()});});broadcastRoom(r);return;
  }
  if(m.type==='rematch'){if(!r||r.hostId!==p.id||r.phase!=='results')return error(p,'The host can open a rematch after the race ends.');r.phase='lobby';r.race=null;for(const q of members(r))q.ready=false;broadcastRoom(r);return;}
  if(m.type==='cancelRace'){if(!r||r.hostId!==p.id||!['racing','countdown'].includes(r.phase))return;finishRace(r);return;}
  if(m.type==='state'){
   if(!p.mode||!Number.isInteger(m.seq)||m.seq<=p.seq||now()-p.lastStateAt<25)return;
   const s=m.state;if(!s||!Array.isArray(s.p)||s.p.length!==3||!s.p.every(Number.isFinite)||Math.abs(s.p[0])>470||Math.abs(s.p[2])>470||Math.abs(s.p[1])>300||!Array.isArray(s.q)||s.q.length!==4||!s.q.every(Number.isFinite)||Math.abs(Math.hypot(...s.q)-1)>.05)return;
   if(!Array.isArray(s.w)||s.w.length!==4||!s.w.every(w=>Array.isArray(w)&&w.length===3&&w.every(Number.isFinite)&&w[0]>=0&&w[0]<2&&Math.abs(w[1])<1e8&&Math.abs(w[2])<1))return;
   if(!Number.isFinite(s.steer)||Math.abs(s.steer)>1||!Number.isFinite(s.speed)||Math.abs(s.speed)>100)return;
   const locked=r&&['countdown','racing'].includes(r.phase);if(!locked&&vehicleIds.includes(s.vehicle)&&p.vehicle!==s.vehicle){p.vehicle=s.vehicle;p.ready=false;if(r)broadcastRoom(r);}
   if(locked&&s.vehicle!==p.vehicle)return;
   if(r?.phase==='countdown'&&distance(s.p,[course.start.x,0,course.start.z])>30)return;
   if(r?.phase==='racing'&&p.state&&distance(s.p,p.state.p)>Math.max(8,(now()-p.lastStateAt)/1000*90))return;
   p.seq=m.seq;p.lastStateAt=now();p.state={p:s.p,q:s.q,w:s.w,steer:s.steer,speed:s.speed,vehicle:p.vehicle};
   if(r?.phase==='racing'){
    const progress=r.race.progress.get(p.id),checkpoint=course.checkpoints[progress?.checkpoint];
    if(progress&&!progress.dnf&&progress.finishedAt==null&&checkpoint&&distance(s.p,checkpoint)<course.radius){progress.checkpoint++;
     if(progress.checkpoint===course.checkpoints.length){progress.finishedAt=now();r.race.results.push({id:p.id,name:p.name,time:now()-r.race.startAt,dnf:false});r.race.deadline=Math.min(r.race.deadline,now()+90000);}
     if([...r.race.progress.values()].every(v=>v.finishedAt!=null||v.dnf))finishRace(r);else broadcastRoom(r);
    }
   }
  }
 }
 server.on('upgrade',(req,socket,head)=>{
  const origin=req.headers.origin;let originOk=!origin;try{originOk||=new URL(origin).host===req.headers.host||allowedOrigins.includes(origin);}catch{}
  if(closing||req.url!=='/multiplayer'||!originOk||wss.clients.size>=256){socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');return;}
  wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
 });
 wss.on('connection',ws=>{
  let player=null,lastWindow=now(),messages=0;ws.alive=true;ws.on('pong',()=>ws.alive=true);
  const helloTimeout=setTimeout(()=>{if(!player)ws.close(1008,'Join timed out');},10000);helloTimeout.unref?.();
  ws.on('message',raw=>{try{
   if(now()-lastWindow>1000){lastWindow=now();messages=0;}if(++messages>65)return ws.close(1008,'Too many messages');const m=JSON.parse(raw.toString());
   if(!player){if(m.type!=='hello')return;clearTimeout(helloTimeout);const existing=[...players.values()].find(p=>p.token===m.token&&typeof m.token==='string'&&!p.connected&&now()-p.disconnectedAt<20000);
    if(existing){player=existing;player.ws=ws;player.connected=true;player.seq=-1;}else{player={id:randomUUID(),token:randomBytes(24).toString('hex'),name:'Driver',vehicle:'suv',mode:null,room:null,ready:false,connected:true,state:null,lastStateAt:0,seq:-1,ws};players.set(player.id,player);}sockets.set(ws,player);send(ws,{type:'welcome',id:player.id,token:player.token,mode:player.mode,room:player.room?roomState(rooms.get(player.room)):null,serverTime:now()});if(player.room)broadcastRoom(rooms.get(player.room));return;
   }handle(player,m);
  }catch{send(ws,{type:'error',message:'Invalid network message.'});}});
  ws.on('error',()=>{});ws.on('close',()=>{clearTimeout(helloTimeout);sockets.delete(ws);if(player){player.connected=false;player.disconnectedAt=now();if(player.room)broadcastRoom(rooms.get(player.room));}});
 });
 function tick(){
  const time=now();for(const p of players.values())if(!p.connected&&time-p.disconnectedAt>=20000){detach(p);players.delete(p.id);}
  for(const r of rooms.values()){if(r.phase==='countdown'&&time>=r.race.startAt){r.phase='racing';broadcastRoom(r);}if(r.phase==='racing'&&time>=r.race.deadline)finishRace(r);}
  for(const p of players.values())if(p.connected&&p.mode){const peers=audience(p).filter(q=>q.id!==p.id).map(q=>({...publicPlayer(q),state:q.connected?q.state:null}));send(p.ws,{type:'snapshot',players:peers,serverTime:time});}
 }
 const tickTimer=autoTick?setInterval(tick,50):null;tickTimer?.unref();const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}},15000);heartbeat.unref();
 return {players,rooms,course,tick,close(){closing=true;clearInterval(tickTimer);clearInterval(heartbeat);for(const ws of wss.clients)ws.close(1012,'Server restarting');setTimeout(()=>{for(const ws of wss.clients)ws.terminate();},1000).unref();wss.close();}};
}
