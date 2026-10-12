import { useState } from 'react'
import { kickPartyPlayer, skipPartyTurn } from './partyMultiplayer'

export default function PartyHostControls({room, roomCode, clientId}) {
  const [target, setTarget] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('')
  if (room.hostId !== clientId) return null
  async function run(action) {
    if (busy) return
    setBusy(true); setError('')
    try { await action(); setTarget('') } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return <details className="party-host-controls"><summary>Host controls / recovery</summary>
    <label>Remove a player<select value={room.players?.[target] ? target : ''} disabled={busy} onChange={e=>setTarget(e.target.value)}>
      <option value="">Choose player…</option>{Object.values(room.players||{}).filter(p=>p.id!==clientId).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
    </select></label>
    <button disabled={busy||!room.players?.[target]} onClick={()=>window.confirm(`Remove ${room.players[target]?.name}? An affected Battle will be cancelled without new rewards.`)&&run(()=>kickPartyPlayer(roomCode,clientId,target))}>Kick selected player</button>
    {room.phase==='board'&&<button disabled={busy} onClick={()=>window.confirm('Skip the current turn? Existing balances stay; unfinished rewards are cancelled.')&&run(()=>skipPartyTurn(roomCode,clientId))}>Skip current turn</button>}
    {error&&<p role="alert">{error}</p>}
  </details>
}
