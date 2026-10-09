import { useEffect, useMemo, useState } from 'react'
import PartyBattleRoulette, { ROULETTE_MS } from './PartyBattleRoulette'
import { challengeNow } from './partyChallengeTransport'

export function luckOptions(labels, winner, seed) {
  let state = (Math.floor(Number(seed) * 4294967295) >>> 0) || 1
  const random = () => { state = (Math.imul(state,1664525)+1013904223)>>>0; return state/4294967296 }
  const shuffle = values => { for(let i=values.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[values[i],values[j]]=[values[j],values[i]]} return values }
  const others=shuffle([...new Set(labels)].filter(label=>label&&label!==winner))
  return shuffle([winner,...others.slice(0,5)]).map(label=>({value:label,label}))
}
export default function PartyLuckRoulette({title,options,winner,seed,onComplete,canContinue,startedAt:sharedStart}) {
  const [startedAt]=useState(()=>Number(sharedStart)||challengeNow())
  const choices=useMemo(()=>luckOptions(options,winner,seed),[options,winner,seed])
  useEffect(()=>{
    const id=setTimeout(onComplete,Math.max(0,startedAt+ROULETTE_MS+1000-challengeNow()))
    return()=>clearTimeout(id)
  },[canContinue,onComplete,startedAt])
  return <PartyBattleRoulette title={title} options={choices} winner={winner} startedAt={startedAt} host={canContinue} busy={false} onContinue={onComplete}/>
}
