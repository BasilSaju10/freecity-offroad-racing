const mapRoot='assets/gamblers/';
export const assetPath=path=>path.replace(/^\.\//,'');

export function coreAssetFiles(manifest){
 return manifest.files.filter(f=>!f.path.startsWith(mapRoot+'textures/')&&!f.path.startsWith(mapRoot+'compressed/')&&!f.path.endsWith('/texture-sources.json'));
}

// Resolve the same image references used by the terrain, roads and model loaders.
// A GPU uses either the original BC7 file or its pixel-identical PNG fallback.
export function requiredMapTextures(manifest,scene,bptc){
 const paths=new Set(),add=p=>{if(p)paths.add(p);};
 for(const ground of scene.ground)for(const p of Object.values(ground.maps))add(p);
 for(const road of scene.roads){add(road.texture);add(road.opacity);}
 for(const entry of Object.values(scene.materialMaps))for(const p of Object.values(entry.maps))add(p);
 for(const entry of Object.values(scene.opacityMaps))add(entry.texture);
 for(const file of manifest.files)if(file.path.startsWith(mapRoot+'models/'))for(const dependency of file.dependencies||[])add(dependency.slice(mapRoot.length));
 const selected=new Set([...paths].map(p=>mapRoot+(bptc&&scene.nativeTextures[p]?scene.nativeTextures[p].url:p)));
 const byPath=new Map(manifest.files.map(f=>[f.path,f]));
 return [...selected].map(path=>{const file=byPath.get(path);if(!file)throw Error('Missing required texture in manifest: '+path);return file;});
}
