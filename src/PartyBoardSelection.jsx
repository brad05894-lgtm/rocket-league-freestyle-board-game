import {useState} from 'react'
import PartyBoard from './PartyBoard'
import {getPartyBoard} from './partyBoards'
import {confirmPartyBoardSelection} from './partyMultiplayer'
import './partyImmersive.css'
export default function PartyBoardSelection({room,roomCode,clientId,isHost,onLeave}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[selected,setSelected]=useState('booststone-ruins')
 const preview={...room,settings:{...room.settings,mapId:selected},boardState:{bombCountdown:5,conveyorLane:'lower'}},board=getPartyBoard(preview)
 async function choose(){setBusy(true);setError('');try{await confirmPartyBoardSelection(roomCode,clientId,selected)}catch(e){setError(e.message)}finally{setBusy(false)}}
 return <main className="party-board-select"><div className="party-board-select-model"><PartyBoard key={selected} board={board} room={preview} players={[]} activePlayer={null} overview quality="low"/></div><header><small>Cars ready · Next: choose a board</small><h1>Choose your board</h1></header><section className="party-board-select-card"><label>Board<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="booststone-ruins">Booststone Ruins</option><option value="demo-mines">Demo Mines</option></select></label><h2>{board.name}</h2><p>{selected==='demo-mines'?'Risk the gold mines, ride between corners, and avoid the ticking central bomb.':'Explore jungle ruins, garage gates and the rolling Boost Ball.'}</p><small>Drag to rotate · Pinch or scroll to zoom</small>{isHost?<button disabled={busy} onClick={choose}>{busy?'Loading…':`Play ${board.name}`}</button>:<p>Waiting for the host to choose the board…</p>}{error&&<p role="alert">{error}</p>}<button className="party-board-select-leave" disabled={busy} onClick={onLeave}>{isHost?'End Party':'Leave Party'}</button></section></main>
}
