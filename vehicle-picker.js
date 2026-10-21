export function createVehiclePicker(profiles,select,onOpenChange){
 const dialog=document.getElementById('vehicle-picker'),trigger=document.getElementById('more-vehicles'),list=document.getElementById('vehicle-list'),status=document.getElementById('picker-status');
 const buttons=new Map();
 for(const [id,profile] of Object.entries(profiles)){
  const button=document.createElement('button');button.type='button';button.className='vehicle-choice';button.dataset.vehicle=id;
  const name=document.createElement('strong');name.textContent=profile.label;const state=document.createElement('span');button.append(name,state);list.append(button);buttons.set(id,button);
  button.addEventListener('click',()=>{dialog.close();select(id);});
 }
 trigger.addEventListener('click',()=>{onOpenChange(true);dialog.showModal();});
 document.getElementById('close-picker').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>onOpenChange(false));
 dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
 return{update(active,loading,pending){
  for(const [id,button] of buttons){button.disabled=loading;button.setAttribute('aria-current',String(id===active));button.lastElementChild.textContent=loading&&id===pending?'LOADING…':id===active?'DRIVING':'SELECT';}
  trigger.disabled=loading;trigger.setAttribute('aria-busy',String(loading));trigger.firstChild.textContent=loading?'Loading vehicle… ':'More vehicles ';
  status.textContent=loading?'Preparing your vehicle…':`${Object.values(profiles).filter(p=>!p.bike).length} vehicles · ${Object.values(profiles).filter(p=>p.bike).length} bikes · Independent suspension`;
 }};
}
