export function applyBurnoutDrift(C,body,turn,dt){
 const forward=body.quaternion.vmult(new C.Vec3(0,0,-1));forward.y=0;forward.normalize();const right=new C.Vec3(-forward.z,0,forward.x),moving=Math.abs(turn)>.01;
 const target=forward.scale(moving?2.4:0).vadd(right.scale(-turn*2.8));
 const alpha=1-Math.exp(-dt*5);body.velocity.x+=(target.x-body.velocity.x)*alpha;body.velocity.z+=(target.z-body.velocity.z)*alpha;
 body.angularVelocity.y+=(turn*1.2-body.angularVelocity.y)*(1-Math.exp(-dt*8));
}
