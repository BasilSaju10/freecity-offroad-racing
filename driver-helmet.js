// Red off-road helmet: peaked shell, clear eye port and a pronounced chin guard.
export function buildOffroadHelmet(pc,app,head,red,black,part){
 red.diffuse.set(.78,.035,.018);red.cull=pc.CULLFACE_NONE;red.update();
 function mesh(name,material,positions,indices){const geometry=new pc.Mesh(app.graphicsDevice);geometry.setPositions(positions);geometry.setNormals(pc.calculateNormals(positions,indices));geometry.setIndices(indices);geometry.update(pc.PRIMITIVE_TRIANGLES);const e=new pc.Entity(name);e.addComponent('render',{meshInstances:[new pc.MeshInstance(geometry,material)]});head.addChild(e);return e;}
 const positions=[],indices=[],rows=30,cols=48;
 for(let i=0;i<=rows;i++)for(let j=0;j<=cols;j++){const p=i/rows*Math.PI,t=j/cols*Math.PI*2;positions.push(Math.sin(p)*Math.sin(t)*.126,Math.cos(p)*.148,-Math.sin(p)*Math.cos(t)*.135);}
 for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){const p=(i+.5)/rows*Math.PI,t=(j+.5)/cols*Math.PI*2,y=Math.cos(p)*.148;if(Math.cos(t)>.48&&y>-.068&&y<.082)continue;const a=i*(cols+1)+j,b=a+cols+1;indices.push(a,a+1,b,a+1,b+1,b);}
 mesh('Red motocross helmet shell',red,positions,indices);
 // Broad, tapered peak sits below the crown so it cannot add height above the roof.
 mesh('Motocross peak',red,[-.115,.111,.015,.115,.111,.015,-.148,.105,-.115,.148,.105,-.115,-.105,.075,-.245,.105,.075,-.245],[0,2,1,1,2,3,2,4,3,3,4,5,1,2,0,3,2,1,3,4,2,5,4,3]);
 const chin=[-.114,-.028,-.055,.114,-.028,-.055,-.104,-.12,-.11,.104,-.12,-.11,-.062,-.06,-.184,.062,-.06,-.184,-.052,-.126,-.205,.052,-.126,-.205];
 mesh('Extended red chin guard',red,chin,[0,2,4,2,6,4,1,5,3,3,5,7,4,6,5,5,6,7,2,3,6,3,7,6]);
 mesh('Black chin vent',black,[-.035,-.065,-.188,.035,-.065,-.188,-.03,-.115,-.209,.03,-.115,-.209],[0,2,1,1,2,3]);
 for(const side of [-1,1]){
  mesh('Angular black cheek trim',black,[side*.119,.045,-.045,side*.12,-.019,-.078,side*.107,-.105,-.112,side*.085,-.038,-.155],[0,1,3,1,2,3,3,1,0,3,2,1]);
  part('Visor pivot','sphere',black,[side*.127,.04,-.008],[.019,.022,.025],head);
  part('Peak air vent','box',black,[side*.055,.113,-.075],[.025,.007,.075],head).setLocalEulerAngles(-8,0,side*5);
 }
 const visor=new pc.StandardMaterial();visor.name='Clear helmet eye port';visor.diffuse=new pc.Color(.12,.18,.21);visor.useMetalness=true;visor.metalness=.15;visor.gloss=.93;visor.opacity=.24;visor.blendType=pc.BLEND_NORMAL;visor.depthWrite=false;visor.cull=pc.CULLFACE_NONE;visor.update();
 const v=[],vi=[];
 for(let i=0;i<=8;i++)for(let j=0;j<=28;j++){const y=.07-i/8*.102,t=-.99+j/28*1.98;v.push(Math.sin(t)*.128,y,-Math.cos(t)*.144-.006);}
 for(let i=0;i<8;i++)for(let j=0;j<28;j++){const a=i*29+j,b=a+29;vi.push(a,a+1,b,a+1,b+1,b);}
 mesh('Helmet visor',visor,v,vi);
}
