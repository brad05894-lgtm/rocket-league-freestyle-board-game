import { useRef, useState, useEffect } from 'react'
import BooststoneRuins3D from './BooststoneRuins3D'
import { BOOSTSTONE_RUINS } from './booststoneRuins'
import { updatePartyShowcaseCamera, finishPartyShowcase } from './partyMultiplayer'
export default function PartyShowcase({ room, roomCode, clientId, isHost, onLeave }) {
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const latest = useRef(null), sending = useRef(false)
  useEffect(() => {
    if (!isHost) return
    let active = true
    const timer = setInterval(async () => {
      if (!latest.current || sending.current) return
      const pose = latest.current; latest.current = null; sending.current = true
      try { await updatePartyShowcaseCamera(roomCode, clientId, pose); if(active) setError('') }
      catch(e) { if(active) setError(e.message) }
      finally { sending.current = false }
    }, 200)
    return () => { active = false; clearInterval(timer) }
  }, [roomCode, clientId, isHost])
  async function start() { setBusy(true); try { await finishPartyShowcase(roomCode, clientId) } catch(e) {setError(e.message);setBusy(false)} }
  const players = Object.values(room.players || {})
  return <main className="party-showcase"><div className="party-showcase-board"><BooststoneRuins3D board={BOOSTSTONE_RUINS} room={room} players={players} turnOrderPhase overview quality="low" showcase={{host:isHost,camera:room.showcaseCamera,onChange:pose=>{latest.current=pose}}}/></div><section className="party-showcase-controls"><h2>Board Showcase</h2><p>{isHost?'Explore the board together. Drag to rotate; pinch or scroll to zoom.':'Following the host’s camera…'}</p>{isHost&&<button disabled={busy} onClick={start}>Start Turn-Order Rolls</button>}<button disabled={busy} onClick={onLeave}>{isHost?'End Party':'Leave Party'}</button>{error&&<p role="alert">{error}</p>}</section></main>
}
