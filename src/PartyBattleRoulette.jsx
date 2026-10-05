import { useEffect, useRef, useState } from 'react'
import { challengeNow } from './partyChallengeTransport'
import { battleAudioReady, battleSound } from './partyBattleAudio'
export const ROULETTE_MS=4400
// A ping-pong cursor, not a scrolling reel. Its speed eases to the authoritative winner.
export function rouletteIndex(count,winner,elapsed){
 if(count<=1||elapsed>=ROULETTE_MS)return winner
 const end=count-1,period=end*2,steps=period*6+winner,t=Math.max(0,Math.min(1,elapsed/ROULETTE_MS))
 const travelled=Math.floor(steps*(1-Math.pow(1-t,3.2))),at=travelled%period
 return at<=end?at:period-at
}
export default function PartyBattleRoulette({title,options,winner,startedAt,onContinue,host,busy}){
 const [now,setNow]=useState(challengeNow())
 const sounded=useRef('')
 useEffect(()=>{const t=setInterval(()=>setNow(challengeNow()),40);return()=>clearInterval(t)},[startedAt])
 const selected=Math.max(0,options.findIndex(x=>x.value===winner)),elapsed=now-(startedAt||now),done=elapsed>=ROULETTE_MS
 const index=rouletteIndex(options.length,selected,elapsed)
 useEffect(()=>{if(!done||!battleAudioReady())return;const key=startedAt+'-'+winner;if(sounded.current===key)return;sounded.current=key;battleSound('Select').catch(()=>{})},[done,startedAt,winner])
 return <div className="bc-roulette"><p className="bc-eyebrow">{done?'Selected':'Choosing…'}</p><h2>{title}</h2><div className="bc-roulette-list" aria-label={title}>{options.map((option,i)=><div key={option.value} className={'bc-roulette-row'+(i===index?' is-selected':'')+(done&&i===selected?' is-winner':'')} aria-current={i===index?'true':undefined}>{option.label}</div>)}</div><p className="bc-roulette-outcome" aria-live="polite">{done?options[selected]?.label:' '}</p>{host?<button className="battle-continue" disabled={!done||busy} onClick={onContinue}>{done?'Continue':'Selecting…'}</button>:<p>{done?'Waiting for the Battle Host…':'Everyone sees the same selection.'}</p>}</div>
}
