import { useEffect, useRef, useState } from 'react'
// Original synthesized suspense cue; no downloaded music or external requests.
export default function FinaleMusic({done}) {
  const audio=useRef(null),loop=useRef(null),voices=useRef(new Set()),finished=useRef(done)
  const [playing,setPlaying]=useState(false)
  const wanted=useRef(true),mounted=useRef(false),generation=useRef(0),button=useRef(null)
  finished.current=done
  function stop(){wanted.current=false;generation.current++;clearInterval(loop.current);loop.current=null;for(const osc of voices.current){try{osc.stop()}catch{}}voices.current.clear();audio.current?.suspend().catch(()=>{});setPlaying(false)}
  async function start(){
    wanted.current=true
    if(loop.current&&audio.current?.state==='running')return
    const attempt=++generation.current
    const Constructor=window.AudioContext||window.webkitAudioContext
    if(!Constructor)return
    try{
      audio.current ||= new Constructor()
      await audio.current.resume()
      if(!mounted.current||!wanted.current||attempt!==generation.current||audio.current?.state!=='running')return
      clearInterval(loop.current);setPlaying(true)
      let beat=0
      const tick=()=>{
        if(document.hidden||audio.current.state!=='running')return
        const notes=finished.current?[261.63,329.63,392,523.25]:[130.81,155.56,196,146.83,130.81,155.56,207.65,196]
        const frequency=notes[beat++%notes.length],ctx=audio.current,t=ctx.currentTime
        const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='triangle';osc.frequency.value=frequency
        gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.045,t+.04);gain.gain.exponentialRampToValueAtTime(.0001,t+.6)
        osc.connect(gain);gain.connect(ctx.destination);voices.current.add(osc);osc.onended=()=>{voices.current.delete(osc);osc.disconnect();gain.disconnect()};osc.start(t);osc.stop(t+.65)
      }
      tick();loop.current=setInterval(tick,finished.current?550:360)
    }catch{if(mounted.current&&attempt===generation.current)setPlaying(false)}
  }
  useEffect(()=>{
    mounted.current=true
    start()
    // If the browser blocks autoplay, resume on the next interaction.
    // A local mute stays muted and never changes another player's audio.
    const unlock=event=>{
      if(button.current?.contains(event.target))return
      if(wanted.current&&audio.current?.state!=='running')start()
    }
    window.addEventListener('pointerdown',unlock)
    window.addEventListener('keydown',unlock)
    return()=>{
      mounted.current=false;generation.current++
      window.removeEventListener('pointerdown',unlock)
      window.removeEventListener('keydown',unlock)
      clearInterval(loop.current);loop.current=null
      for(const osc of voices.current){try{osc.stop()}catch{}}
      voices.current.clear();audio.current?.close().catch(()=>{});audio.current=null
    }
  },[])
  return <button ref={button} className="party-finale-music" type="button" onClick={playing?stop:start}>{playing?'Mute music':wanted.current?'Enable music':'Play music'}</button>
}
