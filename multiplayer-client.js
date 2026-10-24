export function createMultiplayer({getState,getVehicle,isReady,onGrid,onVehicle=()=>{},onRestore=()=>{},onLock,onMenu,remotes,showCheckpoint}){
 if(globalThis.offridePrivatePreview){const trigger=document.getElementById('online-toggle');trigger.textContent='Private preview · Solo';trigger.disabled=true;trigger.title='This private test version does not join the public multiplayer server.';document.getElementById('online-count').hidden=true;return{update(){},open(){},get active(){return false;}};}
 const dialog=document.getElementById('online-dialog'),trigger=document.getElementById('online-toggle'),status=document.getElementById('online-status'),error=document.getElementById('online-error'),name=document.getElementById('driver-name'),roomView=document.getElementById('race-room'),choices=document.getElementById('online-choices'),players=document.getElementById('room-players'),raceHud=document.getElementById('race-hud');
 let ws=null,id=null,mode=null,room=null,token=localStorage.getItem('offride-session')||sessionStorage.getItem('fc-session')||crypto.randomUUID(),retry=0,reconnectTimer=null,seq=0,clockOffset=0,lastSend=0,lastPing=0,lastHud='',rtt=null,onlinePlayers=[],pendingInvite=null,lastSaved=0,stopped=false,hasWorldPose=false;localStorage.setItem('offride-session',token);name.value=localStorage.getItem('fc-driver-name')||'Driver '+Math.floor(1000+Math.random()*9000);
 const send=m=>{if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(m));else{error.textContent='Connecting to the server. Try again in a moment.';error.hidden=false;}};
 function open(){document.exitPointerLock?.();onMenu(true);if(!dialog.open)dialog.showModal();render();}
 function close(){dialog.close();}
 function setRoom(value){room=value;if(room){mode='room';if(room.vehicle&&getVehicle()!==room.vehicle)onVehicle(room.vehicle);}render();}
 function render(){
  const connected=ws?.readyState===WebSocket.OPEN&&id,phase=room?.phase,locked=mode==='room'&&['countdown','racing'].includes(phase),followingHost=mode==='room'&&room?.hostId!==id;onLock({race:locked,freeze:locked&&(phase==='countdown'||!connected),vehicle:locked||followingHost});
  for(const b of dialog.querySelectorAll('[data-network]'))b.disabled=!connected;
  choices.hidden=mode==='room';roomView.hidden=mode!=='room';document.getElementById('leave-online').hidden=!mode;document.getElementById('close-online').textContent=mode?'Back to driving':'Continue solo';
  status.textContent=stopped?'Driving in another tab':connected?(mode==='free'?'Connected to shared free roam':mode==='room'?'Connected to race room':'Connected · Choose a mode'):'Connecting to multiplayer…';trigger.textContent=stopped?'Active in another tab':connected?(mode==='free'?'Free roam · Online':mode==='room'?`Room ${room?.code||''}`:'Multiplayer'):'Multiplayer · Reconnecting';
  if(room){document.getElementById('room-code').textContent=room.code;document.getElementById('room-phase').textContent=phase==='lobby'?'Waiting for drivers':phase==='countdown'?'Get ready':phase==='racing'?'Race in progress':'Race results';players.replaceChildren();
   for(const p of room.players){const li=document.createElement('li'),who=document.createElement('strong'),state=document.createElement('span');who.textContent=p.name+(p.id===id?' (you)':'');state.textContent=p.id===room.hostId?'HOST · ':'';state.textContent+=!p.connected?'RECONNECTING':p.ready?'READY':'NOT READY';li.append(who,state);players.append(li);}
   const me=room.players.find(p=>p.id===id),ready=document.getElementById('ready-race'),start=document.getElementById('start-race');ready.textContent=me?.ready?'Not ready':'Ready to race';ready.hidden=phase!=='lobby';start.hidden=room.hostId!==id||phase!=='lobby';start.disabled=!connected||room.players.length<2||!room.players.every(p=>p.connected&&p.ready);document.getElementById('room-hint').textContent=phase==='lobby'?`${room.players.length}/5 drivers · Share the room code or invite link. At least two drivers must be ready.`:'Follow the highlighted gates in order to reach the finish.';
   document.getElementById('rematch-race').hidden=room.hostId!==id||phase!=='results';document.getElementById('end-race').hidden=room.hostId!==id||!locked;const results=document.getElementById('race-results');results.hidden=phase!=='results';results.replaceChildren();if(phase==='results')for(const [i,p] of [...room.race.results.filter(p=>!p.dnf),...room.race.results.filter(p=>p.dnf)].entries()){const li=document.createElement('li');li.textContent=p.dnf?`${p.name} · Did not finish`:`${i+1}. ${p.name} · ${formatTime(p.time)}`;results.append(li);}
  }
  if(room?.vehicle){const pending=getVehicle()!==room.vehicle||!isReady();document.getElementById('ready-race').disabled=!connected||pending;if(pending)document.getElementById('start-race').disabled=true;if(phase==='lobby')document.getElementById('room-hint').textContent=`${room.players.length}/5 drivers · Everyone uses the host’s vehicle.${pending?' Loading vehicle…':' At least two drivers must be ready.'}`;}
  renderDirectory();
  if(!locked&&phase!=='results'){raceHud.hidden=true;showCheckpoint(null);}
 }
 function formatTime(ms){const seconds=Math.max(0,ms)/1000;return `${Math.floor(seconds/60)}:${(seconds%60).toFixed(1).padStart(4,'0')}`;}
 function action(type,extra={}){error.hidden=true;localStorage.setItem('fc-driver-name',name.value.trim().slice(0,24));send({type,name:name.value,vehicle:getVehicle(),...(type==='joinFree'&&hasWorldPose?{resume:getState()}:{}),...extra});}
 trigger.onclick=open;document.getElementById('close-online').onclick=close;dialog.addEventListener('close',()=>onMenu(false));document.getElementById('join-free').onclick=()=>action('joinFree');document.getElementById('create-room').onclick=()=>action('createRoom');
 document.getElementById('join-room-form').onsubmit=e=>{e.preventDefault();action('joinRoom',{code:document.getElementById('join-code').value});};document.getElementById('ready-race').onclick=()=>{if(!isReady()||(room?.vehicle&&getVehicle()!==room.vehicle)){error.textContent='Wait for the host vehicle to finish loading.';error.hidden=false;return;}action('ready',{ready:!room?.players.find(p=>p.id===id)?.ready});};document.getElementById('start-race').onclick=()=>action('startRace');document.getElementById('rematch-race').onclick=()=>action('rematch');document.getElementById('end-race').onclick=()=>action('cancelRace');document.getElementById('leave-online').onclick=()=>action('leave');
 document.getElementById('copy-invite').onclick=async()=>{const url=new URL(location.href);url.searchParams.set('room',room.code);try{await navigator.clipboard.writeText(url.href);document.getElementById('copy-invite').textContent='Invite link copied';}catch{error.textContent=`Room code: ${room.code}`;error.hidden=false;}};
 function renderDirectory(){
  const list=document.getElementById('online-player-names'),button=document.getElementById('online-count'),targets=document.getElementById('invite-players');list.replaceChildren();targets.replaceChildren();
  const unique=[...new Map(onlinePlayers.filter(p=>p.connected).map(p=>[p.id,p])).values()];button.textContent=`${unique.length} ${unique.length===1?'player':'players'} online`;
  for(const p of unique){const li=document.createElement('li');li.textContent=p.name+(p.id===id?' (you)':'');list.append(li);}
  const canInvite=room?.hostId===id&&room?.phase==='lobby';document.getElementById('invite-online').hidden=!canInvite;
  if(canInvite)for(const p of unique.filter(p=>p.id!==id&&p.available)){const li=document.createElement('li'),who=document.createElement('span'),invite=document.createElement('button');who.textContent=p.name;invite.textContent='Invite';invite.onclick=()=>{action('invite',{playerId:p.id});invite.disabled=true;};li.append(who,invite);targets.append(li);}
  if(canInvite&&!targets.children.length){const li=document.createElement('li');li.textContent='No other free-roam players available.';targets.append(li);}
 }
 document.getElementById('online-count').onclick=()=>{const panel=document.getElementById('online-player-list');panel.hidden=!panel.hidden;document.getElementById('online-count').setAttribute('aria-expanded',String(!panel.hidden));action('listOnline');};
 document.getElementById('invite-online').onclick=()=>{const list=document.getElementById('invite-players');list.hidden=!list.hidden;action('listOnline');};
 for(const [id,accept] of [['accept-invite',true],['reject-invite',false]])document.getElementById(id).onclick=()=>{if(pendingInvite)action('answerInvite',{inviteId:pendingInvite.id,accept});pendingInvite=null;document.getElementById('race-invitation').hidden=true;};
 try{const saved=JSON.parse(localStorage.getItem('offride-last-pose'));if(saved?.p?.length===3&&saved?.q?.length===4&&[...saved.p,...saved.q].every(Number.isFinite)&&Math.abs(saved.p[0])<456&&Math.abs(saved.p[2])<456){hasWorldPose=true;onRestore(saved);}}catch{}
 function connect(){
  ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/multiplayer`);id=null;render();
  ws.onopen=()=>{retry=0;send({type:'hello',token,version:3});};ws.onmessage=event=>{let m;try{m=JSON.parse(event.data);}catch{return;}if(Number.isFinite(m.serverTime))clockOffset=m.serverTime-Date.now();
   if(m.type==='welcome'){const previousMode=mode;id=m.id;token=m.token;localStorage.setItem('offride-session',token);sessionStorage.setItem('fc-session',token);seq=0;if(m.mode){mode=m.mode;setRoom(m.room);if(m.restore)onRestore(m.restore);if(['racing','countdown'].includes(m.room?.phase))close();}else{mode=null;room=null;remotes.clear();document.getElementById('online-count').textContent='';}render();if(!m.mode&&previousMode==='free')action('joinFree');if(!m.mode&&previousMode==='room'){error.textContent='Your previous room is no longer available. Create or join a room again.';error.hidden=false;open();}const code=new URL(location.href).searchParams.get('room');if(code&&!m.mode){document.getElementById('join-code').value=code;open();}}
   if(m.type==='joined'){hasWorldPose=true;mode=m.mode;room=null;remotes.clear();if(m.restore)onRestore(m.restore);else if(m.spawn)onGrid(m.spawn);if(m.mode==='free')close();else open();render();}
   if(m.type==='room'){const prior=room?.phase;setRoom(m.room);if(['countdown','racing'].includes(room.phase)&&prior!==room.phase)close();if(room.phase==='results'&&prior!=='results')open();}
   if(m.type==='snapshot'){remotes.receive(m.players.filter(p=>p.id!==id));}
   if(m.type==='grid'){onGrid(m.pose);close();}
   if(m.type==='left'){mode=null;room=null;remotes.clear();const url=new URL(location.href);url.searchParams.delete('room');history.replaceState(null,'',url);render();}
   if(m.type==='error'){error.textContent=m.message;error.hidden=false;if(!dialog.open)open();}
   if(m.type==='directory'){onlinePlayers=m.players;renderDirectory();}
   if(m.type==='invitation'){pendingInvite=m.invitation;document.getElementById('invite-message').textContent=`${pendingInvite.host} invited you to a race. Room ${pendingInvite.code}`;document.getElementById('race-invitation').hidden=false;}
   if(m.type==='notice'){document.getElementById('invite-status').textContent=m.message;}
   if(m.type==='pong')rtt=Date.now()-m.sent;
  };
  ws.onclose=event=>{if(stopped)return;remotes.clear();id=null;if(event?.code===4001){stopped=true;mode=null;room=null;remotes.clear();render();error.textContent='Driving is active in another tab. Reload this tab to take over.';error.hidden=false;open();return;}if(event?.code===4002){location.reload();return;}render();document.getElementById('online-count').textContent='Connection interrupted · Reconnecting';clearTimeout(reconnectTimer);reconnectTimer=setTimeout(connect,Math.min(10000,500*2**retry++));};ws.onerror=()=>{};
 }
 function publish(){
  if(stopped)return;
  const now=Date.now();if(pendingInvite&&now+clockOffset>pendingInvite.expires){pendingInvite=null;document.getElementById('race-invitation').hidden=true;}
  if(id&&now-lastPing>3000){lastPing=now;send({type:'ping',sent:now});}
  if(id&&mode&&isReady()&&now-lastSend>=50){lastSend=now;send({type:'state',seq:++seq,state:{...getState(),vehicle:getVehicle()}});if(now-lastSaved>1000){lastSaved=now;localStorage.setItem('offride-last-pose',JSON.stringify(getState()));}}
 }
 // Publish independently of rendering; paused menus and throttled frames still have a pose.
 const publishTimer=setInterval(publish,50);window.addEventListener('pagehide',()=>{clearInterval(publishTimer);clearTimeout(reconnectTimer);stopped=true;ws?.close(1000,'Page closed');},{once:true});
 function update(dt,position){
  if(room?.vehicle)renderVehicleReady();
  publish();remotes.update(dt,position);const serverNow=Date.now()+clockOffset;
  if(mode==='room'&&room?.race&&['countdown','racing','results'].includes(room.phase)){
   const race=room.race,me=race.progress.find(p=>p.id===id),count=race.course.checkpoints.length;raceHud.hidden=false;let text;
   if(room.phase==='countdown')text=serverNow<race.startAt?`Race starts in ${Math.ceil((race.startAt-serverNow)/1000)}`:'GO!';
   else if(room.phase==='results')text='Race complete';else text=me?.finishedAt?`Finished · ${formatTime(me.finishedAt-race.startAt)}`:`${formatTime(serverNow-race.startAt)} · Gate ${(me?.checkpoint||0)+1}/${count}`;
   if(text!==lastHud){raceHud.textContent=text;lastHud=text;}
   showCheckpoint(room.phase==='racing'&&!me?.finishedAt?{point:race.course.checkpoints[me?.checkpoint||0],next:race.course.checkpoints[(me?.checkpoint||0)+1],finish:(me?.checkpoint||0)===count-1}:null);
  }
 }
 function renderVehicleReady(){const pending=getVehicle()!==room.vehicle||!isReady(),connected=ws?.readyState===WebSocket.OPEN&&id;if(room.phase==='lobby'){const hint=`${room.players.length}/5 drivers · Everyone uses the host’s vehicle.${pending?' Loading vehicle…':' At least two drivers must be ready.'}`;if(document.getElementById('room-hint').textContent!==hint)document.getElementById('room-hint').textContent=hint;}document.getElementById('ready-race').disabled=!connected||pending;document.getElementById('start-race').disabled=!connected||pending||room.players.length<2||!room.players.every(p=>p.connected&&p.ready);}
 connect();open();return{update,open,get active(){return!!mode;}};
}
