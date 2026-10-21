import {CENTRAL_LOOP_IDS,getPartyBoard} from './partyBoards'
export const BOMB_FACES=[-1,-1,-2,-2,'tokens','tokens']
export const miningBreakChance = swing => Math.min(.5,Math.max(0,(swing-1)*.1))
export function centralBombColor(value){return value>=4?'#47ef76':value>=2?'#ffd94a':'#ff403a'}
export function createBoardCinematic(room,kind,now,data={},duration=3800){
 room.cinematicSequence=(Number(room.cinematicSequence)||0)+1
 room.boardCinematic={id:room.cinematicSequence,kind,startedAt:now,endsAt:now+duration,...data}
 return room.boardCinematic
}
export function triggerDemoEvent(room,turn,uid,nodeId,now){
 const node=getPartyBoard(room).nodes.find(n=>n.id===nodeId),setup=room.playerSetup[uid]
 room.boardState ||= {};const state=room.boardState
 const effect={id:node.special,name:getPartyBoard(room).boardEvents[node.special]?.name||'Mine Event',resolved:false,animationStartedAt:now,publicMessage:'',playerId:uid,nodeId}
 if(node.special==='minecart'){
  effect.stage='offer';effect.destination=nodeId==='d29'?'d49':'d29'
  effect.publicMessage='Ride to the opposite corner for free? Your turn ends on arrival without activating that space.'
  turn.movementRemaining=0;turn.readyToEnd=true
 }else if(node.special==='royal-explosion'){
  const previous=Number.isInteger(state.bombCountdown)?state.bombCountdown:5,remaining=previous-1
  const affected=[],losses={}
  if(remaining<=0){for(const [id,s] of Object.entries(room.playerSetup||{})){
   if(s.onStartDeck||!CENTRAL_LOOP_IDS.includes(s.boardNodeId)||!room.players[id])continue
   const before=Math.max(0,Number(s.tokens)||0),loss=Math.ceil(before/2);s.tokens=before-loss;losses[id]=loss;affected.push(id)
  }}
  state.bombCountdown=remaining<=0?5:remaining
  effect.publicMessage=remaining<=0?'BOOM! Everyone on the central loop loses half their Tokens, rounded up. Stay on your spaces. Countdown resets to 5.':`Central bomb countdown: ${remaining}.`
  createBoardCinematic(room,'central-bomb',now,{playerId:uid,previous,countdown:remaining,affected,losses,title:remaining<=0?'Explosion!':'Tick… Tock…',message:effect.publicMessage},remaining<=0?8500:3600)
 }else if(node.special==='conveyor-reversal'){
  state.conveyorLane=state.conveyorLane==='upper'?'lower':'upper'
  effect.publicMessage=state.conveyorLane==='upper'?'The top conveyor now takes the upper route past the bomb ally.':'The top conveyor now takes the lower, safe route.'
  createBoardCinematic(room,'conveyor',now,{playerId:uid,lane:state.conveyorLane,title:'Conveyor Reversed!',message:effect.publicMessage},3500)
 }else if(node.special==='gold-mine'){
  effect.name='Dig for Gold!';effect.stage='rules';effect.swings=0;effect.unbanked=0;effect.revision=0
  effect.publicMessage='Each successful swing mines 1–5 Tokens. Your first swing is safe. Each extra swing is riskier. Collect after any success, or risk another swing. A broken pickaxe loses only this visit’s earnings.'
 }
 turn.eventEffect=effect;return effect
}
export function mineAction(room,action,expectedRevision,breakSeed,rewardSeed,now){
 const e=room.turnState?.eventEffect
 if(e?.id!=='gold-mine'||e.resolved||e.revision!==expectedRevision)throw Error('Mining state changed. Please try again.')
 if(action==='start'){if(e.stage!=='rules')throw Error('Mining already started.');e.stage='mining'}
 else if(action==='swing'){
  if(e.stage!=='mining'||now<Number(e.swingUntil||0))throw Error('Wait for the pickaxe to finish.')
  e.swings++;e.lastSwingAt=now;e.swingUntil=now+1100
  e.broken=breakSeed<miningBreakChance(e.swings)
  e.lastGain=e.broken?0:1+Math.min(4,Math.floor(rewardSeed*5))
  e.unbanked=e.broken?0:e.unbanked+e.lastGain
  if(e.broken){e.stage='result';e.publicMessage='Your pickaxe broke! 0 Tokens collected. Your existing Tokens are safe.'}
 }else if(action==='collect'){
  if(e.stage!=='mining'||e.swings<1||now<Number(e.swingUntil||0))throw Error('Finish at least one swing first.')
  const s=room.playerSetup[room.turnState.playerId];s.tokens=Math.max(0,Number(s.tokens)||0)+e.unbanked
  e.collected=e.unbanked;e.stage='result';e.publicMessage=`Collected ${e.unbanked} Tokens!`
 }else if(action==='finish'){
  if(e.stage!=='result'||now<Number(e.swingUntil||0))throw Error('Finish mining first.')
  e.resolved=true
 }else throw Error('Unknown mining action.')
 e.revision++;return e
}
export function giveBombAlly(setup){if(setup.bombAlly)return false;setup.bombAlly={rollsLeft:3};return true}
export function rollBombAlly(setup,turn,seed){
 if(!setup.bombAlly||turn.bombRoll)return 0
 const faceIndex=Math.min(5,Math.floor(seed*6)),face=BOMB_FACES[faceIndex]
 const before=Math.max(0,Number(setup.tokens)||0),tokenLoss=face==='tokens'?Math.min(5,before):0
 if(face==='tokens')setup.tokens=before-tokenLoss
 setup.bombAlly.rollsLeft=Math.max(0,setup.bombAlly.rollsLeft-1)
 turn.bombRoll={faceIndex,movement:typeof face==='number'?face:0,tokenLoss,rollsLeft:setup.bombAlly.rollsLeft}
 if(!setup.bombAlly.rollsLeft)setup.bombAlly.goodbyePending=true
 return turn.bombRoll.movement
}
export function explodeAllyAtTurnEnd(room,uid,now){
 const s=room.playerSetup?.[uid];if(!s?.bombAlly?.goodbyePending)return false
 const before=Math.max(0,Number(s.tokens)||0),loss=Math.min(5,before);s.tokens=before-loss;delete s.bombAlly
 createBoardCinematic(room,'ally-goodbye',now,{playerId:uid,nodeId:s.boardNodeId,title:'One Last BOOM!',message:`Your bomb ally says goodbye: −${loss} Tokens.`,loss},3500)
 return true
}
export function maybeHomestretch(room,now){
 if(room.phase!=='board'||room.boardState?.homestretchShown||Number(room.currentRound||1)<=Math.max(0,Number(room.settings?.rounds||10)-3)||room.boardCinematic)return
 room.boardState ||= {};room.boardState.homestretchShown=true
 const nodes=getPartyBoard(room).nodes.filter(n=>n.type==='Bad Luck').map(n=>n.id)
 createBoardCinematic(room,'homestretch',now,{nodes,title:'Homestretch',message:'The final three rounds! Bad Luck spaces become Very Bad Luck.'},1800+nodes.length*2200)
}
export function transformedBadLuck(room,id,now){
 const final=Number(room.currentRound||1)>Math.max(0,Number(room.settings?.rounds||10)-3)
 const c=room.boardCinematic
 if(c?.kind==='homestretch'){const index=c.nodes.indexOf(id);return index<0?final:now>=c.startedAt+1800+index*2200+1000}
 return final
}

export function chooseMinecartRide(room,accept,now){
 const turn=room.turnState,e=turn?.eventEffect
 if(e?.id!=='minecart'||e.resolved||e.stage!=='offer'||room.boardCinematic)throw Error('This minecart choice has already been handled.')
 if(typeof accept!=='boolean')throw Error('Choose Ride or Stay.')
 turn.movementRemaining=0;turn.readyToEnd=true
 if(!accept){e.resolved=true;e.stage='declined';e.publicMessage='Stayed at this station.';return}
 const setup=room.playerSetup[turn.playerId]
 setup.boardNodeId=e.destination;setup.onStartDeck=false;e.stage='riding'
 createBoardCinematic(room,'minecart',now,{playerId:turn.playerId,from:e.nodeId,to:e.destination,title:'Minecart Ride',message:''},12000)
}
