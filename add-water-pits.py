"""Add shallow route crossings to the visual terrain and its collision heightfield."""
import json,pathlib,struct
import numpy as np
folder=pathlib.Path('assets/map');meta=json.loads((folder/'physics.json').read_text())
if any(p.get('addedCrossing')for p in meta['pools']):raise SystemExit('Additional crossings already applied.')
n=meta['n'];step=meta['step'];old=np.frombuffer((folder/'heights.bin').read_bytes(),dtype='<f4').reshape(n,n).copy();heights=old.copy()
def height(h,x,z):
 u=np.clip((np.asarray(x)-meta['minX'])/step,0,n-1.00001);v=np.clip((meta['maxZ']-np.asarray(z))/step,0,n-1.00001);i=u.astype(int);k=v.astype(int);a=u-i;b=v-k
 return np.where(a+b<=1,h[i,k]+(h[i+1,k]-h[i,k])*a+(h[i,k+1]-h[i,k])*b,h[i+1,k+1]+(h[i,k+1]-h[i+1,k+1])*(1-a)+(h[i+1,k]-h[i+1,k+1])*(1-b))
walls=np.array([[w['ax'],w['az'],w['bx'],w['bz']]for w in meta['walls']]);scenery=np.array([[s['position'][0],s['position'][2]]for s in meta['scenery']]);chosen=[]
def clear(x,z):
 a=walls[:,:2];d=walls[:,2:]-a;t=np.clip(np.sum((np.array([x,z])-a)*d,axis=1)/np.maximum(1e-8,np.sum(d*d,axis=1)),0,1)
 return np.min(np.linalg.norm(np.array([x,z])-a-d*t[:,None],axis=1))>10 and np.min(np.linalg.norm(scenery-[x,z],axis=1))>11
preferred=['Dirt playground loop','Water valley connector','Western forest switchbacks','Forest ridge route','Southern perimeter link']
for name in preferred:
 route=next(r for r in meta['routes']if r['name']==name);candidates=[]
 for point in route['points'][2:-2:2]:
  x,z=point['x'],point['z']
  if np.hypot(x-meta['spawn']['x'],z-meta['spawn']['z'])<100:continue
  if any(np.hypot(x-p['x'],z-p['z'])<35 for p in meta['pools']+chosen)or not clear(x,z):continue
  a=np.linspace(0,2*np.pi,24);ys=height(old,x+np.cos(a)*7,z+np.sin(a)*5)
  if np.ptp(ys)>1.5:continue
  candidates.append((float(np.ptp(ys)),x,z,float(np.median(ys))))
 if not candidates:continue
 _,x,z,y=min(candidates);chosen.append({'x':round(x,4),'z':round(z,4),'rx':7,'rz':5,'y':round(y-.03,5),'depth':.36,'addedCrossing':True,'route':name})
assert len(chosen)>=4, f'Not enough safe crossing sites: {chosen}'
for p in chosen:
 lo=max(0,int((p['x']-10-meta['minX'])/step));hi=min(n,int((p['x']+10-meta['minX'])/step)+1)
 iz=max(0,int((meta['maxZ']-p['z']-8)/step));jz=min(n,int((meta['maxZ']-p['z']+8)/step)+1)
 ii,kk=np.meshgrid(np.arange(lo,hi),np.arange(iz,jz),indexing='ij');x=meta['minX']+ii*step;z=meta['maxZ']-kk*step;r=np.sqrt(((x-p['x'])/p['rx'])**2+((z-p['z'])/p['rz'])**2)
 t=np.clip((r-.52)/.48,0,1);t=t*t*(3-2*t);bed=p['y']-p['depth']+(p['depth']+.07)*t
 weight=np.clip((1.3-r)/.3,0,1);weight=weight*weight*(3-2*weight)
 heights[ii,kk]=old[ii,kk]+weight*(bed-old[ii,kk])
b=(folder/'freecity.glb').read_bytes();jn=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+jn]);raw=bytearray(b[28+jn:]);changed=0;seen=set()
def array(index,cols=3):
 a=g['accessors'][index];v=g['bufferViews'][a['bufferView']];dtype={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']];size=np.dtype(dtype).itemsize
 return np.ndarray((a['count'],cols),dtype=dtype,buffer=raw,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',cols*size),size))
for mesh in g['meshes']:
 for prim in mesh['primitives']:
  index=prim['attributes']['POSITION']
  if index in seen or prim['material']in[4,5,6]:continue
  seen.add(index);v=array(index);mask=np.zeros(len(v),dtype=bool)
  for p in chosen:mask|=((v[:,0]-p['x'])/p['rx'])**2+((v[:,2]-p['z'])/p['rz'])**2<1.3**2
  ids=np.flatnonzero(mask)
  if not len(ids):continue
  surface=height(old,v[ids,0],v[ids,2]);ids=ids[np.abs(v[ids,1]-surface)<.18]
  if not len(ids):continue
  v[ids,1]+=height(heights,v[ids,0],v[ids,2])-height(old,v[ids,0],v[ids,2]);changed+=len(ids)
  g['accessors'][index].update(min=v.min(0).tolist(),max=v.max(0).tolist())
  if 'NORMAL'in prim['attributes']:
   faces=array(prim['indices'],1).reshape(-1,3).astype(int);normal=np.zeros(v.shape);face=np.cross(v[faces[:,1]]-v[faces[:,0]],v[faces[:,2]]-v[faces[:,0]])
   for k in range(3):np.add.at(normal,faces[:,k],face)
   normal/=np.maximum(1e-10,np.linalg.norm(normal,axis=1))[:,None];array(prim['attributes']['NORMAL'])[:]=normal
del v
def append(data,kind,dtype,component):
 while len(raw)%4:raw.append(0)
 a=np.asarray(data,dtype=dtype);offset=len(raw);raw.extend(a.tobytes());view=len(g['bufferViews']);g['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':a.nbytes});item={'bufferView':view,'componentType':component,'count':len(a),'type':kind}
 if kind=='VEC3':item.update(min=a.min(0).tolist(),max=a.max(0).tolist())
 g['accessors'].append(item);return len(g['accessors'])-1
for p in chosen:
 points=[[p['x'],p['y'],p['z']]]+[[p['x']+np.cos(a)*p['rx'],p['y'],p['z']+np.sin(a)*p['rz']]for a in np.linspace(0,2*np.pi,65)]
 pos=append(points,'VEC3','<f4',5126);norm=append([[0,1,0]]*len(points),'VEC3','<f4',5126);ix=append(np.array([[0,i+2,i+1]for i in range(64)]).reshape(-1),'SCALAR','<u2',5123)
 mesh=len(g['meshes']);g['meshes'].append({'primitives':[{'attributes':{'POSITION':pos,'NORMAL':norm},'indices':ix,'material':4}]});node=len(g['nodes']);g['nodes'].append({'name':'Shallow water crossing · '+p['route'],'mesh':mesh});g['scenes'][g.get('scene',0)]['nodes'].append(node)
meta['pools']+=chosen
for route in [meta['trail']]+[r['points']for r in meta['routes']]:
 for p in route:p['y']=float(height(heights,p['x'],p['z']))
g['buffers'][0]['byteLength']=len(raw);s=json.dumps(g,separators=(',',':')).encode();s+=b' '*((-len(s))%4);raw+=b'\0'*((-len(raw))%4)
(folder/'freecity.glb').write_bytes(struct.pack('<4sII',b'glTF',2,28+len(s)+len(raw))+struct.pack('<I4s',len(s),b'JSON')+s+struct.pack('<I4s',len(raw),b'BIN\0')+raw)
(folder/'heights.bin').write_bytes(heights.astype('<f4').tobytes());(folder/'physics.json').write_text(json.dumps(meta,separators=(',',':')))
print(json.dumps({'crossingsAdded':len(chosen),'totalPools':len(meta['pools']),'terrainVerticesMatched':changed,'sites':chosen},indent=2))
