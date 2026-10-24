export function createMinimap(map,doc=document){
 const panel=doc.createElement('section');panel.className='minimap';panel.setAttribute('aria-label','Minimap with online player locations');
 const heading=doc.createElement('div');heading.className='minimap-heading';heading.textContent='TRAIL MAP';const north=doc.createElement('span');north.textContent='N';heading.append(north);
 const canvas=doc.createElement('canvas');canvas.width=canvas.height=440;const status=doc.createElement('div');status.className='minimap-status';panel.append(heading,canvas,status);doc.body.append(panel);
 const ctx=canvas.getContext('2d'),base=doc.createElement('canvas');base.width=base.height=440;const bg=base.getContext('2d');
 const size=map.meta.size,minX=map.meta.minX??-size/2,maxZ=map.meta.maxZ??size/2,scale=404/size;
 const project=(x,z)=>({x:18+(x-minX)*scale,y:18+(maxZ-z)*scale});
 bg.fillStyle='#283d34';bg.fillRect(0,0,440,440);
 // Existing terrain data is sampled once; no additional asset downloads.
 for(let y=0;y<404;y+=4)for(let x=0;x<404;x+=4){const h=map.heightAt(minX+x/scale,maxZ-y/scale);bg.fillStyle=`hsl(95 15% ${Math.max(22,Math.min(40,25+h*.12))}%)`;bg.fillRect(x+18,y+18,4,4);}
 function route(points,width,color){if(!points?.length)return;bg.beginPath();points.forEach((p,i)=>{const a=project(p.x,p.z);i?bg.lineTo(a.x,a.y):bg.moveTo(a.x,a.y);});bg.strokeStyle=color;bg.lineWidth=Math.max(2,width*scale);bg.lineJoin=bg.lineCap='round';bg.stroke();}
 route(map.meta.trail,9,'#c1a47b');for(const r of map.meta.routes||[])route(r.points,r.width||7,r.kind==='rock'?'#a8aaa0':'#b49b76');
 for(const p of map.meta.pools||[]){const a=project(p.x,p.z);bg.beginPath();bg.ellipse(a.x,a.y,Math.max(2,p.rx*scale),Math.max(2,p.rz*scale),0,0,Math.PI*2);bg.fillStyle='#719d9c';bg.fill();}
 let peers=[],clock=1;
 function receive(players){peers=players.filter(p=>p.connected&&p.state?.p?.length===3&&p.state.p.every(Number.isFinite)).map(p=>({name:String(p.name||'Driver'),p:[...p.state.p]}));}
 function update(dt,position,q){clock+=dt;if(clock<.1)return;clock=0;ctx.clearRect(0,0,440,440);ctx.drawImage(base,0,0);ctx.font='20px sans-serif';ctx.textBaseline='middle';
  for(const peer of peers){const a=project(peer.p[0],peer.p[2]);a.x=Math.max(12,Math.min(428,a.x));a.y=Math.max(12,Math.min(428,a.y));ctx.beginPath();ctx.arc(a.x,a.y,7,0,Math.PI*2);ctx.fillStyle='#78d4f4';ctx.fill();ctx.strokeStyle='#132d2d';ctx.lineWidth=3;ctx.stroke();const name=peer.name.slice(0,14),tx=Math.max(6,Math.min(434-ctx.measureText(name).width,a.x+12)),ty=Math.max(14,a.y-17);ctx.lineWidth=5;ctx.strokeStyle='#162c26';ctx.strokeText(name,tx,ty);ctx.fillStyle='#f4f7ed';ctx.fillText(name,tx,ty);}
  const a=project(position.x,position.z),yaw=Math.atan2(2*(q.x*q.z+q.w*q.y),1-2*(q.x*q.x+q.y*q.y));
  ctx.save();ctx.translate(Math.max(12,Math.min(428,a.x)),Math.max(12,Math.min(428,a.y)));ctx.rotate(-yaw);ctx.beginPath();ctx.moveTo(0,-12);ctx.lineTo(9,10);ctx.lineTo(0,5);ctx.lineTo(-9,10);ctx.closePath();ctx.fillStyle='#f5cd6b';ctx.fill();ctx.strokeStyle='#26362b';ctx.lineWidth=3;ctx.stroke();ctx.restore();
  status.textContent=peers.length?`Gold: you / Blue: ${peers.length} online`:'Gold: you / No other drivers in this session';canvas.setAttribute('aria-label',`Your location and ${peers.length} online drivers: ${peers.map(p=>p.name).join(', ')}`);
 }
 return{receive,update,clear(){peers=[];clock=1;},project,destroy(){panel.remove();}};
}
