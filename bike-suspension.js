// Wheel hubs translate with suspension, but only tyres/rims/discs rotate with rolling.
export function updateBikeSuspension(model,profile,scale,lengths,steering){
 const frontDelta=.12-lengths[0]/scale-profile.wheelCenters[0][1];
 const fork=model.findByName('FrontFork'),upper=model.findByName('ForkUpper');
 if(fork){const o=profile.forkOrigin;fork.setLocalPosition(o[0],o[1]+frontDelta,o[2]);fork.setLocalEulerAngles(0,steering*180/Math.PI,0);}
 if(upper){upper.setLocalPosition(...profile.forkOrigin);upper.setLocalEulerAngles(0,steering*180/Math.PI,0);}
 const swing=model.findByName('Swingarm');
 if(swing){
  const origin=profile.swingOrigin,wheel=profile.wheelCenters[1];
  const rest=Math.atan2(wheel[1]-origin[1],wheel[2]-origin[2]);
  const target=Math.atan2(.12-lengths[1]/scale-origin[1],wheel[2]-origin[2]);
  swing.setLocalPosition(...origin);swing.setLocalEulerAngles((rest-target)*180/Math.PI,0,0);
 }
}
