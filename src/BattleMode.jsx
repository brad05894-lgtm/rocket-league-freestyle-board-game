import { useEffect, useState } from 'react'
import { initializeOnlineIdentity } from './onlineIdentity'
import { createPartyRoom, joinPartyRoom, listenToPartyRoom } from './partyMultiplayer'
import { startStandaloneBattle, returnToBattleSelection, leaveStandaloneBattle } from './partyChallengeTransport'
import { PARTY_CHALLENGES, CHALLENGE_BY_ID, FORMAT_SIZES } from './partyChallengeCatalog'
import PartyChallenge from './PartyChallenge'
import PartyHostControls from './PartyHostControls'
import { readPartySession, savePartySession, clearPartySession } from './partySession'

export default function BattleMode({onBack}) {
 const [uid,setUid]=useState(''),[code,setCode]=useState(''),[room,setRoom]=useState(null),[name,setName]=useState(''),[joinCode,setJoinCode]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const [battleId,setBattleId]=useState(PARTY_CHALLENGES[0].id),[format,setFormat]=useState('1v1'),[selected,setSelected]=useState([])
 useEffect(()=>{let active=true;initializeOnlineIdentity().then(id=>{if(!active)return;setUid(id);const s=readPartySession();if(s?.uid===id&&s.mode==='battle')setCode(s.roomCode)}).catch(e=>setError(e.message));return()=>{active=false}},[])
 useEffect(()=>{if(!code||!uid)return;savePartySession(code,uid,'battle');return listenToPartyRoom(code,r=>{if(!r||r.status==='ended'||!r.players?.[uid]){clearPartySession();setCode('');setRoom(null);return}setRoom(r)},e=>setError(e.message))},[code,uid])
 const host=room?.hostId===uid,players=Object.values(room?.players||{}),challenge=CHALLENGE_BY_ID[battleId]
 const roster=selected.filter(id=>room?.players?.[id])
 async function run(fn){if(busy)return;setBusy(true);setError('');try{await fn()}catch(e){setError(e.message)}finally{setBusy(false)}}
 async function leave(){if(!window.confirm(host?'End Battle Mode for everyone?':'Leave this room?'))return;await run(async()=>{await leaveStandaloneBattle(code,uid);clearPartySession();setCode('');setRoom(null);onBack()})}
 const battle=room?.turnState?.battle
 if(battle?.status==='active')return <PartyChallenge room={room} roomCode={code} clientId={uid} onLeave={leave}/>
 return <main className="game battle-mode"><h1>Battle Mode</h1>{error&&<p role="alert">{error}</p>}
 {!code?<><p>Create or join a room for 2–4 players. Play battles without the board.</p><label>Your name<input value={name} maxLength={20} onChange={e=>setName(e.target.value)}/></label><button disabled={busy||!uid||!name.trim()} onClick={()=>run(async()=>setCode(await createPartyRoom(name,'battle')))}>Create Battle Room</button><label>Room code<input value={joinCode} maxLength={8} onChange={e=>setJoinCode(e.target.value.toUpperCase())}/></label><button disabled={busy||!uid||!name.trim()||!joinCode.trim()} onClick={()=>run(async()=>setCode(await joinPartyRoom(joinCode,name)))}>Join Battle Room</button><button onClick={onBack}>Back</button></>:!room?<p>Connecting…</p>:room.mode!=='battle'?<><p>This is a Party room. Return to Party Mode to play it.</p><button onClick={()=>{savePartySession(code,uid);onBack()}}>Back to menu</button></>:<>
 <h2>Room: {code}</h2><p>{players.map(p=>p.name+(p.id===room.hostId?' (Host)':'')).join(' · ')} · {players.length}/4</p>
 {battle?.status==='resolved'?<><h2>{battle.name}</h2><p>{battle.resultMessage}</p>{battle.game?.result?.placements.map((ids,i)=><p key={i}>{i+1}. {ids.map(id=>room.players[id]?.name||'Departed player').join(' / ')}</p>)}{host?<button disabled={busy} onClick={()=>run(()=>returnToBattleSelection(code,uid))}>Choose next battle</button>:<p>Waiting for the host to choose the next battle.</p>}</>:host?<section className="bc-dev"><label>Battle<select value={battleId} onChange={e=>{setBattleId(e.target.value);setFormat(CHALLENGE_BY_ID[e.target.value].formats[0]);setSelected([])}}>{PARTY_CHALLENGES.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Format<select value={format} onChange={e=>{setFormat(e.target.value);setSelected([])}}>{challenge.formats.map(f=><option key={f} disabled={FORMAT_SIZES[f]>players.length}>{f}</option>)}</select></label><p>Choose {FORMAT_SIZES[format]} participants. The host keeps the controls even when spectating.</p>{players.map(p=><label key={p.id}><input type="checkbox" checked={roster.includes(p.id)} onChange={e=>setSelected(e.target.checked?[...roster,p.id]:roster.filter(id=>id!==p.id))}/>{p.name}</label>)}<button disabled={busy||roster.length!==FORMAT_SIZES[format]} onClick={()=>run(()=>startStandaloneBattle(code,uid,battleId,format,roster))}>Start selected battle</button></section>:<p>Waiting for the host to select a battle.</p>}
 <PartyHostControls room={room} roomCode={code} clientId={uid}/><button disabled={busy} onClick={leave}>{host?'End game':'Leave game'}</button>
 </>}
 </main>
}
