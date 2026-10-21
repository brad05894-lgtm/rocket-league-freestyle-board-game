import {minecartFade} from './demoMinecartAnimation'
import {useEffect,useRef,useState} from 'react'
import {partyNow} from './partyClock'
import {finishBoardCinematic,resolveDemoMining,resolveDemoMinecart} from './partyMultiplayer'
import './demoMines.css'
export default function PartyCinematic({room,roomCode,clientId,isHost,runAction,busy,error}){
 const [now,setNow]=useState(partyNow()),lastAttempt=useRef(0)
 useEffect(()=>{const t=setInterval(()=>setNow(partyNow()),80);return()=>clearInterval(t)},[])
 const c=room.boardCinematic,e=room.turnState?.eventEffect,owner=room.turnState?.playerId
 const can=isHost||owner===clientId
 useEffect(()=>{
  if(!c||now<c.endsAt||busy||!(isHost||c.playerId===clientId)||now-lastAttempt.current<2500)return
  lastAttempt.current=now
  runAction(()=>finishBoardCinematic(roomCode,clientId,c.id),true)
 },[c,now,busy,isHost,clientId,roomCode,runAction])
 if(c){const age=now-c.startedAt,fade=c.kind==='minecart'?minecartFade(c,now):0
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
 return <section className="demo-cinematic-caption demo-mining" role="dialog" aria-label="Dig for Gold">
 <small>{room.players?.[owner]?.name} · Dig for Gold!</small>
 {e.stage==='rules'?<><p>Each successful swing earns 1–5 Tokens. Your first is safe; further swings are riskier. Collect after any success. Breaking the pickaxe loses only this visit’s earnings.</p>{can&&<button disabled={busy} onClick={()=>act('start')}>Start Mining</button>}</>:<>
 <strong className="demo-gold-total">{e.stage==='result'?(e.collected||0):e.unbanked} Tokens</strong>
 <p>{e.stage==='result'?e.publicMessage:waiting?'Swinging…':e.swings?'Collect your Tokens or risk another swing.':'Your first swing is safe.'}</p>
 {can&&<div className="demo-mining-buttons">{e.stage==='mining'?<><button disabled={busy||waiting} onClick={()=>act('swing')}>{waiting?'Swinging…':e.swings?'Swing Again':'First Swing'}</button>{e.swings>0&&<button disabled={busy||waiting} onClick={()=>act('collect')}>Collect</button>}</>:<button disabled={busy||waiting} onClick={()=>act('finish')}>Done</button>}</div>}</>}
 {!can&&<small>Watching {room.players?.[owner]?.name} mine…</small>}{error&&<p role="alert">{error}</p>}
 </section>
}
