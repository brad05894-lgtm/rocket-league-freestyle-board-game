let context, enabled=false
export const battleAudioReady=()=>enabled&&context?.state==='running'

function beep({frequency=780,endFrequency=null,duration=.18,volume=.16,type='sine',delay=0}={}){
 if(!battleAudioReady())return false
 const now=context.currentTime+delay,osc=context.createOscillator(),gain=context.createGain()
 osc.type=type
 osc.frequency.setValueAtTime(frequency,now)
 if(endFrequency&&endFrequency>0)osc.frequency.exponentialRampToValueAtTime(endFrequency,now+duration)
 gain.gain.setValueAtTime(.0001,now)
 gain.gain.exponentialRampToValueAtTime(Math.max(.001,volume),now+.01)
 gain.gain.exponentialRampToValueAtTime(.0001,now+duration)
 osc.connect(gain);gain.connect(context.destination);osc.start(now);osc.stop(now+duration+.02)
 osc.onended=()=>{osc.disconnect();gain.disconnect()}
 return true
}

function tone(word){
 if(!battleAudioReady())return false
 if(word==='Explosion'||word==='Time'){
  beep({frequency:120,endFrequency:42,duration:.55,volume:.25,type:'sawtooth'})
  beep({frequency:72,endFrequency:34,duration:.65,volume:.16,type:'square',delay:.02})
  return true
 }
 if(word==='Tick')return beep({frequency:900,duration:.07,volume:.055,type:'sine'})
 if(word==='Start'){
  beep({frequency:520,duration:.11,volume:.11})
  beep({frequency:780,duration:.16,volume:.15,delay:.12})
  return true
 }
 if(word==='Turn')return beep({frequency:690,duration:.13,volume:.12,type:'triangle'})
 if(word==='Select'){
  beep({frequency:480,duration:.09,volume:.09})
  beep({frequency:760,duration:.16,volume:.13,delay:.1})
  return true
 }
 if(word==='Success'){
  beep({frequency:560,duration:.1,volume:.09})
  beep({frequency:760,duration:.1,volume:.11,delay:.1})
  beep({frequency:980,duration:.2,volume:.13,delay:.2})
  return true
 }
 const frequency=word==='red'?260:word==='yellow'?520:word==='green'?780:780
 return beep({frequency,duration:.48,volume:.2,type:'sine'})
}

export async function enableBattleAudio(){
 const Constructor=window.AudioContext||window.webkitAudioContext
 if(!Constructor)throw Error('This browser does not support game sound. Try a current browser.')
 if(!context||context.state==='closed')context=new Constructor()
 // Resume directly inside the button gesture, before awaiting other work.
 const resume=context.resume()
 await Promise.race([resume,new Promise((_,reject)=>setTimeout(()=>reject(Error('Sound did not unlock. Tap again and check device media volume / silent mode.')),1800))])
 enabled=context.state==='running'
 if(!enabled)throw Error('Sound is still blocked. Tap again and check your browser/site sound setting.')
 tone('Ready');return true
}

export async function battleSound(word='Ready'){
 if(!tone(word))return false
 // Spoken cues are only useful for the traffic-light colors. Other events use sound effects.
 if(['red','yellow','green'].includes(word)&&'speechSynthesis'in window){
  try{window.speechSynthesis.cancel();const voice=new SpeechSynthesisUtterance(word);voice.volume=1;voice.rate=1.05;window.speechSynthesis.speak(voice)}catch{}
 }
 return true
}

export function stopBattleSpeech(){if(typeof window!=='undefined')window.speechSynthesis?.cancel()}
