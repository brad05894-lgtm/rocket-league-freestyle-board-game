import './demoMines.css'
import {useEffect,useRef,useState} from 'react'
import {formatPartyDieFace,getPartyCar} from './partyCars'
import {challengeNow} from './partyChallengeTransport'
import { calculatePartyMovement } from './partyMovementModifiers'
// Face order: front, right, back, left, top, bottom.
const FACE_ROTATIONS=['rotateY(0deg)','rotateY(90deg)','rotateY(180deg)','rotateY(-90deg)','rotateX(90deg)','rotateX(-90deg)']
const STOP_ROTATIONS=['rotateX(0deg) rotateY(0deg)','rotateX(0deg) rotateY(-90deg)','rotateX(0deg) rotateY(-180deg)','rotateX(0deg) rotateY(90deg)','rotateX(-90deg) rotateY(0deg)','rotateX(90deg) rotateY(0deg)']
export function precisionFaceAt(now,startedAt){return Math.floor(Math.max(0,now-startedAt)/1300)%6+1}
export default function PartyDice({animation,room,clientId,onStop,busy,isHost,onRecover,error}) {
 const [now,setNow]=useState(challengeNow()),ref=useRef()
 useEffect(()=>{const t=setInterval(()=>setNow(challengeNow()),50);return()=>clearInterval(t)},[])
 const precise=animation.kind==='precision',stopped=Boolean(animation.stoppedAt)
 const car=getPartyCar(animation.carId||room.players?.[animation.playerId]?.carId)
 const faces=animation.kind==='special'?car?.specialDie||[1,2,3,4,5,6]:[1,2,3,4,5,6]
 const face=precisionFaceAt(now,animation.startedAt)
 const result=stopped?animation.faceIndex:face-1
 const isBoardRoll = animation.kind !== 'turn-order' && room.turnState?.rolled
 const modifier = isBoardRoll ? Number(room.turnState?.movementModifierApplied)||0 : 0
 const base = Number(room.turnState?.baseMovement)||0
 const finalMovement = Number(room.turnState?.rollMovementTotal ?? calculatePartyMovement(base,modifier))
 const elapsed = stopped ? Math.max(0, now-Number(animation.stoppedAt)) : 0
 const bomb=room.turnState?.bombRoll,hasBomb=!!room.playerSetup?.[animation.playerId]?.bombAlly||!!bomb
 const revealModifier = stopped && modifier !== 0 && isBoardRoll
 useEffect(()=>{
  if(precise||stopped)return
  let frame
  const tick=()=>{const t=(performance.now()/1000);if(ref.current)ref.current.style.transform=`rotateX(${t*1163}deg) rotateY(${t*1727}deg) rotateZ(${t*947}deg)`;frame=requestAnimationFrame(tick)}
  frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame)
 },[precise,stopped])
 return <div className="party-dice-overlay" role="dialog" aria-label="Roll dice"><section>
 <h2>{animation.purpose==='turn-order'?'Turn-Order Die':precise?'Precision Dice':animation.kind==='special'?`${car?.name||'Car'} Special Die`:'Normal Die'}</h2>
 <div className="party-dice-stage"><div ref={ref} className={'party-cube'+(precise?' is-gold':'')} style={precise||stopped?{transform:STOP_ROTATIONS[result||0]}:undefined}>{faces.map((f,i)=><div key={i} className="party-cube-face" style={{transform:FACE_ROTATIONS[i]+' translateZ(60px)'}}>{formatPartyDieFace(f)}</div>)}</div></div>
 {hasBomb&&<div className="party-bomb-die"><div className="bomb-stack"><div className={'bomb-mini-cube'+(stopped&&elapsed>=800?' stopped':'')}>{stopped&&elapsed>=800?(bomb?.tokenLoss!==undefined&&bomb?.faceIndex>=4?'−5 Tokens':`${bomb?.movement||0} Move`):['−1','−1','−2','−2','−5 T','−5 T'][Math.floor(now/70)%6]}</div><div key={stopped&&elapsed>=400?'jump':'idle'} className={'bomb-egg'+(stopped&&elapsed>=400?' jump':'')}>💣</div></div><span>{stopped&&elapsed>=800?bomb?.faceIndex>=4?`Lost ${bomb.tokenLoss} Tokens. Movement unchanged by the bomb.`:`Bomb: ${bomb?.movement} movement`:'Your bomb ally is rolling too…'}<br/>{stopped&&elapsed>=800?`${bomb?.rollsLeft} rolls remaining`:''}</span></div>}
 <p aria-live="polite">{stopped?`Result: ${formatPartyDieFace(faces[result||0])}`:precise?`Showing ${face} — stop on the number you want.`:'Press Stop when you’re ready.'}</p>
 {revealModifier&&<div className="party-dice-math" aria-label={`Movement: ${base} ${modifier>0?'plus':'minus'} ${Math.abs(modifier)} equals ${finalMovement}`} role="status">
   <span className="party-dice-math__label">Movement adjustment</span>
   <div className="party-dice-math__equation">
     <span className="party-dice-math__base">{base}</span>
     {elapsed>=(bomb?1100:350)&&<span key={`${animation.stoppedAt}-modifier`} className={`party-dice-math__modifier ${modifier>0?'is-positive':'is-negative'}`}>{modifier>0?'+':'−'}{Math.abs(modifier)}</span>}
     {elapsed>=(bomb?1800:1050)&&<span key={`${animation.stoppedAt}-total`} className="party-dice-math__total">= {finalMovement}</span>}
   </div>
   {elapsed>=(bomb?1800:1050)&&<span className="party-dice-math__label">{finalMovement === 0?'No spaces moved — minimum is 0':`${finalMovement} space${finalMovement===1?'':'s'} to move`}</span>}
 </div>}
 {!stopped&&animation.playerId===clientId?<button disabled={busy} onClick={()=>onStop(precise?face:undefined)}>{busy?'Saving…':'Stop'}</button>:!stopped?<p>{room.players?.[animation.playerId]?.name} is rolling…</p>:null}
 {error&&<p role="alert">{error}</p>}
 {(isHost||animation.playerId===clientId)&&!stopped&&<button className="party-small-recovery" disabled={busy} onClick={onRecover}>Cancel roll (recovery)</button>}
 </section></div>
}
