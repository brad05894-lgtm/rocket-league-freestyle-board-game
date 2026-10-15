import { useEffect, useMemo, useState } from 'react'
import { initializeOnlineIdentity } from './onlineIdentity'
import { createPartyRoom, joinPartyRoom, listenToPartyRoom, updatePartyRounds } from './partyMultiplayer'
import { startBattleSession, startStandaloneBattle, returnToBattleSelection, leaveStandaloneBattle } from './partyChallengeTransport'
import { PARTY_CHALLENGES, CHALLENGE_BY_ID, FORMAT_SIZES } from './partyChallengeCatalog'
import { battleLeaderboard, BATTLE_PLACE_POINTS } from './battleScoring'
import PartyChallenge from './PartyChallenge'
import PartyHostControls from './PartyHostControls'
import { readPartySession, savePartySession, clearPartySession } from './partySession'
import './BattleMode.css'

const FORMATS = Object.keys(FORMAT_SIZES)

function BattleStandings({ game, compact = false }) {
  if (!game) return null
  const rows = battleLeaderboard(game, game.names)
  return <section className={'home-mode-card battle-session__standings' + (compact ? ' battle-session__standings--compact' : '')}>
    <p className="home-mode-card__eyebrow">{compact ? 'Current Standings' : 'Final Standings'}</p>
    {!compact && <h2>The Results Are In!</h2>}
    <div className="battle-session__scores">
      {rows.map(row => <div className={row.rank === 1 ? 'battle-session__score is-leading' : 'battle-session__score'} key={row.id}>
        <strong className="battle-session__rank">#{row.rank}</strong><span>{row.name}</span>
        <strong className="battle-session__points">{row.points} pts</strong>
      </div>)}
    </div>
    <small>{compact ? `Rounds completed: ${game.completed} / ${game.rounds}` : 'Equal point totals share the same placement.'}</small>
  </section>
}

export default function BattleMode({ onBack }) {
  const [screen, setScreen] = useState('home')
  const [uid, setUid] = useState('')
  const [restoring, setRestoring] = useState(true)
  const [code, setCode] = useState('')
  const [room, setRoom] = useState(null)
  const [name, setName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [roundInput, setRoundInput] = useState('10')
  const [query, setQuery] = useState('')
  const [battleId, setBattleId] = useState(PARTY_CHALLENGES[0].id)
  const [format, setFormat] = useState('1v1')
  const [selected, setSelected] = useState([])

  useEffect(() => {
    let active = true
    initializeOnlineIdentity().then(id => {
      if (!active) return
      setUid(id)
      const previous = readPartySession()
      if (previous?.uid === id && previous.mode === 'battle') { setCode(previous.roomCode); setScreen('lobby') }
    }).catch(e => active && setError(e.message || 'Could not connect to online play.'))
      .finally(() => active && setRestoring(false))
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!code || !uid) return undefined
    return listenToPartyRoom(code, next => {
      if (!next || next.status === 'ended' || next.departedPlayers?.[uid] || next.kickedPlayers?.[uid] || !next.players?.[uid]) {
        clearPartySession(); setCode(''); setRoom(null); setScreen('home')
        setNotice('That Battle room is no longer available.'); return
      }
      if (next.mode !== 'battle') {
        setCode(''); setRoom(null); setScreen('home')
        setError('That room belongs to Party Mode, not Battle Mode.'); return
      }
      savePartySession(code, uid, 'battle')
      setRoom(next)
    }, e => setError(e.message || 'Connection interrupted. Your Battle progress is saved; reconnect and retry.'))
  }, [code, uid])

  const isHost = room?.hostId === uid
  const players = useMemo(() => Object.values(room?.players || {}).filter(p => !room?.departedPlayers?.[p.id])
    .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0)), [room])
  const rounds = room?.settings?.rounds ?? 10
  useEffect(() => { if (!busy) setRoundInput(String(rounds)) }, [rounds, busy])
  const game = room?.battleGame
  const battle = room?.turnState?.battle
  const completed = Number(game?.completed || 0)
  const matching = useMemo(() => PARTY_CHALLENGES.filter(c =>
    `${c.number} ${c.name}`.toLowerCase().includes(query.trim().toLowerCase())), [query])
  const challenge = CHALLENGE_BY_ID[battleId]
  const availableFormats = challenge?.formats.filter(f => FORMATS.includes(f)) || []
  const selectedFormat = availableFormats.includes(format) ? format : availableFormats[0]
  const needed = FORMAT_SIZES[selectedFormat] || 2
  const roster = selected.filter(id => players.some(p => p.id === id))
  const errorBox = error && <p className="party-form-error" role="alert"><strong>{error}</strong></p>

  async function run(action) {
    if (busy) return
    setBusy(true); setError('')
    try { await action() } catch (e) { setError(e.message || 'Please try again.') }
    finally { setBusy(false) }
  }

  async function leave() {
    if (!code) { setScreen('home'); setError(''); return }
    if (!window.confirm(isHost ? 'End this Battle session for everyone?' : 'Leave this Battle session? Closing this tab instead lets you resume later.')) return
    await run(async () => {
      await leaveStandaloneBattle(code, uid)
      clearPartySession(); setCode(''); setRoom(null); setScreen('home'); setNotice('You left Battle Mode.')
    })
  }

  function changeChallenge(id) {
    setBattleId(id)
    if (!CHALLENGE_BY_ID[id]?.formats.includes(format)) setFormat(CHALLENGE_BY_ID[id]?.formats[0] || '1v1')
    setSelected([])
  }

  async function create(e) {
    e.preventDefault()
    if (!name.trim()) { setError('Enter your name.'); return }
    await run(async () => { setCode(await createPartyRoom(name.trim(), 'battle')); setScreen('lobby'); setNotice('') })
  }
  async function join(e) {
    e.preventDefault()
    if (!name.trim()) { setError('Enter your name.'); return }
    await run(async () => { setCode(await joinPartyRoom(joinCode.trim(), name.trim(), 'battle')); setScreen('lobby'); setNotice('') })
  }

  if (restoring || (code && !room)) return <main className="game home-screen party-form-screen battle-session">
    <h1>Reconnecting to Battle Mode…</h1>
    <p>Your existing room and points will reappear.</p>{errorBox}
    <button onClick={() => window.location.reload()}>Retry connection</button>
    <button onClick={() => { clearPartySession(); setCode(''); setRoom(null); setScreen('home'); setRestoring(false) }}>Back to Battle Menu</button>
  </main>

  // Reuse the same full-screen multiplayer Challenge and its recovery controls.
  if (room?.status === 'playing' && battle?.status === 'active') {
    return <PartyChallenge room={room} roomCode={code} clientId={uid} onLeave={leave} />
  }

  if (!code && (screen === 'create' || screen === 'join')) {
    const creating = screen === 'create'
    return <main className="game home-screen party-form-screen battle-session">
      <div className="party-mode-home__topbar"><button onClick={() => { setScreen('home'); setError('') }}>← Back to Battle Mode</button></div>
      <p className="home-mode-card__eyebrow">{creating ? 'Create Battle Party' : 'Join Battle Party'}</p>
      <h1 className="party-lobby-title">{creating ? 'Start a Battle Lobby' : 'Join a Battle Lobby'}</h1>
      <form className="party-online-form" onSubmit={creating ? create : join}>
        <label>Your Name<input value={name} maxLength={20} autoComplete="nickname" placeholder="Player name" onChange={e => setName(e.target.value)}/></label>
        {!creating && <label>Room Code<input value={joinCode} maxLength={8} autoCapitalize="characters" placeholder="ABCD2345" onChange={e => setJoinCode(e.target.value.toUpperCase())}/></label>}
        {errorBox}
        <button disabled={busy || !uid} type="submit">{busy ? 'Please wait…' : creating ? 'Create Party' : 'Join Party'}</button>
      </form>
    </main>
  }

  if (!code) return <main className="game home-screen party-mode-home battle-session">
    <div className="party-mode-home__topbar"><button onClick={onBack}>← Back to Main Menu</button></div>
    <h1 className="home-screen__title"><span>Rocket League Freestyle</span><span>Battle Mode</span></h1>
    <p className="home-screen__subtitle">2–4 Players • Choose your Challenges • Multiple Rounds</p>
    {errorBox}
    {notice && <p className="party-home-notice" role="status"><strong>{notice}</strong></p>}
    <div className="home-mode-grid home-mode-grid--party-menu">
      <section className="home-mode-card home-mode-card--party">
        <div><p className="home-mode-card__eyebrow">Play Online</p><h2>Create Party</h2>
          <p>Create a Battle room, set the rounds, and invite 1–3 other players.</p></div>
        <div className="menu home-mode-card__menu"><button onClick={() => { setScreen('create'); setError('') }}>Create Party</button></div>
      </section>
      <section className="home-mode-card home-mode-card--party">
        <div><p className="home-mode-card__eyebrow">Play Online</p><h2>Join Party</h2>
          <p>Join a friend's Battle Mode lobby using its 8-character room code.</p></div>
        <div className="menu home-mode-card__menu"><button onClick={() => { setScreen('join'); setError('') }}>Join Party</button></div>
      </section>
    </div>
  </main>

  if (room.status === 'lobby') return <main className="game home-screen party-lobby-screen battle-session">
    <div className="party-mode-home__topbar"><button onClick={leave} disabled={busy}>← {isHost ? 'Close Party' : 'Leave Party'}</button></div>
    <p className="home-mode-card__eyebrow">Battle Lobby</p><h1 className="party-lobby-title">Battle Mode</h1>
    <p className="home-screen__subtitle">Room Code: <strong className="battle-session__code">{code}</strong></p>
    <button className="battle-session__copy" type="button" onClick={() => {
      if (!navigator.clipboard?.writeText) { setNotice('Copy the room code shown above.'); return }
      navigator.clipboard.writeText(code).then(() => setNotice('Room code copied.')).catch(() => setError('Could not copy the room code.'))
    }}>Copy Room Code</button>
    <div className="party-lobby-grid">
      <section className="home-mode-card party-lobby-card">
        <div><p className="home-mode-card__eyebrow">Players</p><h2>{players.length} / 4 Players</h2></div>
        <div className="party-player-list">{players.map((p, i) => <div className="party-player-row" key={p.id}>
          <span className="party-player-number">P{i + 1}</span>
          <div className="party-player-row__identity"><strong>{p.name}</strong><span>{p.id === uid ? 'You' : 'Ready to Battle'}</span></div>
          {p.id === room.hostId && <span className="party-host-badge">Host</span>}
        </div>)}</div>
        {players.length < 2 && <p className="party-lobby-hint">At least 2 players must join before starting.</p>}
      </section>
      <section className="home-mode-card home-mode-card--party party-lobby-card">
        <div><p className="home-mode-card__eyebrow">Game Settings</p><h2>{rounds} Rounds</h2>
          <p><strong>Players:</strong> 2–4</p><p><strong>Battles:</strong> Host chooses each round</p>
          <p>No board, cars, cards, or hand-visibility settings.</p></div>
        <form className="party-round-picker" onSubmit={e => { e.preventDefault(); run(() => updatePartyRounds(code, uid, Number(roundInput))) }}>
          <label>Number of rounds<input type="text" inputMode="numeric" value={roundInput} disabled={!isHost || busy} onChange={e => setRoundInput(e.target.value)} style={{fontSize:16,width:100,padding:10}}/></label>
          {isHost && <button type="submit" disabled={busy || !/^\d+$/.test(roundInput) || Number(roundInput) < 1 || Number(roundInput) > 999}>Save rounds</button>}
          <small>1–999 rounds. Current setting: {rounds}.</small>
        </form>
        {isHost && <PartyHostControls room={room} roomCode={code} clientId={uid}/>}
        {!isHost && <p className="party-lobby-hint">Only the host can change the round count.</p>}
      </section>
    </div>
    {errorBox}{notice && <p role="status" className="party-home-notice">{notice}</p>}
    <div className="party-lobby-actions">{isHost
      ? <button disabled={busy || players.length < 2} onClick={() => run(() => startBattleSession(code, uid))}>{busy ? 'Starting…' : 'Start Battle Mode'}</button>
      : <div className="party-waiting-box">Waiting for the host to start Battle Mode…</div>}</div>
    <p className="party-stage-note">The host chooses a Challenge and its participants each round. Everyone earns Battle points from their placements.</p>
  </main>

  const finished = room.phase === 'battle-complete'
  if (finished) return <main className="game home-screen party-lobby-screen battle-session battle-session--final">
    <div className="party-mode-home__topbar"><button disabled={busy} onClick={leave}>← {isHost ? 'End Battle Party' : 'Leave Battle Party'}</button></div>
    <p className="home-mode-card__eyebrow">Battle Mode Complete</p>
    <h1 className="party-lobby-title">Final Results</h1>
    <p className="home-screen__subtitle">{game?.completed} / {game?.rounds} rounds played</p>
    <BattleStandings game={game}/>
    <section className="home-mode-card battle-session__history"><h2>Round-by-Round Results</h2>
      {Object.values(game?.history || {}).map(entry => <div key={entry.battleId} className="battle-session__history-row">
        <strong>Round {entry.round}: {entry.name}</strong><span>{entry.format}</span>
        <small>{Object.entries(entry.points || {}).filter(([, n]) => n > 0).map(([id, n]) => `${game?.names?.[id] || 'Player'} +${n}`).join(' · ') || 'No points awarded'}</small>
      </div>)}
    </section>
    <button onClick={leave} disabled={busy}>Return to Battle Mode Menu</button>
    {errorBox}
  </main>

  const resolved = battle?.status === 'resolved'
  return <main className="game home-screen party-lobby-screen battle-session battle-session--playing">
    <div className="party-mode-home__topbar"><button onClick={leave} disabled={busy}>← {isHost ? 'End Battle Party' : 'Leave Battle Party'}</button></div>
    <p className="home-mode-card__eyebrow">Battle Mode • Room {code}</p>
    <h1 className="party-lobby-title">{resolved ? (battle.cancelled ? 'Battle Cancelled' : 'Round Complete!') : `Round ${completed + 1} / ${game?.rounds || rounds}`}</h1>
    <p className="home-screen__subtitle">{resolved ? battle.name : 'Host chooses the Challenge, format, and participants.'}</p>
    <div className="battle-session__playing-grid">
      <div>
        {resolved ? <section className="home-mode-card battle-session__picker">
          <p className="home-mode-card__eyebrow">{battle.cancelled ? 'No points awarded' : `Round ${completed} / ${game?.rounds} confirmed`}</p>
          <h2>{battle.name}</h2><p>{battle.resultMessage}</p>
          {!battle.cancelled && <div className="battle-session__awards">{Object.entries(battle.rewards || {}).map(([id, n]) =>
            <div key={id}><strong>{game?.names?.[id] || room.players?.[id]?.name || 'Player'}</strong><span>+{n} Battle pts</span></div>)}</div>}
          {isHost ? <button className="battle-session__primary" disabled={busy} onClick={() => run(() => returnToBattleSelection(code, uid))}>
            {battle.cancelled ? 'Retry This Round' : completed >= game?.rounds ? 'Continue to Final Standings' : `Continue to Round ${completed + 1}`}
          </button> : <p>Waiting for the host to continue…</p>}
        </section> : isHost ? <section className="home-mode-card battle-session__picker">
          <p className="home-mode-card__eyebrow">Host Controls</p><h2>Choose This Round's Battle</h2>
          <label>Search Battles<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name or number"/></label>
          <label>Select a Challenge<select value={matching.some(c => c.id === battleId) ? battleId : ''} onChange={e => changeChallenge(e.target.value)}>
            {!matching.some(c => c.id === battleId) && <option value="">Select from matches…</option>}
            {matching.map(c => <option value={c.id} key={c.id}>#{c.number} · {c.name}</option>)}
          </select></label>
          {matching.length === 0 && <p>No Challenges match your search.</p>}
          <fieldset className="battle-session__formats"><legend>Battle Format</legend>
            {availableFormats.map(f => <button type="button" key={f} aria-pressed={selectedFormat === f} disabled={FORMAT_SIZES[f] > players.length}
              className={selectedFormat === f ? 'is-selected' : ''} onClick={() => { setFormat(f); setSelected([]) }}>{f}</button>)}
          </fieldset>
          <fieldset className="battle-session__participants"><legend>Choose {needed} Players</legend>
            <p>Choose which players compete. Nonparticipants earn 0 points this round.</p>
            {players.map(p => <label key={p.id}><input type="checkbox" checked={roster.includes(p.id)}
              disabled={!roster.includes(p.id) && roster.length >= needed}
              onChange={e => setSelected(e.target.checked ? [...roster, p.id] : roster.filter(id => id !== p.id))}/>
              {p.name}{p.id === uid ? ' (You)' : ''}</label>)}
          </fieldset>
          <button className="battle-session__primary" disabled={busy || !matching.some(c => c.id === battleId) || roster.length !== needed || needed > players.length}
            onClick={() => run(() => startStandaloneBattle(code, uid, battleId, selectedFormat, roster))}>{busy ? 'Starting…' : `Start ${challenge?.name || 'Battle'}`}</button>
          {players.length < needed && <p>Not enough active players for this format.</p>}
        </section> : <section className="home-mode-card battle-session__picker"><h2>Waiting for the Host</h2>
          <p>The host is choosing the Challenge, format, and participants. Your Battle will open automatically.</p>
        </section>}
        {isHost && <PartyHostControls room={room} roomCode={code} clientId={uid}/>}
      </div>
      <div><BattleStandings game={game} compact/>
        <section className="home-mode-card battle-session__rules"><p className="home-mode-card__eyebrow">Scoring</p>
          <h2>Battle Points</h2><p><strong>Team Battles / 1v1:</strong> Winners +3 each; losing side +0.</p>
          <p><strong>Free-for-all:</strong> 1st +{BATTLE_PLACE_POINTS[0]}, 2nd +{BATTLE_PLACE_POINTS[1]}, 3rd +{BATTLE_PLACE_POINTS[2]}, 4th +{BATTLE_PLACE_POINTS[3]}.</p>
          <p>Allowed draws: +1 each. Tied FFA placements receive the lowest points in the tied positions. Nonparticipants receive 0.</p>
          <p>Most points after {game?.rounds} rounds wins. Equal totals share the place.</p>
        </section>
      </div>
    </div>
    {errorBox}
  </main>
}
