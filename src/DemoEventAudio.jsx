import {useEffect,useRef,useState} from 'react'
import {partyNow} from './partyClock'
export default function DemoEventAudio({room}){
 const ctx=useRef(null),played=useRef(new Set()),[muted,setMuted]=useState(()=>localStorage.getItem('party-event-muted')==='true')
 useEffect(()=>{const unlock=()=>{try{const C=window.AudioContext||window.webkitAudioContext;if(C){ctx.current ||= new C();ctx.current.resume().catch(()=>{})}}catch{}};window.addEventListener('pointerdown',unlock);return()=>{window.removeEventListener('pointerdown',unlock);ctx.current?.close().catch(()=>{})}},[])
 useEffect(()=>{
  const c=room.boardCinematic,e=room.turnState?.eventEffect,b=room.turnState?.bombRoll,d=room.turnState?.diceAnimation
  const cues=[]
  if(c){const start=c.startedAt;if(c.kind==='central-bomb')cues.push([`bomb-${c.id}`,start+1300,'tick']);if(c.kind==='central-bomb'&&c.countdown===0){cues.push([`blast-${c.id}`,start+2800,'boom'],[`fall-${c.id}`,start+7100,'boom']);for(let i=0;i<5;i++)cues.push([`reset-${c.id}-${i}`,start+7100+i*180,'tick'])}if(c.kind==='ally-goodbye')cues.push([`bye-${c.id}`,start+1300,'boom']);if(c.kind==='conveyor')cues.push([`belt-${c.id}`,start+1000,'machine']);if(c.kind==='minecart')cues.push([`cart-${c.id}`,start+(c.pickupMs||0)+2700,'machine'],[`arrive-${c.id}`,start+(c.pickupMs||0)+6100,'machine']);if(c.kind==='homestretch'){cues.push([`home-${c.id}`,start,'chime']);c.nodes.forEach((n,i)=>cues.push([`home-${c.id}-${n}`,start+2800+i*2200,'chime']))}}
  if(c?.kind==='minecart'&&c.pickupMs)cues.push([`pickup-away-${c.id}`,c.startedAt,'machine'],[`pickup-arrive-${c.id}`,c.startedAt+3500,'machine'])
  if(e?.lastSwingAt)cues.push([`pick-${e.lastSwingAt}`,e.lastSwingAt+450,e.broken?'break':'pick'])
  if(b&&d?.stoppedAt)cues.push([`egg-${d.stoppedAt}`,d.stoppedAt+800,'tick'])
  function sound(kind){const a=ctx.current;if(!a||a.state!=='running'||muted)return false;const start=a.currentTime,duration=kind==='machine'?1.7:kind==='boom'?2.2:.32,g=a.createGain();g.gain.setValueAtTime(kind==='boom'?.16:.07,start);g.gain.exponentialRampToValueAtTime(.0001,start+duration);g.connect(a.destination);let s
   if(['boom','machine','break','pick'].includes(kind)){s=a.createBufferSource();const buf=a.createBuffer(1,Math.ceil(a.sampleRate*duration),a.sampleRate),data=buf.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(kind==='machine'?.45:1);s.buffer=buf;const f=a.createBiquadFilter();f.type='lowpass';f.frequency.value=kind==='boom'?240:kind==='pick'?3000:900;s.connect(f);f.connect(g);s.onended=()=>{s.disconnect();f.disconnect();g.disconnect()}}
   else{s=a.createOscillator();s.type='sine';s.frequency.setValueAtTime(kind==='chime'?660:200,start);s.frequency.exponentialRampToValueAtTime(kind==='chime'?990:80,start+duration);s.connect(g);s.onended=()=>{s.disconnect();g.disconnect()}}
   s.start();s.stop(start+duration);return true
  }
  const tick=()=>{const now=partyNow();for(const [id,at,kind] of cues){if(played.current.has(id)||now<at)continue;if(now-at>700||document.hidden||muted){played.current.add(id);continue}if(sound(kind))played.current.add(id)}}
  tick();const timer=setInterval(tick,60);return()=>clearInterval(timer)
 },[room.boardCinematic,room.turnState?.eventEffect?.lastSwingAt,room.turnState?.bombRoll,room.turnState?.diceAnimation?.stoppedAt,muted])
 return <button className="demo-sound-toggle" aria-label={muted?'Unmute event sounds':'Mute event sounds'} onClick={()=>setMuted(v=>{localStorage.setItem('party-event-muted',String(!v));return !v})}>{muted?'🔇':'🔊'}</button>
}
