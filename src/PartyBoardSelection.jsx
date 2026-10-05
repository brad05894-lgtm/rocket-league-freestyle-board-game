import { useState } from 'react'
import BooststoneRuins3D from './BooststoneRuins3D'
import { BOOSTSTONE_RUINS } from './booststoneRuins'
import { confirmPartyBoardSelection } from './partyMultiplayer'
import './partyImmersive.css'
export default function PartyBoardSelection({room,roomCode,clientId,isHost,onLeave}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('')
 async function choose(){setBusy(true);setError('');try{await confirmPartyBoardSelection(roomCode,clientId,'booststone-ruins')}catch(e){setError(e.message)}finally{setBusy(false)}}
 return <main className="party-board-select"><div className="party-board-select-model"><BooststoneRuins3D board={BOOSTSTONE_RUINS} room={room} players={[]} activePlayer={null} overview quality="low"/></div><header><small>Cars ready · Next: choose a board</small><h1>Choose your board</h1></header><section className="party-board-select-card"><p>BOARD 1 / 1</p><h2>Booststone Ruins</h2><p>Explore jungle ruins, garage gates and the rolling Boost Ball.</p><small>Drag to rotate · Pinch or scroll to zoom</small>{isHost?<button disabled={busy} onClick={choose}>{busy?'Loading…':'Play Booststone Ruins'}</button>:<p>Waiting for the host to choose the board…</p>}{error&&<p role="alert">{error}</p>}<button className="party-board-select-leave" disabled={busy} onClick={onLeave}>{isHost?'End Party':'Leave Party'}</button></section></main>
}
