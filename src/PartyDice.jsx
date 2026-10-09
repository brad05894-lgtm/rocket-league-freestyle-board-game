import {useEffect,useRef,useState} from 'react'
import {formatPartyDieFace,getPartyCar} from './partyCars'
import {challengeNow} from './partyChallengeTransport'
// Face order: front, right, back, left, top, bottom.
const FACE_ROTATIONS=['rotateY(0deg)','rotateY(90deg)','rotateY(180deg)','rotateY(-90deg)','rotateX(90deg)','rotateX(-90deg)']
const STOP_ROTATIONS=['rotateX(0deg) rotateY(0deg)','rotateX(0deg) rotateY(-90deg)','rotateX(0deg) rotateY(-180deg)','rotateX(0deg) rotateY(90deg)','rotateX(-90deg) rotateY(0deg)','rotateX(90deg) rotateY(0deg)']
export function precisionFaceAt(now,startedAt){return Math.floor(Math.max(0,now-startedAt)/1300)%6+1}
export default function PartyDice({animation,room,clientId,onStop,busy,isHost,onRecover}) {
 const [now,setNow]=useState(challengeNow()),ref=useRef()
 useEffect(()=>{const t=setInterval(()=>setNow(challengeNow()),50);return()=>clearInterval(t)},[])
 const precise=animation.kind==='precision',stopped=Boolean(animation.stoppedAt)
 const car=getPartyCar(animation.carId||room.players?.[animation.playerId]?.carId)
 const faces=animation.kind==='special'?car?.specialDie||[1,2,3,4,5,6]:[1,2,3,4,5,6]
 const face=precisionFaceAt(now,animation.startedAt)
 const result=stopped?animation.faceIndex:face-1
 useEffect(()=>{
  if(precise||stopped)return
  let frame
  const tick=()=>{const t=(performance.now()/1000);if(ref.current)ref.current.style.transform=`rotateX(${t*1163}deg) rotateY(${t*1727}deg) rotateZ(${t*947}deg)`;frame=requestAnimationFrame(tick)}
  frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame)
 },[precise,stopped])
 return <div className="party-dice-overlay" role="dialog" aria-label="Roll dice"><section>
 <h2>{precise?'Precision Dice':animation.kind==='special'?`${car?.name||'Car'} Special Die`:'Normal Die'}</h2>
 <div className="party-dice-stage"><div ref={ref} className={'party-cube'+(precise?' is-gold':'')} style={precise||stopped?{transform:STOP_ROTATIONS[result||0]}:undefined}>{faces.map((f,i)=><div key={i} className="party-cube-face" style={{transform:FACE_ROTATIONS[i]+' translateZ(60px)'}}>{formatPartyDieFace(f)}</div>)}</div></div>
 <p aria-live="polite">{stopped?`Result: ${formatPartyDieFace(faces[result||0])}`:precise?`Showing ${face} — stop on the number you want.`:'Press Stop when you’re ready.'}</p>
 {!stopped&&animation.playerId===clientId?<button disabled={busy} onClick={()=>onStop(precise?face:undefined)}>Stop</button>:!stopped?<p>{room.players?.[animation.playerId]?.name} is rolling…</p>:null}
 {isHost&&!stopped&&<button className="party-small-recovery" disabled={busy} onClick={onRecover}>Cancel roll (recovery)</button>}
 </section></div>
}
