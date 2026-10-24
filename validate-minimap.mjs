import assert from 'node:assert/strict';
import {createMinimap} from './minimap.js';
const calls=[];const ctx=new Proxy({measureText:t=>({width:t.length*10})},{get:(o,k)=>k in o?o[k]:(...args)=>calls.push([k,...args])});
class Element{children=[];attrs={};append(...e){this.children.push(...e);}setAttribute(k,v){this.attrs[k]=v;}getContext(){return ctx;}remove(){}}
const doc={body:new Element(),createElement:()=>new Element()},map={meta:{size:920,minX:-460,maxZ:460,trail:[{x:0,z:0},{x:5,z:5}],routes:[],pools:[]},heightAt:()=>0};
const mm=createMinimap(map,doc),panel=doc.body.children[0],canvas=panel.children[1],pos={x:0,z:0},q={x:0,y:0,z:0,w:1};
assert.deepEqual(mm.project(0,0),{x:220,y:220});assert(mm.project(0,100).y<220,'north points up');
mm.receive([{id:'a',name:'Basil',connected:true,state:{p:[100,0,100]}},{id:'b',name:'Offline',connected:false,state:{p:[0,0,0]}},{id:'c',name:'Invalid',connected:true,state:{p:[NaN,0,0]}}]);mm.update(.1,pos,q);
assert(canvas.attrs['aria-label'].includes('1 online drivers: Basil'));assert(calls.some(c=>c[0]==='fillText'&&c[1]==='Basil'));
mm.receive([{id:'a',name:'Basil',connected:true,state:{p:[-100,0,-100]}}]);mm.update(.1,pos,q);assert(calls.some(c=>c[0]==='arc'&&c[1]<220&&c[2]>220),'moving peer updates marker');
mm.clear();mm.update(.1,pos,q);assert(canvas.attrs['aria-label'].includes('0 online drivers'));assert(panel.children[2].textContent.includes('No other drivers'));
console.log('Passed: north-up projection, named live player locations, movement updates, disconnected/invalid peers excluded, session cleanup.');
