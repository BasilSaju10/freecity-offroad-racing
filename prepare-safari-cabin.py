import pathlib,json,struct
p=pathlib.Path('assets/safari.glb');b=p.read_bytes();n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n]);raw=b[28+n:]
for node in j['nodes']:
 if node.get('name')=='Body':
  m=j['meshes'][node['mesh']];before=len(m['primitives']);m['primitives']=[x for x in m['primitives'] if j['materials'][x.get('material',0)].get('name')!='Charcoal cabin'];print('Removed oversized placeholder dashboard:',before-len(m['primitives']))
s=json.dumps(j,separators=(',',':')).encode();s+=b' '*((-len(s))%4);p.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(s)+len(raw))+struct.pack('<I4s',len(s),b'JSON')+s+struct.pack('<I4s',len(raw),b'BIN\0')+raw)
