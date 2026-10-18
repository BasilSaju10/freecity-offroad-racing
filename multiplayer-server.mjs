import {randomBytes,randomUUID} from 'node:crypto';
import {WebSocketServer,WebSocket} from 'ws';

export const vehicleIds=['suv','range-rover','defender-90','defender-grasmere','ram-trx','fortuner','gladiator','sierra','g63','raptor','everest','safari','hilux','urus','sterrato'];
const safeName=v=>String(v||'Driver').replace(/[\p{C}<>]/gu,'').trim().slice(0,24)||'Driver';
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
// Resample a continuous section of the existing trail: gates never jump between roads.
export function makeCourse(meta,random=Math.random){
 const trail=meta.trail, cumulative=[0];for(let i=1;i<trail.length;i++)cumulative.push(cumulative.at(-1)+Math.hypot(trail[i].x-trail[i-1].x,trail[i].z-trail[i-1].z));
 const total=cumulative.at(-1),length=Math.min(total,650+random()*450),offset=random()*Math.max(0,total-length),reverse=random()<.5;
 function sample(d){let i=1;while(i<cumulative.length-1&&cumulative[i]<d)i++;const a=trail[i-1],b=trail[i],t=(d-cumulative[i-1])/(cumulative[i]-cumulative[i-1]||1);return[a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,a.z+(b.z-a.z)*t];}
 const path=Array.from({length:11},(_,i)=>sample(offset+length*(reverse?1-i/10:i/10))),[a,b]=path,dx=b[0]-a[0],dz=b[2]-a[2],norm=Math.hypot(dx,dz);
 // Use the immediate trail tangent for a grid aligned with the road, including bends.
 const near=sample(offset+length*(reverse?1:0)+(reverse?-1:1)),fx=near[0]-a[0],fz=near[2]-a[2],n=Math.hypot(fx,fz)||norm;
 return {name:`Mountain sprint ${Math.round(offset)}${reverse?' reverse':''}`,checkpoints:path.slice(1),radius:15,start:{x:a[0],y:a[1],z:a[2],yaw:Math.atan2(-fx,-fz)},forward:[fx/n,fz/n]};
}
export function attachMultiplayer(server,meta,{now=Date.now,autoTick=true,allowedOrigins=[],random=Math.random}={}){
 const wss=new WebSocketServer({noServer:true,maxPayload:4096,perMessageDeflate:false}),players=new Map(),rooms=new Map(),sockets=new Map(),course={start:meta.spawn,forward:[-Math.sin(meta.spawn.yaw),-Math.cos(meta.spawn.yaw)]};let closing=false,lastDirectory=0;const invitations=new Map();
 const validPose=s=>s&&Array.isArray(s.p)&&s.p.length===3&&s.p.every(Number.isFinite)&&Math.abs(s.p[0])<456&&Math.abs(s.p[2])<456&&Math.abs(s.p[1])<300&&Array.isArray(s.q)&&s.q.length===4&&s.q.every(Number.isFinite)&&Math.abs(Math.hypot(...s.q)-1)<.05;
 const publicPlayer=p=>({id:p.id,name:p.name,vehicle:p.vehicle,ready:p.ready,connected:p.connected});
 function send(ws,message){if(ws?.readyState===WebSocket.OPEN&&ws.bufferedAmount<128*1024)ws.send(JSON.stringify(message));}
 const members=r=>[...r.members].map(id=>players.get(id)).filter(Boolean);
 const roomState=r=>({code:r.code,hostId:r.hostId,vehicle:r.vehicle,phase:r.phase,maxPlayers:5,players:members(r).map(publicPlayer),race:r.race?{id:r.race.id,startAt:r.race.startAt,deadline:r.race.deadline,course:r.race.course,progress:[...r.race.progress].map(([id,v])=>({id,...v})),results:r.race.results}:null});
 function audience(p){return p.mode==='free'?[...players.values()].filter(q=>q.mode==='free'&&q.connected):p.room?members(rooms.get(p.room)||{members:[]}):[];}
 function broadcastRoom(r){for(const p of members(r))send(p.ws,{type:'room',room:roomState(r),serverTime:now()});}
 function error(p,message){send(p.ws,{type:'error',message});}
 function finishRace(r){if(r.phase==='results')return;r.phase='results';for(const [id,v] of r.race.progress)if(v.finishedAt==null){v.dnf=true;if(!r.race.results.some(p=>p.id===id))r.race.results.push({id,name:players.get(id)?.name||'Driver',time:null,dnf:true});}broadcastRoom(r);}
 function detach(p){
  if(p.room){const r=rooms.get(p.room);if(r){r.members.delete(p.id);if(r.race?.progress.has(p.id)&&!r.race.progress.get(p.id).finishedAt){r.race.progress.get(p.id).dnf=true;if(!r.race.results.some(v=>v.id===p.id))r.race.results.push({id:p.id,name:p.name,time:null,dnf:true});}
   if(!r.members.size)rooms.delete(r.code);else{if(r.hostId===p.id)r.hostId=[...r.members][0];if(r.phase==='countdown'){r.phase='lobby';r.race=null;for(const q of members(r))q.ready=false;}if(r.phase==='racing'&&[...r.race.progress.values()].every(v=>v.finishedAt!=null||v.dnf))finishRace(r);broadcastRoom(r);}
  }}p.room=null;p.mode=null;p.ready=false;p.state=null;
 }
 function gridPose(index,courseOverride=course){const course=courseOverride;const row=Math.floor(index/2),side=index%2?1:-1,[fx,fz]=course.forward;return{y:course.start.y,x:course.start.x-fx*(row*7+3)+fz*side*1.8,z:course.start.z-fz*(row*7+3)-fx*side*1.8,yaw:course.start.yaw};}
 function place(p,pose){p.state={p:[pose.x,(pose.y??meta.spawn.y)+.8,pose.z],q:[0,Math.sin(pose.yaw/2),0,Math.cos(pose.yaw/2)],w:Array.from({length:4},()=>[.36,0,0]),steer:0,speed:0,vehicle:p.vehicle};p.lastStateAt=0;}
 const directory=()=>[...players.values()].filter(p=>p.connected&&p.mode).map(p=>({...publicPlayer(p),available:p.mode==='free'}));
 function enterFree(p,resume=null){const saved=p.mode==='free'?p.state:validPose(resume)?{p:resume.p,q:resume.q,w:Array.from({length:4},()=>[.36,0,0]),steer:0,speed:0,vehicle:p.vehicle}:null;const others=[...players.values()].filter(q=>q.mode==='free'&&q.id!==p.id);if(others.length>=32)return error(p,'The shared area is full (32 drivers). Try again shortly.');const used=new Set(others.map(q=>q.spawnSlot));let slot=0;while(used.has(slot))slot++;detach(p);p.spawnSlot=slot;p.mode='free';const [fx,fz]=course.forward,side=(slot%4-1.5)*3,back=Math.floor(slot/4)*6;const spawn={...meta.spawn,x:meta.spawn.x+fz*side-fx*back,z:meta.spawn.z-fx*side-fz*back};if(saved)p.state=saved;else place(p,spawn);send(p.ws,{type:'joined',mode:'free',serverTime:now(),...(saved?{restore:saved}:{spawn})});}

 function handle(p,m){
  p.lastSeen=now();
  if(!m||typeof m!=='object'||typeof m.type!=='string')return;
  if(m.type==='listOnline')return send(p.ws,{type:'directory',players:directory()});
  if(m.type==='ping')return send(p.ws,{type:'pong',sent:m.sent,serverTime:now()});
  if(m.type==='joinFree'){p.name=safeName(m.name);if(vehicleIds.includes(m.vehicle))p.vehicle=m.vehicle;return enterFree(p,m.resume);}
  if(m.type==='createRoom'){
   if(rooms.size>=100)return error(p,'All race rooms are busy. Try again shortly.');detach(p);p.name=safeName(m.name);if(vehicleIds.includes(m.vehicle))p.vehicle=m.vehicle;
   let code;do{code=randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(code));const r={code,hostId:p.id,vehicle:p.vehicle,phase:'lobby',members:new Set([p.id]),race:null};rooms.set(code,r);p.mode='room';p.room=code;place(p,gridPose(0));send(p.ws,{type:'joined',mode:'room',code,spawn:gridPose(0),serverTime:now()});broadcastRoom(r);return;
  }
  if(m.type==='joinRoom'){
   const r=rooms.get(String(m.code||'').trim().toUpperCase());if(!r)return error(p,'Room not found. Check the six-character code.');if(r.phase!=='lobby')return error(p,'This race has already started. Join after the host opens a rematch.');if(r.members.size>=5&&!r.members.has(p.id))return error(p,'This room is full (5 drivers).');
   if(p.room!==r.code){detach(p);r.members.add(p.id);}p.mode='room';p.room=r.code;p.name=safeName(m.name);p.vehicle=r.vehicle;p.ready=false;place(p,gridPose([...r.members].indexOf(p.id)));send(p.ws,{type:'joined',mode:'room',code:r.code,spawn:gridPose([...r.members].indexOf(p.id)),serverTime:now()});broadcastRoom(r);return;
  }
  if(m.type==='leave'){detach(p);send(p.ws,{type:'left'});return;}
  const r=rooms.get(p.room);
  if(m.type==='invite'){
   if(!r||r.hostId!==p.id||r.phase!=='lobby')return error(p,'Only a lobby host can invite players.');
   const target=players.get(m.playerId);if(!target?.connected||target.mode!=='free'||target.id===p.id)return error(p,'That driver is not available.');
   if(r.members.size>=5)return error(p,'This room is full.');
   if([...invitations.values()].some(i=>i.to===target.id&&i.room===r.code&&i.expires>now()))return error(p,'An invitation is already pending.');
   const invite={id:randomUUID(),room:r.code,from:p.id,to:target.id,expires:now()+30000};invitations.set(invite.id,invite);send(target.ws,{type:'invitation',invitation:{id:invite.id,host:p.name,code:r.code,expires:invite.expires}});send(p.ws,{type:'notice',message:'Invitation sent to '+target.name+'.'});return;
  }
  if(m.type==='answerInvite'){
   const invite=invitations.get(m.inviteId);if(!invite||invite.to!==p.id||invite.expires<now())return error(p,'This invitation has expired.');invitations.delete(invite.id);
   if(!m.accept)return;const targetRoom=rooms.get(invite.room);if(!targetRoom||targetRoom.hostId!==invite.from)return error(p,'This room is no longer available.');
   if(p.mode==='room'&&['countdown','racing'].includes(r?.phase))return error(p,'Finish your current race first.');
   return handle(p,{type:'joinRoom',code:invite.room,name:p.name,vehicle:p.vehicle});
  }
  if(m.type==='ready'){if(!r||r.phase!=='lobby')return;if(m.ready&&m.vehicle&&m.vehicle!==r.vehicle)return error(p,'Wait for the host vehicle to finish loading.');p.ready=!!m.ready;broadcastRoom(r);return;}
  if(m.type==='startRace'){
   if(!r||r.hostId!==p.id)return error(p,'Only the host can launch the race.');if(r.phase!=='lobby')return error(p,'The race is already running.');const list=members(r);if(list.length<2||!list.every(v=>v.connected&&v.ready))return error(p,'At least two connected drivers must be ready.');
   const startAt=now()+5000;r.phase='countdown';r.race={id:randomUUID(),course:makeCourse(meta,random),startAt,deadline:startAt+8*60*1000,progress:new Map(list.map(q=>[q.id,{checkpoint:0,finishedAt:null,dnf:false}])),results:[]};list.forEach((q,i)=>{place(q,gridPose(i,r.race.course));send(q.ws,{type:'grid',pose:gridPose(i,r.race.course),startAt,serverTime:now()});});broadcastRoom(r);return;
  }
  if(m.type==='rematch'){if(!r||r.hostId!==p.id||r.phase!=='results')return error(p,'The host can open a rematch after the race ends.');r.phase='lobby';r.race=null;for(const q of members(r))q.ready=false;broadcastRoom(r);return;}
  if(m.type==='cancelRace'){if(!r||r.hostId!==p.id||!['racing','countdown'].includes(r.phase))return;finishRace(r);return;}
  if(m.type==='state'){
   if(!p.mode||!Number.isInteger(m.seq)||m.seq<=p.seq||now()-p.lastStateAt<25)return;
   const s=m.state;if(!s||!Array.isArray(s.p)||s.p.length!==3||!s.p.every(Number.isFinite)||Math.abs(s.p[0])>470||Math.abs(s.p[2])>470||Math.abs(s.p[1])>300||!Array.isArray(s.q)||s.q.length!==4||!s.q.every(Number.isFinite)||Math.abs(Math.hypot(...s.q)-1)>.05)return;
   // Cosmetic animation must not suppress an otherwise valid vehicle pose.
   const bounded=(v,min,max,fallback=0)=>Number.isFinite(v)?Math.max(min,Math.min(max,v)):fallback;
   const wheels=Array.from({length:4},(_,i)=>{const w=s.w?.[i];return[bounded(w?.[0],0,1.99,.36),bounded(w?.[1],-1e8,1e8),bounded(w?.[2],-1,1)];});
   const steer=bounded(s.steer,-1,1),speed=bounded(s.speed,-100,100),raceCourse=r?.race?.course;
   const locked=r&&['countdown','racing'].includes(r.phase);if(!locked&&vehicleIds.includes(s.vehicle)&&p.vehicle!==s.vehicle){
    if(r){if(r.hostId===p.id){r.vehicle=s.vehicle;for(const q of members(r)){q.vehicle=r.vehicle;q.ready=false;if(q.state)q.state.vehicle=r.vehicle;}broadcastRoom(r);}}
    else{p.vehicle=s.vehicle;p.ready=false;}
   }
   if(locked&&s.vehicle!==p.vehicle)return;
   if(r?.phase==='countdown'&&distance(s.p,[raceCourse.start.x,0,raceCourse.start.z])>30)return;
   if(r?.phase==='racing'&&p.state&&distance(s.p,p.state.p)>Math.max(8,(now()-p.lastStateAt)/1000*90))return;
   p.seq=m.seq;p.lastStateAt=now();p.state={p:s.p,q:s.q,w:wheels,steer,speed,vehicle:p.vehicle};
   if(r?.phase==='racing'){
    const progress=r.race.progress.get(p.id),checkpoint=raceCourse.checkpoints[progress?.checkpoint];
    if(progress&&!progress.dnf&&progress.finishedAt==null&&checkpoint&&distance(s.p,checkpoint)<raceCourse.radius){progress.checkpoint++;
     if(progress.checkpoint===raceCourse.checkpoints.length){progress.finishedAt=now();r.race.results.push({id:p.id,name:p.name,time:now()-r.race.startAt,dnf:false});r.race.deadline=Math.min(r.race.deadline,now()+90000);}
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
   if(!player){if(m.type!=='hello')return;if(m.version!==3){ws.close(4002,'Refresh OFFRIDE to update multiplayer');return;}clearTimeout(helloTimeout);const existing=[...players.values()].find(p=>p.token===m.token&&typeof m.token==='string'&&(p.connected||now()-p.disconnectedAt<20000));
    if(existing){player=existing;if(player.connected&&player.ws!==ws)player.ws.close(4001,'Driving continued in another tab');player.ws=ws;player.connected=true;player.lastSeen=now();player.seq=-1;}else{player={id:randomUUID(),token:typeof m.token==='string'&&/^[a-f0-9-]{36,96}$/i.test(m.token)?m.token:randomBytes(24).toString('hex'),name:'Driver',vehicle:'suv',mode:null,room:null,ready:false,connected:true,lastSeen:now(),state:null,lastStateAt:0,seq:-1,ws};players.set(player.id,player);}sockets.set(ws,player);send(ws,{type:'welcome',id:player.id,token:player.token,mode:player.mode,room:player.room?roomState(rooms.get(player.room)):null,restore:player.mode?player.state:null,serverTime:now()});if(player.room)broadcastRoom(rooms.get(player.room));return;
   }if(player.ws!==ws||!player.connected)return;handle(player,m);
  }catch{send(ws,{type:'error',message:'Invalid network message.'});}});
  ws.on('error',()=>{});ws.on('close',()=>{clearTimeout(helloTimeout);sockets.delete(ws);if(player&&player.ws===ws){player.connected=false;player.disconnectedAt=now();if(player.room)broadcastRoom(rooms.get(player.room));}});
 });
 function tick(){
  const time=now();for(const p of players.values())if(p.connected&&time-p.lastSeen>30000){p.connected=false;p.disconnectedAt=time;p.ws.close(4003,'Driver stopped updating');if(p.room)broadcastRoom(rooms.get(p.room));}for(const [id,i] of invitations)if(i.expires<time)invitations.delete(id);if(time-lastDirectory>=1000){lastDirectory=time;const list=directory();for(const p of players.values())if(p.connected)send(p.ws,{type:'directory',players:list});}for(const p of players.values())if(!p.connected&&time-p.disconnectedAt>=20000){detach(p);players.delete(p.id);}
  for(const r of rooms.values()){if(r.phase==='countdown'&&time>=r.race.startAt){r.phase='racing';broadcastRoom(r);}if(r.phase==='racing'&&time>=r.race.deadline)finishRace(r);}
  for(const p of players.values())if(p.connected&&p.mode){const peers=audience(p).filter(q=>q.id!==p.id).map(q=>({...publicPlayer(q),state:q.connected?q.state:null}));send(p.ws,{type:'snapshot',players:peers,serverTime:time});}
 }
 const tickTimer=autoTick?setInterval(tick,50):null;tickTimer?.unref();const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}},15000);heartbeat.unref();
 return {players,rooms,course,tick,close(){closing=true;clearInterval(tickTimer);clearInterval(heartbeat);for(const ws of wss.clients)ws.close(1012,'Server restarting');setTimeout(()=>{for(const ws of wss.clients)ws.terminate();},1000).unref();wss.close();}};
}
