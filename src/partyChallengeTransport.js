import { ref, runTransaction, onValue } from 'firebase/database'
import { db } from './firebase'
import { requireOnlineIdentity, normalizeRoomCode } from './onlineIdentity'
import { createBattle, reduceBattle, rewardDistribution, seeded, gameAction } from './partyChallengeEngine'
import { makeSecretDeal } from './partyChallengeSecretEngine'
import { identityKey, seal, hashSecret } from './partyChallengeSecrets'
import { addPartyStat } from './partyProgress'
import { battlePointsForPlacements } from './battleScoring'
let offset=0,clockReady=false
let clockPromise
function clock(){if(!clockPromise)clockPromise=new Promise((resolve)=>{setTimeout(()=>{clockReady=true;resolve()},1500);onValue(ref(db,'.info/serverTimeOffset'),s=>{offset=Number(s.val())||0;clockReady=true;resolve()},()=>resolve())});return clockPromise}
export const challengeNow=()=>Date.now()+offset
function hasPrivatePacket(g,uid){return !!g?.sealed?.[uid]||!!g?.commits?.[uid]||Object.values(g?.matches||{}).some(m=>hasPrivatePacket(m,uid))}
export async function registerBattleKey(roomCode,uid){requireOnlineIdentity(uid);await clock();const keys=await identityKey(uid);let failure='';const result=await runTransaction(ref(db,`securePartyRooms/${normalizeRoomCode(roomCode)}`),room=>{failure='';if(!room)return;const old=room.battleKeys?.[uid];if(old&&(old.x!==keys.publicKey.x||old.y!==keys.publicKey.y)&&hasPrivatePacket(battleOf(room)?.game,uid)){failure='This private Battle belongs to your original browser. Use that browser, or ask the host to restart the Challenge, then press Retry connection.';return}room.battleKeys||={};room.battleKeys[uid]=keys.publicKey;return room},{applyLocally:false});if(!result.committed)throw Error(failure||'Could not register your private Battle screen. Try again.');return keys}

const path=code=>ref(db,`securePartyRooms/${normalizeRoomCode(code)}`)
const idsOf=room=>(room.playerOrder||Object.keys(room.players||{})).filter(id=>room.players?.[id]&&!room.departedPlayers?.[id])
const battleOf=room=>room.phase==='round-complete'?room.roundBattle:room.turnState?.battle
export async function startRoundChallenge(code,uid){requireOnlineIdentity(uid);await clock();const now=challengeNow(),seed=crypto.getRandomValues(new Uint32Array(1))[0];let error='';const r=await runTransaction(path(code),room=>{if(!room)return; if(room.hostId!==uid||room.phase!=='round-complete'){error='Only the host can start the round Challenge.';return}if(room.roundBattle)return;if(idsOf(room).length<2){room.roundBattle={id:'skipped-'+now,name:'Round Challenge',status:'resolved',cancelled:true,resultMessage:'Challenge skipped: fewer than two players remain.'};return room}room.roundBattle=createBattle({ids:idsOf(room),hostId:uid,challengerId:uid,source:'round-end',now,seed});return room},{applyLocally:false});if(!r.committed&&error)throw Error(error)}
function gameFor(b,a){let g=b.game,act=a.action;if(a.type!=='game')return [g,null];while(act?.type==='matchAction'){g=g?.matches?.[act.matchId];act=act.action}return [g,act]}
export async function sendChallengeAction(code,uid,battleId,action){requireOnlineIdentity(uid);await clock();if(!clockReady)throw Error('Waiting for the shared clock. Try again.');const now=challengeNow(),seed=crypto.getRandomValues(new Uint32Array(1))[0];let failure='';
 // Read a fresh snapshot to prepare encrypted packets. Transaction below checks the same version.
 const { get }=await import('firebase/database');const snap=await get(path(code));const initial=snap.val(),initialBattle=battleOf(initial||{});if(!initialBattle||initialBattle.id!==battleId)throw Error('This Battle has changed.');const actor=action.asPlayerId||uid;if(action.asPlayerId&&(initial.hostId!==uid||!initialBattle.participantIds.includes(actor)))throw Error('Only the room host can enter another player’s input.');initialBattle.hostId=initial.hostId;const [game,act]=gameFor(initialBattle,action);
 if(act?.type==='deal'){const raw=makeSecretDeal(game,seeded(seed),initialBattle.hostId);const packets={};for(const [id,v] of Object.entries(raw)){if(!initial.battleKeys?.[id])throw Error('Waiting for every participant to open the game and enable their private Battle screen.');packets[id]=await seal(initial.battleKeys[id],v);if(initial.battleKeys[initial.hostId])packets[id].hostPacket=await seal(initial.battleKeys[initial.hostId],v)}act.packets=packets;act.dealId=crypto.randomUUID()}
 const initialHash=game?.commits?.[actor]?.hash;
 if(act?.type==='reveal'){if(await hashSecret(act.value,act.salt)!==game.commits?.[actor]?.hash)throw Error('Your locked input could not be verified.');delete act.salt}
 const res=await runTransaction(path(code),room=>{failure='';if(!room)return;const b=battleOf(room);if(!b||b.id!==battleId||b.status!=='active'){failure='This Battle is no longer active.';return}
 b.hostId=room.hostId;
 if(action.asPlayerId&&(room.hostId!==uid||!b.participantIds.includes(actor))){failure='The controlled player is no longer available.';return}
 if(act?.type==='deal'&&b.version!==initialBattle.version){failure='Battle state changed. Retry the deal.';return}
 const [currentGame]=gameFor(b,action);if(act&&game?.instanceId!==currentGame?.instanceId){failure='This match restarted. Use its current controls.';return}
 if(['deal','commit','reveal','actual','nextShot','targetReveal','bossChoose','finalGuess','verify'].includes(act?.type)&&((game?.secretRound||0)!==(currentGame?.secretRound||0)||game?.subphase!==currentGame?.subphase||game?.dealId!==currentGame?.dealId)){failure='This secret round changed. Check the current screen.';return}
 if(act?.type==='reveal'&&currentGame?.commits?.[actor]?.hash!==initialHash){failure='This locked input changed. Retry from the current screen.';return}
 try{if(action.type==='game'&&action.action?.type==='manualResult'&&action.action.override===true&&room.hostId===uid){gameAction(b.game,action.action,uid,true,seeded(seed),now);b.stage='play';b.version++;return room}const next=reduceBattle(b,action,uid,seed,now);if(room.phase==='round-complete')room.roundBattle=next;else room.turnState.battle=next;return room}catch(e){failure=e.message;return}},{applyLocally:false});if(!res.committed)throw Error(failure||'Battle changed; try again.')}
export async function confirmChallengeRewards(code,uid,battleId){
 requireOnlineIdentity(uid);await clock();const now=challengeNow();let error='';
 const res=await runTransaction(path(code),room=>{
  error='';if(!room)return;
  const b=battleOf(room);
  if(!b||b.id!==battleId||room.hostId!==uid){error='Only a host can confirm results.';return}
  if(b.status==='resolved')return;
  if(!b.game?.result||now<b.game.result.revealAt){error='Wait for the result reveal.';return}
  if(b.source==='standalone'){
   const session=room.battleGame;
   if(room.mode!=='battle'||!session||room.status!=='playing'||room.phase!=='board'||session.completed>=session.rounds){error='This Battle session is not accepting results.';return}
   let awarded;
   try { awarded=battlePointsForPlacements(b.format,b.participantIds,b.game.result.placements) }
   catch(e){error=e.message;return}
   session.points||={};session.history||=[];
   const round=session.completed+1;
   for(const [id,points] of Object.entries(awarded)) session.points[id]=(Number(session.points[id])||0)+points;
   session.history.push({round,battleId:b.id,challengeId:b.challengeId,name:b.name,format:b.format,participants:b.participantIds,placements:b.game.result.placements,points:awarded,confirmedAt:now});
   session.completed=round;
   b.rewards=awarded;b.status='resolved';b.resultMessage=`Round ${round} of ${session.rounds} completed. Battle points have been awarded.`;b.resolvedAt=now;
   room.phase='battle-results';
   return room;
  }
  const rewards=rewardDistribution(b);
  for(const [id,amount] of Object.entries(rewards))if(room.playerSetup?.[id]){
   const field=b.source==='challenge-glove'?'trophies':'tokens';
   room.playerSetup[id][field]=(Number(room.playerSetup[id][field])||0)+amount;
   if(amount>0&&field==='tokens'){addPartyStat(room,id,'tokensCollected',amount);addPartyStat(room,id,'minigameTokens',amount)}
  }
  b.rewards=rewards;b.status='resolved';b.resultMessage='Challenge rewards confirmed.';b.resolvedAt=now;
  if(room.phase==='board'&&b.source!=='challenge-glove')room.turnState.readyToEnd=true;
  return room;
 },{applyLocally:false});
 if(!res.committed)throw Error(error||'Results have already been confirmed or the Battle changed.');
}
export async function cancelChallenge(code,uid,battleId){requireOnlineIdentity(uid);let error='';const res=await runTransaction(path(code),room=>{if(!room)return;const b=battleOf(room);if(!b||b.id!==battleId||room.hostId!==uid){error='Only a host can cancel the Battle.';return}if(b.status!=='active')return;b.status='resolved';b.cancelled=true;b.resultMessage=b.source==='standalone'?'Battle cancelled. You can choose another challenge.':'Challenge cancelled. No Tokens changed.';if(room.phase==='board'&&b.source!=='challenge-glove')room.turnState.readyToEnd=true;return room},{applyLocally:false});if(!res.committed&&error)throw Error(error)}
export async function launchChallengeDevTest(code,uid,challengeId,format){requireOnlineIdentity(uid);await clock();const { CHALLENGE_BY_ID, FORMAT_SIZES }=await import('./partyChallengeCatalog');const c=CHALLENGE_BY_ID[challengeId];if(!c?.formats.includes(format))throw Error('Unsupported test format.');const seed=crypto.getRandomValues(new Uint32Array(1))[0],now=challengeNow();let error='';const res=await runTransaction(path(code),room=>{if(!room)return;if(room.hostId!==uid){error='Only the room host can launch a test.';return}const all=idsOf(room);if(all.length<FORMAT_SIZES[format]){error='Invite enough players for this format.';return}const ids=[uid,...all.filter(id=>id!==uid)].slice(0,FORMAT_SIZES[format]);const b=createBattle({ids,hostId:uid,challengerId:uid,source:'dev',now,seed});Object.assign(b,{format,challengeId,name:c.name,stage:'intro',devSelected:true});room.phase='board';room.status='playing';room.turnIndex=(room.playerOrder||all).indexOf(uid);room.turnState={playerId:uid,rolled:true,movementRemaining:0,readyToEnd:false,battle:b};room.devBattleTest={battleName:c.name,instructions:'Use the Challenge Test Lab to choose another game and format.'};return room},{applyLocally:false});if(!res.committed)throw Error(error||'Could not launch Battle test.')}

export async function startBattleSession(code,uid){
 requireOnlineIdentity(uid);await clock();const now=challengeNow();let error='';
 const res=await runTransaction(path(code),room=>{
  error='';if(!room||room.mode!=='battle'||room.hostId!==uid){error='Only the Battle host can start the session.';return}
  if(room.status!=='lobby'){error='This session has already started.';return}
  const players=Object.values(room.players||{}).filter(p=>!room.departedPlayers?.[p.id]);
  const rounds=Number(room.settings?.rounds??10);
  if(players.length<2||players.length>4){error='Battle Mode requires 2–4 players.';return}
  if(!Number.isSafeInteger(rounds)||rounds<1||rounds>999){error='Choose 1–999 rounds.';return}
  const roster=[...players].sort((a,b)=>(a.joinedAt||0)-(b.joinedAt||0));
  room.playerOrder=roster.map(p=>p.id);
  room.battleGame={rounds,completed:0,points:Object.fromEntries(roster.map(p=>[p.id,0])),names:Object.fromEntries(roster.map(p=>[p.id,p.name])),history:[],startedAt:now};
  room.status='playing';room.phase='battle-selection';
  return room;
 },{applyLocally:false});
 if(!res.committed)throw Error(error||'Could not start Battle Mode.');
}

export async function startStandaloneBattle(code,uid,challengeId,format,participants){
 requireOnlineIdentity(uid);await clock();
 const {CHALLENGE_BY_ID,FORMAT_SIZES}=await import('./partyChallengeCatalog');
 const c=CHALLENGE_BY_ID[challengeId],now=challengeNow(),seed=crypto.getRandomValues(new Uint32Array(1))[0];
 if(!c?.formats.includes(format))throw Error('Choose an available format.');
 let error='';
 const result=await runTransaction(path(code),room=>{
  error='';if(!room||room.mode!=='battle'||room.hostId!==uid){error='Only the Battle host can choose a Challenge.';return}
  if(room.status!=='playing'||room.phase!=='battle-selection'||!room.battleGame){error='Finish the current round or start the lobby first.';return}
  if(room.battleGame.completed>=room.battleGame.rounds){error='All rounds are already complete.';return}
  if(!Array.isArray(participants)||participants.length!==FORMAT_SIZES[format]||new Set(participants).size!==participants.length||participants.some(id=>!room.players?.[id]||room.departedPlayers?.[id])){error='Choose the required number of current players.';return}
  room.playerSetup||={};
  for(const id of room.playerOrder||[])room.playerSetup[id]||={tokens:0,trophies:0,cards:[]};
  const b=createBattle({ids:participants,hostId:uid,challengerId:participants[0],source:'standalone',now,seed});
  Object.assign(b,{format,challengeId,name:c.name,stage:'intro',devSelected:true});
  room.phase='board';room.turnIndex=0;room.turnState={playerId:uid,rolled:true,movementRemaining:0,readyToEnd:false,battle:b};
  return room;
 },{applyLocally:false});
 if(!result.committed)throw Error(error||'Could not start this Battle.');
}

export async function returnToBattleSelection(code,uid){
 requireOnlineIdentity(uid);await clock();const now=challengeNow();let error='';
 const result=await runTransaction(path(code),room=>{
  error='';
  if(!room||room.mode!=='battle'||room.hostId!==uid||room.status!=='playing'){error='Only the Battle host can continue.';return}
  const battle=room.turnState?.battle;
  if(!battle||battle.status!=='resolved'){error='Finish, confirm or cancel this Battle first.';return}
  if(!battle.cancelled && room.phase!=='battle-results'){error='Confirm results before continuing.';return}
  delete room.turnState;
  if((room.battleGame?.completed||0)>=(room.battleGame?.rounds||Infinity)){
   room.phase='battle-complete';room.battleGame.finishedAt=now;
  }else room.phase='battle-selection';
  return room;
 },{applyLocally:false});
 if(!result.committed)throw Error(error||'Could not continue.');
}

export async function leaveStandaloneBattle(code,uid){
 requireOnlineIdentity(uid)
 const {get,update}=await import('firebase/database'),roomRef=path(code),room=(await get(roomRef)).val()
 if(!room||room.mode!=='battle'||!room.players?.[uid])return
 if(room.hostId===uid){await update(roomRef,{status:'ended',endedAt:challengeNow(),endedBy:uid});return}
 const changes={[`players/${uid}`]:null,[`departedPlayers/${uid}`]:{leftAt:challengeNow(),reason:'left'}}
 if(room.status==='lobby')for(const [seat,id] of Object.entries(room.seats||{}))if(id===uid)changes[`seats/${seat}`]=null
 await update(roomRef,changes)
}
