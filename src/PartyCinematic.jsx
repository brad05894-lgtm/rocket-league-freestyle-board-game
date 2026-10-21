import {useEffect,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import {partyNow} from './partyClock'
import {finishBoardCinematic,resolveDemoMining,resolveDemoMinecart} from './partyMultiplayer'
import './demoMines.css'
function EventContent({room,roomCode,clientId,isHost,runAction,busy,error}){
 const [now,setNow]=useState(partyNow()),lastAttempt=useRef(0)
 useEffect(()=>{const t=setInterval(()=>setNow(partyNow()),80);return()=>clearInterval(t)},[])
 const c=room.boardCinematic,e=room.turnState?.eventEffect,owner=room.turnState?.playerId
 const can=isHost||owner===clientId
 useEffect(()=>{
  if(!c||now<c.endsAt||busy||!(isHost||c.playerId===clientId)||now-lastAttempt.current<2500)return
  lastAttempt.current=now
  runAction(()=>finishBoardCinematic(roomCode,clientId,c.id),true)
 },[c,now,busy,isHost,clientId,roomCode,runAction])
 if(c){const age=now-c.startedAt,fade=c.kind==='minecart'?Math.max(0,Math.min(1,(age-4800)/600,(6500-age)/600)):0
  return <>
   <div className="demo-tunnel-fade" style={{opacity:fade}} aria-hidden="true"/>
   {c.kind==='homestretch'&&<div className="demo-event-toast">Homestretch · Final three rounds</div>}
   {c.kind==='conveyor'&&<div className="demo-event-toast">{c.lane==='upper'?'Upper route open':'Lower route open'}</div>}
   {c.kind==='ally-goodbye'&&<div className="demo-event-toast">Bomb ally: −{c.loss} Tokens</div>}
   {isHost&&<button className="demo-event-skip" disabled={busy} onClick={()=>runAction(()=>finishBoardCinematic(roomCode,clientId,c.id,true),true)}>Skip animation</button>}
   {error&&<div className="demo-event-error" role="alert">{error}</div>}
  </>
 }
 if(e?.resolved)return null
 if(e?.id==='minecart')return <section className="demo-cinematic-caption demo-ride-choice" role="dialog" aria-label="Free minecart ride">
  <h2>Take a free ride?</h2><p>Travel to the opposite corner and end your turn there. The arrival space won’t activate.</p>
  {can?<div className="demo-mining-buttons"><button disabled={busy} onClick={()=>runAction(()=>resolveDemoMinecart(roomCode,clientId,true),true)}>Ride</button><button disabled={busy} onClick={()=>runAction(()=>resolveDemoMinecart(roomCode,clientId,false),true)}>Stay here</button></div>:<small>Waiting for {room.players?.[owner]?.name}…</small>}{error&&<p role="alert">{error}</p>}
 </section>
 if(e?.id!=='gold-mine')return null
 const waiting=now<Number(e.swingUntil||0),act=a=>runAction(()=>resolveDemoMining(roomCode,clientId,a,e.revision),true)
 const age=now-Number(e.lastSwingAt||0),progress=Math.max(0,Math.min(1,(age-550)/(e.broken?1900:750)))
 const total=e.lastSwingAt&&waiting?Math.round(Number(e.previousTotal||0)+(Number(e.unbanked||0)-Number(e.previousTotal||0))*progress):Number(e.stage==='result'&&!e.broken?e.collected||0:e.unbanked||0)
 const rules=e.stage==='rules'
 return <section className={`demo-cinematic-caption demo-mining ${rules?'demo-mining-intro':''}`} role="dialog" aria-label="Dig for Gold">
 <small>{room.players?.[owner]?.name} · Dig for Gold!</small>
 {rules?<><h2>Dig for Gold!</h2><p>Each successful swing earns <strong>1–5 Tokens</strong>. Your first swing is guaranteed to succeed.</p><p>After each success, cash out your total or swing again. Each extra swing is riskier. If your pickaxe breaks, you lose everything mined during this visit. Your existing Tokens are safe.</p>{can&&<button disabled={busy} onClick={()=>act('continue')}>Continue</button>}</>:<>
 <div className="demo-mining-tally"><strong className="demo-gold-total">{total} Tokens</strong><span className="demo-gold-gain" key={e.lastSwingAt}>{e.lastSwingAt&&age>=550?(e.broken?'Pickaxe broke!':`+${e.lastGain} Tokens`):waiting?'Swinging…':'Visit total'}</span></div>
 <p>{e.broken&&age>=550?'This visit’s winnings are lost. Your existing Tokens are safe.':e.broken&&waiting?'Swinging…':e.stage==='result'?e.publicMessage:e.swings?'Cash out or risk another swing.':'Your first swing is safe.'}</p>
 {can&&<div className="demo-mining-buttons">{e.stage==='ready'?<button disabled={busy} onClick={()=>act('start')}>Start Mining</button>:e.stage==='mining'?<><button disabled={busy||waiting} onClick={()=>act('swing')}>{waiting?'Swinging…':e.swings?'Swing Again':'First Swing'}</button>{e.swings>0&&<button disabled={busy||waiting} onClick={()=>act('collect')}>Cash Out</button>}</>:<button disabled={busy||waiting} onClick={()=>act('finish')}>Done</button>}</div>}</>}
 {!can&&<small>Watching {room.players?.[owner]?.name} mine…</small>}{error&&<p role="alert">{error}</p>}
 </section>
}
// Escape transformed board ancestors and track the actually visible mobile viewport.
export default function PartyCinematic(props){
 const [viewport,setViewport]=useState({bottom:0,top:0,height:typeof window==='undefined'?800:window.innerHeight})
 useEffect(()=>{const v=window.visualViewport;const sync=()=>setViewport({bottom:Math.max(0,window.innerHeight-(v?.height||window.innerHeight)-(v?.offsetTop||0)),top:v?.offsetTop||0,height:v?.height||window.innerHeight});sync();v?.addEventListener('resize',sync);v?.addEventListener('scroll',sync);window.addEventListener('resize',sync);return()=>{v?.removeEventListener('resize',sync);v?.removeEventListener('scroll',sync);window.removeEventListener('resize',sync)}},[])
 return createPortal(<div className="demo-event-layer" style={{'--demo-bottom':`${viewport.bottom}px`,'--demo-center':`${viewport.top+viewport.height/2}px`,'--demo-height':`${viewport.height}px`}}><EventContent {...props}/></div>,document.body)
}
