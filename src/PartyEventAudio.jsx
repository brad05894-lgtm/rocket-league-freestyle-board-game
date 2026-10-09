import {useEffect,useRef} from 'react'
import {boardEventCues,tokenSoundCues} from './partyEventTiming'
// Original synthesized effects. Each browser follows the shared event timestamps.
export default function PartyEventAudio({room,clockOffset=0}) {
 const ctx=useRef(null),sources=useRef(new Set()),seen=useRef(new Set())
 const effect=room.turnState?.eventEffect,motion=room.boardMotion
 const moveEnd=Number(motion?.startedAt||0)+Math.max(0,(motion?.path?.length||1)-1)*(motion?.stepMs||280)
 useEffect(()=>{
  const unlock=()=>{
   const Audio=window.AudioContext||window.webkitAudioContext
   if(!Audio)return
   try{ctx.current ||= new Audio();ctx.current.resume().catch(()=>{})}catch{}
  }
  window.addEventListener('pointerdown',unlock);window.addEventListener('keydown',unlock)
  unlock()
  return()=>{window.removeEventListener('pointerdown',unlock);window.removeEventListener('keydown',unlock);for(const s of sources.current){try{s.stop()}catch{}}sources.current.clear();ctx.current?.close().catch(()=>{});ctx.current=null}
 },[])
 useEffect(()=>{
  const cues=[...boardEventCues(effect,moveEnd),...tokenSoundCues(room.presentation)]
  if(!cues.length)return
  const active=new Set()
  function layer(kind,duration,noise=false,delay=0){
   const c=ctx.current;if(!c||c.state!=='running')return
   const t=c.currentTime+delay,gain=c.createGain(),filter=c.createBiquadFilter()
   let source
   if(noise){source=c.createBufferSource();const buffer=c.createBuffer(1,Math.ceil(c.sampleRate*duration),c.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;source.buffer=buffer}
   else{source=c.createOscillator();source.type=kind.startsWith('token-')?'sine':kind==='gate'?'sawtooth':kind==='ball'?'sine':'triangle';source.frequency.setValueAtTime(kind==='token-gain'?780:kind==='token-loss'?660:kind==='gate'?85:kind==='ball'?48:kind==='chest-open'?330:120,t);source.frequency.exponentialRampToValueAtTime(kind==='token-gain'?1350:kind==='token-loss'?240:kind==='gate'?55:kind==='ball'?85:kind==='chest-open'?170:45,t+duration)}
   filter.type='lowpass';filter.frequency.setValueAtTime(kind==='ball'?420:kind==='gate'?950:1400,t)
   const level=noise?(kind==='ball'?.10:.045):.035
   gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(level,t+Math.min(.05,duration/4));gain.gain.exponentialRampToValueAtTime(.0001,t+duration)
   source.connect(filter);filter.connect(gain);gain.connect(c.destination)
   active.add(source);sources.current.add(source)
   source.onended=()=>{active.delete(source);sources.current.delete(source);source.disconnect();filter.disconnect();gain.disconnect()}
   source.start(t);source.stop(t+duration+.02)
  }
  const tick=()=>{
   const now=Date.now()+clockOffset
   for(const cue of cues){
    if(seen.current.has(cue.id)||now<cue.at)continue
    const age=now-cue.at
    if(age>=cue.duration||document.hidden){seen.current.add(cue.id);continue}
    if(ctx.current?.state!=='running')continue
    seen.current.add(cue.id)
    if(seen.current.size>100)seen.current.delete(seen.current.values().next().value)
    const seconds=(cue.duration-age)/1000
    if(cue.kind.startsWith('token-')){
      for(let i=0;i<6;i++){const delay=i*.18;if(delay<seconds)layer(cue.kind,Math.min(.16,seconds-delay),false,delay)}
    }else{layer(cue.kind,seconds,true);layer(cue.kind,seconds)}
    // A soft latch/clunk at the end of each mechanical motion.
    if(cue.kind!=='ball'&&!cue.kind.startsWith('token-'))layer('chest-close',.10,false,Math.max(0,seconds-.1))
   }
  }
  tick();const timer=setInterval(tick,50)
  return()=>{clearInterval(timer);for(const s of active){try{s.stop()}catch{}}}
 },[effect?.id,effect?.animationStartedAt,effect?.openedAt,effect?.selectedCrateIndex,moveEnd,clockOffset,room.presentation?.id,room.presentation?.startedAt,room.presentation?.holdForLuck])
 return null
}
