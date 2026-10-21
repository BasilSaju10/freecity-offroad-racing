export function minimapPoint(bounds,x,z,size=192){
 return {x:(x-bounds.minX)/(bounds.maxX-bounds.minX)*size,y:(z-bounds.minZ)/(bounds.maxZ-bounds.minZ)*size};
}

// Bake terrain and actual roads once; live updates only draw the player marker.
export function createMinimap(canvas,map){
 const size=192,b=map.meta.bounds,background=document.createElement('canvas');background.width=background.height=512;
 const bg=background.getContext('2d'),image=bg.createImageData(512,512),heights=map.ground.shapes[0].data,lo=Math.min(...heights.map(row=>Math.min(...row))),hi=Math.max(...heights.map(row=>Math.max(...row)));
 for(let y=0;y<512;y++)for(let x=0;x<512;x++){
  const wx=b.minX+x/511*(b.maxX-b.minX),wz=b.minZ+y/511*(b.maxZ-b.minZ),h=map.heightAt(wx,wz),slope=map.heightAt(wx+.8,wz)-map.heightAt(wx-.8,wz),t=(h-lo)/Math.max(1,hi-lo),i=(y*512+x)*4;
  const shade=Math.max(.65,Math.min(1.25,1-slope*.2));image.data[i]=(44+t*30)*shade;image.data[i+1]=(65+t*34)*shade;image.data[i+2]=(49+t*25)*shade;image.data[i+3]=255;
 }
 bg.putImageData(image,0,0);const paths=[map.meta.trail,...map.meta.routes.map(r=>r.points)];
 function roads(color,width){bg.strokeStyle=color;bg.lineWidth=width;bg.lineCap='round';bg.lineJoin='round';for(const path of paths){bg.beginPath();for(let i=0;i<path.length;i++){const p=minimapPoint(b,path[i].x,path[i].z,512);if(i)bg.lineTo(p.x,p.y);else bg.moveTo(p.x,p.y);}bg.stroke();}}
 roads('#172c25',6);roads('#d6c899',3);
 const ctx=canvas.getContext('2d');let clock=1,gate=null;
 function setCheckpoint(value){gate=value?.point||null;clock=1;}
 function update(dt,position,forward){
  clock+=dt;if(clock<.1)return;clock=0;ctx.setTransform(2,0,0,2,0,0);ctx.clearRect(0,0,size,size);ctx.drawImage(background,0,0,size,size);
  if(gate){const p=minimapPoint(b,gate[0],gate[2]);ctx.strokeStyle='#9cf2bd';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,6,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#9cf2bd';ctx.beginPath();ctx.arc(p.x,p.y,2,0,Math.PI*2);ctx.fill();}
  const p=minimapPoint(b,position.x,position.z);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(forward.x,-forward.z));ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(6,6);ctx.lineTo(0,3);ctx.lineTo(-6,6);ctx.closePath();ctx.fillStyle='#fff4c4';ctx.strokeStyle='#10251d';ctx.lineWidth=2;ctx.stroke();ctx.fill();ctx.restore();
  ctx.fillStyle='#182b27e6';ctx.beginPath();ctx.arc(177,15,10,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff4d9';ctx.font='bold 11px sans-serif';ctx.textAlign='center';ctx.fillText('N',177,19);
  ctx.strokeStyle='#fff4d9';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(12,174);ctx.lineTo(12+50/(b.maxX-b.minX)*size,174);ctx.stroke();ctx.font='9px sans-serif';ctx.textAlign='left';ctx.fillText('50 m',12,186);
 }
 return {update,setCheckpoint};
}
