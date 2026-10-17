// Imported wheel texture alpha can store surface data instead of transparency.
// Tyres, rims, brakes and spare-wheel covers are solid; spoke openings remain geometry.
export function solidifyWheelSurfaces(pc,model,wheels,brakes){
 const materials=new Set();
 for(const part of [...wheels,...brakes])if(part)for(const render of part.findComponents('render'))for(const mi of render.meshInstances)materials.add(mi.material);
 for(const render of model.findComponents('render'))for(const mi of render.meshInstances)if(/tyre|tire|rubber|borracha|rowerwheel/i.test(mi.material.name))materials.add(mi.material);
 for(const m of materials){
  m.blendType=pc.BLEND_NONE;m.opacity=1;m.opacityMap=null;m.opacityVertexColor=false;
  m.alphaTest=0;m.alphaToCoverage=false;m.depthWrite=true;m.cull=pc.CULLFACE_NONE;
  m.refraction=0;m.useDynamicRefraction=false;m.update();
 }
 return materials.size;
}
