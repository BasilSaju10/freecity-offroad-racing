import json,struct,pathlib,numpy as np
p=pathlib.Path(r'C:/Users/basil/Downloads/hands_on_wheel.glb');b=p.read_bytes();n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n]);raw=b[28+n:]
j['scenes']=[{'nodes':[86,87]}];j['scene']=0
j['nodes'] += [{'name':'Left supplied hand','children':list(range(5,45)),'rotation':[0,0,.2588190451,.9659258263]},{'name':'Right supplied hand','children':list(range(46,86)),'rotation':[0,0,-.2588190451,.9659258263]}]
j['materials']=[{'name':'Supplied hand vertex colours','pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'metallicFactor':0,'roughnessFactor':.75},'doubleSided':True}]
for m in j['meshes']:
 for p in m['primitives']:p['material']=0
j['buffers'][0]['byteLength']=len(raw);s=json.dumps(j,separators=(',',':')).encode();s+=b' '*((-len(s))%4);raw+=b'\0'*((-len(raw))%4)
pathlib.Path('assets/hands-on-wheel.glb').write_bytes(struct.pack('<4sII',b'glTF',2,28+len(s)+len(raw))+struct.pack('<I4s',len(s),b'JSON')+s+struct.pack('<I4s',len(raw),b'BIN\0')+raw)
print('Imported supplied hands, excluded duplicate wheel and asymmetric forearm.')
