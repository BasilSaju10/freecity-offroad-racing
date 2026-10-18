// A short, non-looping rush of water with damped bubble transients.
export function createWaterEntryBuffer(context){
 const rate=context.sampleRate,length=Math.ceil(rate*1.15),buffer=context.createBuffer(1,length,rate),data=buffer.getChannelData(0);
 const bubbles=Array.from({length:9},(_,i)=>({start:.025+i*.055+Math.random()*.025,frequency:260+Math.random()*620}));
 let low=0,slow=0,peak=0;
 for(let i=0;i<length;i++){
  const t=i/rate,alpha=1-Math.exp(-2*Math.PI*(2100*Math.exp(-t*2)+350)/rate);
  low+=alpha*(Math.random()*2-1-low);slow+=.004*(low-slow);
  let sample=(low-slow)*(1-Math.exp(-t*100))*Math.exp(-t*4.4);
  for(const b of bubbles){const age=t-b.start;if(age>0&&age<.17)sample+=Math.sin(2*Math.PI*b.frequency*(1-Math.exp(-age*13))/13)*Math.exp(-age*32)*.075;}
  data[i]=sample;peak=Math.max(peak,Math.abs(sample));
 }
 for(let i=0;i<length;i++)data[i]*=.85/Math.max(.001,peak)*Math.min(1,(length-1-i)/(rate*.09));
 return buffer;
}
