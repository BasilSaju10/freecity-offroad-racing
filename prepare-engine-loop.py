"""Create a level, phase-aligned sustained loop from the user's rev recording."""
import json, pathlib, sys, wave
import numpy as np
import miniaudio

source=pathlib.Path(sys.argv[1])
destination=pathlib.Path('assets/audio/acceleration-loop.wav')
rate=44100
decoded=miniaudio.decode_file(str(source), output_format=miniaudio.SampleFormat.FLOAT32, nchannels=2, sample_rate=rate)
original=np.asarray(decoded.samples,dtype=np.float64).reshape(-1,2)
assert len(original)>rate*.25

def frames(x,seconds=.025):
 n=int(rate*seconds)
 return [x[i:i+n] for i in range(0,len(x)-n+1,n)]

# Choose an energetic region with the most stable volume and spectral balance.
length=min(int(rate*.58),int(len(original)*.76))
best=None
for start in range(int(rate*.04),len(original)-length-int(rate*.02),int(rate*.01)):
 x=original[start:start+length]
 blocks=frames(x)
 rms=np.array([np.sqrt(np.mean(b*b)+1e-12) for b in blocks])
 centroids=[]
 for b in blocks:
  spectrum=np.abs(np.fft.rfft(b.mean(axis=1)*np.hanning(len(b))))
  centroids.append(np.sum(spectrum*np.arange(len(spectrum)))/(spectrum.sum()+1e-12))
 score=np.std(np.log(rms+1e-8))+.35*np.std(np.log(np.array(centroids)+1e-8))
 if rms.mean()<np.sqrt(np.mean(original*original))*.6:continue
 if best is None or score<best[0]:best=(score,start)
assert best is not None
start=best[1]
section=original[start:start+length].copy()

# Search nearby cycle boundaries for maximum head/tail correlation before blending.
overlap=int(rate*.12)
head=section[:overlap].mean(axis=1)
best_end=None
for end in range(length-int(rate*.035),length+1,8):
 tail=section[end-overlap:end].mean(axis=1)
 correlation=float(np.dot(head,tail)/(np.linalg.norm(head)*np.linalg.norm(tail)+1e-12))
 if best_end is None or correlation>best_end[0]:best_end=(correlation,end)
correlation,end=best_end
section=section[:end]
fade=(.5-.5*np.cos(np.linspace(0,np.pi,overlap)))[:,None]
left,right=1-fade,fade
compensation=1/np.sqrt(np.maximum(.25,left*left+right*right+2*left*right*correlation))
blend=(section[-overlap:]*left+section[:overlap]*right)*compensation
loop=np.concatenate([section[overlap:-overlap],blend])

# Circular envelope leveling removes the repeated swell without adding an edge.
energy=np.mean(loop*loop,axis=1)
width=int(rate*.10)//2*2+1
extended=np.pad(energy,(width//2,width//2),mode='wrap')
cumulative=np.concatenate([[0.],np.cumsum(extended)])
envelope=np.sqrt(np.maximum(1e-10,(cumulative[width:]-cumulative[:-width])/width))
gain=np.clip(np.median(envelope)/envelope,.65,1.6)
loop*=gain[:,None]
loop*=.88/np.max(np.abs(loop))

# Extend the rev texture without lowering its pitch. A short loop repeats its
# changing timbre several times a second even when its volume is perfectly level.
# Phase-vocoder stretching turns that quick repeated sweep into a long sustain.
short_loop_seconds=len(loop)/rate
size,hop,stretch=2048,256,12
window=np.hanning(size)
padded=np.pad(loop,((size,size),(0,0)),mode='wrap')
spectra=np.stack([np.fft.rfft(padded[i:i+size]*window[:,None],axis=0)
 for i in range(0,len(padded)-size+1,hop)])
steps=np.arange(0,len(spectra)-1,1/stretch)
advance=2*np.pi*hop*np.arange(size//2+1)[:,None]/size
phase=np.angle(spectra[0])
stretched=np.zeros((len(steps)*hop+size,2))
weights=np.zeros(len(stretched))
for index,step in enumerate(steps):
 frame=int(step);fraction=step-frame
 a,b=spectra[frame],spectra[frame+1]
 magnitude=(1-fraction)*np.abs(a)+fraction*np.abs(b)
 block=np.fft.irfft(magnitude*np.exp(1j*phase),n=size,axis=0)
 offset=index*hop
 stretched[offset:offset+size]+=block*window[:,None]
 weights[offset:offset+size]+=window*window
 delta=np.angle(b)-np.angle(a)-advance
 delta-=2*np.pi*np.round(delta/(2*np.pi))
 phase+=advance+delta
stretched/=np.maximum(weights[:,None],1e-8)
trim=size*stretch
extended=stretched[trim:trim+int(len(loop)*stretch)]
long_join=int(rate*.4)
long_fade=(.5-.5*np.cos(np.linspace(0,np.pi,long_join)))[:,None]
loop=np.concatenate([extended[long_join:-long_join],
 extended[-long_join:]*(1-long_fade)+extended[:long_join]*long_fade])
# Level the crossfade and residual texture envelope without fast pumping.
energy=np.mean(loop*loop,axis=1)
width=int(rate*.12)//2*2+1
cumulative=np.r_[0.,np.cumsum(np.pad(energy,(width//2,width//2),mode='wrap'))]
envelope=np.sqrt(np.maximum(1e-10,(cumulative[width:]-cumulative[:-width])/width))
loop*=np.clip(np.median(envelope)/envelope,.5,2)[:,None]
loop*=.88/np.max(np.abs(loop))
pcm=np.round(np.clip(loop,-1,1)*32767).astype('<i2')
destination.parent.mkdir(parents=True,exist_ok=True)
def write_wav(path,data):
 with wave.open(str(path),'wb') as wav:
  wav.setnchannels(2);wav.setsampwidth(2);wav.setframerate(rate);wav.writeframes(data.tobytes())
# Preserve the actual attached rev as the attack, then blend into the sustained loop.
attack_source=original*(.88/np.max(np.abs(original)))
join=min(overlap,len(pcm)//3)
join_fade=(.5-.5*np.cos(np.linspace(0,np.pi,join)))[:,None]
loop_float=pcm.astype(float)/32767
bridge=attack_source[-join:]*(1-join_fade)+loop_float[:join]*join_fade
prefix=np.concatenate([attack_source[:-join],bridge])
sustain=np.concatenate([loop_float[join:],loop_float[:join]])
combined=np.concatenate([prefix,sustain])
write_wav(destination,np.round(np.clip(combined,-1,1)*32767).astype('<i2'))
loop_start=len(prefix)/rate
loop_end=len(combined)/rate
pathlib.Path('engine-loop-config.js').write_text('export const engineLoopConfig='+json.dumps({'loopStart':loop_start,'loopEnd':loop_end})+';\n')
preview=pathlib.Path('../offride-continuous-engine-preview.wav')
repeated=np.round(np.concatenate([prefix,np.tile(sustain,(int(np.ceil(rate*8/len(sustain))),1))])[:rate*8]*32767).astype('<i2')
attack=np.minimum(1,np.arange(len(repeated))/(rate*.06))
release=np.minimum(1,np.arange(len(repeated))[::-1]/(rate*.14))
write_wav(preview,np.round(repeated.astype(float)*(attack*release)[:,None]).astype('<i2'))
normal=pcm.astype(float)/32767
seam=np.max(np.abs(normal[0]-normal[-1]))
differences=np.max(np.abs(np.diff(normal,axis=0)),axis=1)
volume=np.array([np.sqrt(np.mean(b*b)) for b in frames(normal)])
report={'sourceSeconds':len(original)/rate,'originalAttackPreserved':True,'loopStart':loop_start,'loopEnd':loop_end,'selectedSourceStartSeconds':start/rate,'loopSeconds':len(loop)/rate,'crossfadeSeconds':long_join/rate,'originalShortLoopSeconds':short_loop_seconds,'timeStretchFactor':stretch,'headTailCorrelation':correlation,'seamJump':float(seam),'normalSampleStep95Percentile':float(np.percentile(differences,95)),'volumeVariation':float(volume.std()/volume.mean()),'silentFrames':int(np.sum(volume<volume.mean()*.1)),'format':'16-bit stereo PCM WAV','preview':str(preview)}
assert report['loopSeconds']>4, 'Rev repeats too quickly'
assert report['silentFrames']==0
assert seam<float(np.percentile(differences,99)), 'Loop seam is an audible outlier'
assert report['volumeVariation']<.12,'Sustained loop still has a volume surge'
pathlib.Path('../offride-engine-loop-analysis.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
