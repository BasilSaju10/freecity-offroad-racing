import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const elements=new Map(),sockets=[],timers=[],retries=[];
function element(){return{open:false,value:'',textContent:'',hidden:false,style:{},querySelectorAll:()=>[],replaceChildren(){},append(){},showModal(){this.open=true;},close(){this.open=false;this.onclose?.();},addEventListener(type,fn){this['on'+type]=fn;}};}
const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:element,exitPointerLock(){}};
class Socket{static OPEN=1;constructor(){this.readyState=1;this.sent=[];sockets.push(this);}send(raw){this.sent.push(JSON.parse(raw));}}
const storage=()=>({getItem:()=>null,setItem(){}});
const source=readFileSync(new URL('./multiplayer-client.js',import.meta.url),'utf8').replace('export function','function');
const factory=new Function('document','window','WebSocket','sessionStorage','localStorage','location','history','setInterval','clearInterval','setTimeout','clearTimeout',source+';return createMultiplayer;');
const create=factory(document,{addEventListener(){}},Socket,storage(),storage(),{protocol:'https:',host:'test.invalid',href:'https://test.invalid/'},{replaceState(){}},fn=>{timers.push(fn);return 1;},()=>{},fn=>{retries.push(fn);return 1;},()=>{});
create({getState:()=>({p:[0,1,0],q:[0,0,0,1]}),getVehicle:()=> 'suv',isReady:()=>true,onGrid(){},onLock(){},onMenu(){},remotes:{clear(){},receive(){},update(){}},showCheckpoint(){}});
const message=(ws,data)=>ws.onmessage({data:JSON.stringify(data)});
const first=sockets[0];first.onopen();message(first,{type:'welcome',id:'one',token:'token',mode:null});document.getElementById('join-free').onclick();message(first,{type:'joined',mode:'free',spawn:{x:0,z:0,yaw:0}});
timers[0]();assert(first.sent.some(m=>m.type==='state'),'publishes a stationary pose without rendering a frame');
first.onclose();retries.shift()();const second=sockets[1];second.onopen();message(second,{type:'welcome',id:'two',token:'new',mode:null});assert(second.sent.some(m=>m.type==='joinFree'),'automatically rejoins free roam after server loses session');
message(second,{type:'joined',mode:'free'});document.getElementById('create-room').onclick();message(second,{type:'joined',mode:'room'});second.onclose();retries.shift()();const third=sockets[2];third.onopen();message(third,{type:'welcome',id:'three',token:'newer',mode:null});assert(document.getElementById('online-dialog').open,'opens mode chooser when room expired');assert.match(document.getElementById('online-error').textContent,/no longer available/);assert.equal(document.getElementById('online-count').textContent,'','clears stale online count');
console.log('Client lifecycle: publishes without frames, rejoins free roam, explains expired rooms.');
