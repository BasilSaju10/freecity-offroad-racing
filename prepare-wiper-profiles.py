import json,pathlib,struct,re,numpy as np
profiles=json.loads(pathlib.Path('../local-vehicle-profiles.json').read_text());out={}
for key,p in profiles.items():
 b=pathlib.Path(p['url']).read_bytes();n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n]);raw=b[28+n:];points=[]
 for node in j['nodes']:
  if node.get('name')!='Body':continue
  for prim in j['meshes'][node['mesh']]['primitives']:
   name=j['materials'][prim.get('material',0)].get('name','')
   if not re.search(r'glass|window|windscreen|transl',name,re.I) or re.search(r'headlight|taillight|lamp|red_glass|orange_glass|fari|zad',name,re.I):continue
   a=j['accessors'][prim['attributes']['POSITION']];v=j['bufferViews'][a['bufferView']]
   x=np.ndarray((a['count'],3),dtype='<f4',buffer=raw,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',12),4))
   e=p['cockpitEye'];x=x[(np.abs(x[:,0])<.45)&(x[:,1]>e[1]-.4)&(x[:,1]<e[1]+.22)&(x[:,2]<e[2]-.18)&(x[:,2]>e[2]-1.6)]
   if len(x):points.append(x)
 e=p['cockpitEye'];y=e[1]-.32;z=e[2]-.7;slope=.65;length=.48;measured=False
 if points:
  x=np.concatenate(points);a,b=np.polyfit(x[:,1],x[:,2],1) if np.ptp(x[:,1])>.15 else(.65,z-.65*y)
  if .05<a<2.5 and np.std(x[:,2]-a*x[:,1]-b)<.12 and np.ptp(x[:,1])>.18:
   y=float(np.quantile(x[:,1],.05))+.025;z=float(a*y+b)-.025;slope=float(a);length=float(np.clip(np.ptp(x[:,1])*.9,.34,.57));measured=True
 if key=='safari':y=.66;z=-.895;slope=.82;length=.48;measured=True
 out[key]={'y':round(y,4),'z':round(z,4),'slope':round(slope,4),'length':round(length,4),'measured':measured}
 print(key,out[key])
pathlib.Path('wiper-profiles.js').write_text('export const wiperProfiles='+json.dumps(out)+';\n')
