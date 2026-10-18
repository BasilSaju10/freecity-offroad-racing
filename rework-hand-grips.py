"""Rounded, closed palms and curled fingers fitted around a 20 cm wheel rim."""
import json,struct,pathlib
import numpy as np
vertices=[];normals=[];triangles=[]
def sphere(center,radius,rings=12,sides=20):
 start=len(vertices)
 for i in range(rings+1):
  a=np.pi*i/rings
  for k in range(sides+1):
   b=2*np.pi*k/sides;n=np.array([np.sin(a)*np.cos(b),np.cos(a),np.sin(a)*np.sin(b)])
   vertices.append(np.array(center)+n*np.array(radius));normal=n/np.array(radius);normals.append(normal/np.linalg.norm(normal))
 for i in range(rings):
  for k in range(sides):
   a=start+i*(sides+1)+k;b=a+sides+1;triangles.extend([[a,a+1,b],[a+1,b+1,b]])
def tube(points,radius):
 points=np.asarray(points);curve=[]
 p=np.concatenate([points[:1],points,points[-1:]])
 for i in range(1,len(p)-2):
  a,b,c,d=p[i-1:i+3]
  for t in np.linspace(0,1,7,endpoint=False):curve.append(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t))
 curve.append(points[-1]);start=len(vertices);sides=14
 for i,c in enumerate(curve):
  tangent=curve[min(i+1,len(curve)-1)]-curve[max(0,i-1)];tangent/=np.linalg.norm(tangent)
  ref=np.array([0.,1,0]) if abs(tangent[1])<.9 else np.array([1.,0,0]);u=np.cross(tangent,ref);u/=np.linalg.norm(u);v=np.cross(tangent,u)
  r=radius*(1-.22*(i/(len(curve)-1))**2)
  for a in np.linspace(0,2*np.pi,sides,endpoint=False):
   n=np.cos(a)*u+np.sin(a)*v;vertices.append(c+n*r);normals.append(n)
 for i in range(len(curve)-1):
  for k in range(sides):
   a=start+i*sides+k;b=start+i*sides+(k+1)%sides;triangles.extend([[a,b,a+sides],[b,b+sides,a+sides]])
 sphere(points[0],[radius]*3,6,14);sphere(points[-1],[radius*.78]*3,6,14)
meshes=[]
for side in [-1,1]:
 vstart=len(vertices);istart=len(triangles)
 sphere([.013,-side*.006,.031],[.036,.043,.020])
 tube([[.014,-side*.020,.035],[.012,-side*.047,.072],[.012,-side*.060,.113]],.025)
 for i in range(4):
  y=(i-1.5)*.018;radius=[.008,.009,.0087,.0072][i if side<0 else 3-i]
  tube([[.037,y,.019],[.042,y,-.001],[.027,y,-.021],[.003,y,-.025],[-.016,y,-.012]],radius)
 tube([[-.010,side*.032,.032],[-.030,side*.022,.031],[-.039,side*.003,.020],[-.031,-side*.014,.003]],.011)
 angle=np.deg2rad(150 if side<0 else 30);rotation=np.array([[np.cos(angle),-np.sin(angle),0],[np.sin(angle),np.cos(angle),0],[0,0,1]])
 origin=np.array([side*.20*.8660254,.10,0])
 for i in range(vstart,len(vertices)):vertices[i]=rotation@vertices[i]+origin;normals[i]=rotation@normals[i]
 meshes.append((vstart,len(vertices),istart,len(triangles)))
raw=bytearray();views=[];accessors=[]
def accessor(data,kind,component):
 while len(raw)%4:raw.append(0)
 a=np.asarray(data,dtype='<f4'if component==5126 else'<u4');offset=len(raw);raw.extend(a.tobytes());view=len(views);views.append({'buffer':0,'byteOffset':offset,'byteLength':a.nbytes})
 item={'bufferView':view,'componentType':component,'count':len(a),'type':kind}
 if kind=='VEC3':item.update(min=a.min(0).tolist(),max=a.max(0).tolist())
 accessors.append(item);return len(accessors)-1
gmeshes=[]
for a,b,c,d in meshes:
 p=accessor(vertices[a:b],'VEC3',5126);n=accessor(normals[a:b],'VEC3',5126);ix=accessor((np.asarray(triangles[c:d])-a).reshape(-1),'SCALAR',5125)
 gmeshes.append({'primitives':[{'attributes':{'POSITION':p,'NORMAL':n},'indices':ix,'material':0}]})
j={'asset':{'version':'2.0','generator':'OFFRIDE fitted grip rework'},'scene':0,'scenes':[{'nodes':[0,1]}],'nodes':[{'name':'Left gripping hand','mesh':0},{'name':'Right gripping hand','mesh':1}],'meshes':gmeshes,'materials':[{'name':'Skin','doubleSided':False,'pbrMetallicRoughness':{'baseColorFactor':[.68,.4,.25,1],'metallicFactor':0,'roughnessFactor':.75}}],'buffers':[{'byteLength':len(raw)}],'bufferViews':views,'accessors':accessors}
s=json.dumps(j,separators=(',',':')).encode();s+=b' '*((-len(s))%4);raw+=b'\0'*((-len(raw))%4)
pathlib.Path('assets/hands-on-wheel.glb').write_bytes(struct.pack('<4sII',b'glTF',2,28+len(s)+len(raw))+struct.pack('<I4s',len(s),b'JSON')+s+struct.pack('<I4s',len(raw),b'BIN\0')+raw)
print({'vertices':len(vertices),'triangles':len(triangles),'hands':2,'wheelMeshes':0})
