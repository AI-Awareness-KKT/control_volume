"""Original instrumental for the Hand Volume Control project ("Open Hands").
Composed and synthesised from scratch with numpy, so it can be used anywhere with no licence."""
import numpy as np
from scipy.signal import fftconvolve, butter, sosfilt
SR=44100; BPM=112; BEAT=60/BPM; BAR=4*BEAT; BARS=32
N=int(round(BARS*BAR*SR)); rng=np.random.default_rng(7)
def f(note):
    names={'C':-9,'C#':-8,'D':-7,'D#':-6,'E':-5,'F':-4,'F#':-3,'G':-2,'G#':-1,'A':0,'A#':1,'B':2}
    n,o=(note[:-1],int(note[-1])); return 440*2**((names[n]+12*(o-4))/12)
def t(sec): return np.arange(int(sec*SR))/SR
def place(buf,sig,start):
    i=int(start*SR); j=min(N,i+len(sig))
    if i<N: buf[i:j]+=sig[:j-i]
def env(n,a=.005,r=.1,length=None):
    e=np.ones(n); A=max(1,int(a*SR)); e[:A]=np.linspace(0,1,A)
    R=max(1,int(r*SR)); e[-R:]*=np.linspace(1,0,R); return e
def lp(x,fc,order=2): return sosfilt(butter(order,fc,'low',fs=SR,output='sos'),x)
def hp(x,fc,order=2): return sosfilt(butter(order,fc,'high',fs=SR,output='sos'),x)
def bp(x,lo,hi): return sosfilt(butter(2,[lo,hi],'band',fs=SR,output='sos'),x)

chords=[['A3','C4','E4'],['F3','A3','C4'],['C4','E4','G4'],['G3','B3','D4']]
roots=['A1','F1','C2','G1']
pad=np.zeros(N);arp=np.zeros(N);bass=np.zeros(N);kick=np.zeros(N);snare=np.zeros(N);hats=np.zeros(N);lead=np.zeros(N)
kick_env=np.zeros(N)

def section(bar):
    if bar<4: return 'intro'
    if bar<12: return 'groove'
    if bar<20: return 'melody'
    if bar<28: return 'full'
    return 'outro'

for bar in range(BARS):
    s=section(bar); ch=chords[bar%4]; start=bar*BAR
    # Pad: soft detuned stack, swells across the bar
    tt=t(BAR+.6); sig=np.zeros(len(tt))
    for nt in ch:
        for det in (-.12,0,.12):
            fr=f(nt)*2**(det/12)
            for h in range(1,6): sig+=np.sin(2*np.pi*fr*h*tt+rng.uniform(0,6))/(h*h)
    e=env(len(tt),a=.35,r=.6); pad_level={'intro':.05,'groove':.045,'melody':.04,'full':.045,'outro':.05}[s]
    place(pad,lp(sig,2200)*e*pad_level,start)
    # Arp: 16th-note pluck over the chord, one octave up
    pattern=[0,1,2,1,0,2,1,2]*2
    for k,idx in enumerate(pattern):
        fr=f(ch[idx])*2; tt=t(.22)
        tri=2/np.pi*np.arcsin(np.sin(2*np.pi*fr*tt))
        a=tri*np.exp(-tt*18)*(.10 if s in('melody','full') else .12)
        if s=='outro': a*= (1-(bar-28)/4*.6)
        place(arp,a,start+k*BEAT/4)
    if s in('groove','melody','full'):
        # Bass: eighth notes on the root with an octave jump on the last eighth
        for k in range(8):
            fr=f(roots[bar%4])*(2 if k==7 else 1); tt=t(BEAT/2*.95)
            sig=np.sin(2*np.pi*fr*tt)+.35*np.sin(2*np.pi*2*fr*tt)+.15*np.sin(2*np.pi*3*fr*tt)
            place(bass,sig*env(len(tt),a=.004,r=.05)*np.exp(-tt*3)*.22,start+k*BEAT/2)
        # Kick on every beat
        for k in range(4):
            tt=t(.32); ph=2*np.pi*np.cumsum(45+85*np.exp(-tt*28))/SR
            place(kick,np.sin(ph)*np.exp(-tt*9)*.55,start+k*BEAT)
            place(kick_env,np.exp(-t(.3)*10),start+k*BEAT)
        # Hats on the off-beats (and 16ths in the full section)
        steps=[k*BEAT/2+BEAT/4 for k in range(8)] if s!='full' else [k*BEAT/4 for k in range(16) if k%2==1 or k%4==2]
        for st in steps:
            tt=t(.05); place(hats,hp(rng.standard_normal(len(tt)),7000)*np.exp(-tt*80)*.06,start+st)
    if s in('melody','full'):
        # Snare / clap on beats 2 and 4
        for k in (1,3):
            tt=t(.22); noise=bp(rng.standard_normal(len(tt)),1200,6000)*np.exp(-tt*16)
            tone=np.sin(2*np.pi*190*tt)*np.exp(-tt*30)
            place(snare,(noise*.22+tone*.12),start+k*BEAT)

# Lead melody: 8 eighth-notes per bar; '.' holds, '-' rests
phrase=[['E5','.','A5','.','G5','E5','D5','.'],
        ['C5','.','D5','E5','.','.','C5','A4'],
        ['G4','.','C5','.','E5','D5','C5','.'],
        ['B4','.','D5','.','G5','.','E5','D5']]
answer=[['A5','.','.','G5','E5','.','D5','E5'],
        ['C5','.','.','.','A4','C5','D5','.'],
        ['E5','.','G5','.','C6','.','B5','G5'],
        ['B5','.','A5','.','G5','.','.','-']]
for bar in range(12,28):
    line=(phrase if (bar//4)%2==0 else answer)[bar%4]; start=bar*BAR; k=0
    while k<8:
        nt=line[k]
        if nt in('.','-'): k+=1; continue
        length=1
        while k+length<8 and line[k+length]=='.': length+=1
        dur=length*BEAT/2; tt=t(dur+.05); fr=f(nt)
        vib=1+.004*np.sin(2*np.pi*5.5*tt)*np.clip(tt*4,0,1)
        ph=2*np.pi*np.cumsum(fr*vib)/SR
        sig=sum(np.sin(h*ph)/h for h in (1,3,5,7))+.3*np.sin(2*ph)
        level=.07 if section(bar)=='melody' else .085
        place(lead,lp(sig,4500)*env(len(tt),a=.01,r=.08)*level,start+k*BEAT/2)
        k+=length

# Sidechain: pad and bass dip briefly on each kick (the "pumping" feel)
duck=1-.55*np.clip(kick_env,0,1)
pad*=duck; bass*=1-.35*np.clip(kick_env,0,1)

# Shared reverb for pad, arp and lead
ir_t=t(1.8); ir=rng.standard_normal(len(ir_t))*np.exp(-ir_t*3.2); ir=lp(ir,6000); ir/=np.sqrt(np.sum(ir**2))
send=pad*.5+arp*.6+lead*.5
wet=fftconvolve(send,ir)[:N]
# Wrap the reverb tail to the start, so the loop is seamless
tail=fftconvolve(send,ir)[N:N+len(ir)]
wet[:len(tail)]+=tail

dry=pad+arp+bass+kick+snare+hats+lead
left=dry+wet*.35; right=dry+wet*.35
# Gentle stereo width: arp and hats slightly to opposite sides
left+=arp*.15-hats*.2; right+=-arp*.15+hats*.2
mix=np.stack([left,right],1)
mix=np.tanh(mix*1.2)/np.tanh(1.2)
mix/=np.max(np.abs(mix))/0.89
from scipy.io import wavfile
wavfile.write('/home/claude/music/open-hands.wav',SR,(mix*32767).astype(np.int16))
print('seconds',N/SR)
