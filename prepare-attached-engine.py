"""Keep the user's full engine recording with one crossfaded loop junction."""
import json,pathlib,wave
import numpy as np
import miniaudio
rate=44100
audio=miniaudio.decode_file('assets/audio/acceleration-source.mp3',output_format=miniaudio.SampleFormat.FLOAT32,nchannels=2,sample_rate=rate)
x=np.asarray(audio.samples,dtype=np.float64).reshape(-1,2)
x-=x.mean(axis=0)
x*=.88/max(1e-8,np.max(np.abs(x)))
n=int(rate*.65)
fade=(.5-.5*np.cos(np.linspace(0,np.pi,n)))[:,None]
x[-n:]=x[-n:]*(1-fade)+x[:n]*fade
with wave.open('assets/audio/acceleration-loop.wav','wb') as f:
 f.setnchannels(2);f.setsampwidth(2);f.setframerate(rate);f.writeframes(np.round(x*32767).astype('<i2').tobytes())
config={'loopStart':n/rate,'loopEnd':len(x)/rate}
pathlib.Path('engine-loop-config.js').write_text('export const engineLoopConfig='+json.dumps(config)+';\n')
print({'fullRecordingSeconds':len(x)/rate,'sustainSeconds':(len(x)-n)/rate,'junctionCrossfadeSeconds':n/rate})
