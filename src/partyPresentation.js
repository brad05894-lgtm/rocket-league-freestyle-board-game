// Shared, committed presentation timeline. Never awards currency itself.
export const REWARD_BEAT_MS = 2200
export function economySnapshot(room) {
 return Object.fromEntries(Object.entries(room?.playerSetup||{}).map(([id,s])=>[id,{tokens:Number(s.tokens)||0,trophies:Number(s.trophies)||0,nodeId:s.onStartDeck?'start-deck':s.boardNodeId}]))
}
export function attachEconomyPresentation(room,before,now,retimeTrophy=false) {
 let beats=[]
 for(const [id,old] of Object.entries(before)) {
  const next=room.playerSetup?.[id];if(!next)continue
  for(const kind of ['tokens','trophies']) {
   const amount=(Number(next[kind])||0)-old[kind]
   if(amount)beats.push({playerId:id,kind,amount,nodeId:next.onStartDeck?'start-deck':next.boardNodeId||old.nodeId})
  }
 }
 if(room.rewardBeats){beats=room.rewardBeats.map(b=>({...b,nodeId:room.playerSetup[b.playerId]?.onStartDeck?'start-deck':room.playerSetup[b.playerId]?.boardNodeId}));delete room.rewardBeats}
 // Victim first, recipient second. Amounts are actual balance deltas, not requested losses.
 beats.sort((a,b)=>(a.amount>0)-(b.amount>0))
 if(room.turnState?.eventEffect?.id==='supply-crates'&&room.turnState.eventEffect.openedAt)for(const b of beats)b.position=[-.8+.7*room.turnState.eventEffect.selectedCrateIndex,1.68,-2.60]
 if(!beats.length)return
 const motion=room.boardMotion,moveEnd=Number(motion?.startedAt||0)+Math.max(0,(motion?.path?.length||1)-1)*(motion?.stepMs||280)
 const event=room.turnState?.eventEffect
 const eventEnd=event?.id==='reactor-trigger-c'?Number(event.animationStartedAt||0)+4700:event?.id==='supply-crates'?Number(event.openedAt||0)+1400:0
 const luck=room.turnState?.spaceEffect
 const luckEnd=luck?.rouletteId&&!luck.awaitingTarget?Number(luck.rouletteId)+5500:0
 const diceEnd=Number(room.turnState?.diceAnimation?.stoppedAt||0)+1500
 const start=Math.max(now,moveEnd,eventEnd,luckEnd,diceEnd,Number(room.presentation?.endsAt)||0)
 room.presentation={id:`${now}-${(room.presentationSequence||0)+1}`,startedAt:start,beats,endsAt:start+beats.length*REWARD_BEAT_MS}
 room.presentationSequence=(room.presentationSequence||0)+1
 if(retimeTrophy&&room.turnState?.trophyCinematic&&beats.some(b=>b.kind==='trophies'&&b.amount>0))room.turnState.trophyCinematic.startedAt=room.presentation.endsAt
}
export function presentationBeat(room,now) {
 const p=room.presentation;if(!p||now<p.startedAt||now>=p.endsAt)return null
 const index=Math.floor((now-p.startedAt)/REWARD_BEAT_MS)
 return p.beats?.[index]?{...p.beats[index],age:now-p.startedAt-index*REWARD_BEAT_MS,key:p.id+'-'+index}:null
}
