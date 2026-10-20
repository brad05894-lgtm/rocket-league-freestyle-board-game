import {useEffect,useState} from 'react'
import {partyNow} from './partyClock'
import {finishBoardCinematic,resolveDemoMining} from './partyMultiplayer'
import {miningBreakChance} from './demoMinesEvents'
import './demoMines.css'
export default function PartyCinematic({room,roomCode,clientId,isHost,runAction,busy}){
 const [now,setNow]=useState(partyNow())
 useEffect(()=>{const t=setInterval(()=>setNow(partyNow()),80);return()=>clearInterval(t)},[])
 const c=room.boardCinematic,e=room.turnState?.eventEffect,owner=room.turnState?.playerId
 if(c){const done=now>=c.endsAt,can=isHost||c.playerId===clientId,fade=c.kind==='minecart'&&now-c.startedAt>=2850&&now-c.startedAt<3550
  return <><div className={'demo-cinematic-letterbox'+(fade?' is-tunnel':'')} aria-hidden="true"/><section className="demo-cinematic-caption" role="dialog" aria-label={c.title}><small>{c.kind==='homestretch'?'FINAL THREE ROUNDS':'BOARD EVENT'}</small><h2>{c.title}</h2><p>{c.message}</p>{done&&c.losses&&<p>{Object.entries(c.losses).map(([id,loss])=>`${room.players?.[id]?.name||'Player'}: −${loss}`).join(' · ')}</p>}{done&&can?<button disabled={busy} onClick={()=>runAction(()=>finishBoardCinematic(roomCode,clientId,c.id),true)}>Continue</button>:<small>{done?'Waiting for the host or active player…':'Watch the board…'}</small>}{isHost&&!done&&<button className="demo-skip" disabled={busy} onClick={()=>runAction(()=>finishBoardCinematic(roomCode,clientId,c.id,true),true)}>Skip animation</button>}</section></>
 }
 if(e?.id!=='gold-mine'||e.resolved)return null
 const can=owner===clientId||isHost,waiting=now<Number(e.swingUntil||0),act=a=>runAction(()=>resolveDemoMining(roomCode,clientId,a,e.revision),true)
 return <section className="demo-cinematic-caption demo-mining" role="dialog" aria-label="Dig for Gold"><small>{room.players?.[owner]?.name} · MINING EVENT</small><h2>Dig for Gold!</h2>
 {e.stage==='rules'?<><p>{e.publicMessage}</p>{can&&<button disabled={busy} onClick={()=>act('start')}>Start Mining</button>}</>:<><strong className="demo-gold-total">{e.stage==='result'?(e.collected||0):e.unbanked} Tokens</strong><p>{e.stage==='result'?e.publicMessage:`Swing ${e.swings+1}: ${Math.round(miningBreakChance(e.swings+1)*100)}% chance of breaking. Collected only when you cash out.`}</p>{e.lastGain>0&&<p key={e.lastSwingAt} className="demo-gold-gain">+{e.lastGain} mined!</p>}{can&&<div className="demo-mining-buttons">{e.stage==='mining'?<><button disabled={busy||waiting} onClick={()=>act('swing')}>{waiting?'Swinging…':e.swings?'Keep Mining':'First Swing — Safe'}</button>{e.swings>0&&<button disabled={busy||waiting} onClick={()=>act('collect')}>Collect & Finish</button>}</>:<button disabled={busy||waiting} onClick={()=>act('finish')}>Continue</button>}</div>}</>}
 {!can&&<small>Watching {room.players?.[owner]?.name} mine…</small>}
 </section>
}
