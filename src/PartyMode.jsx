import { useEffect, useMemo, useState } from 'react'
import V2BoardPreview from './V2BoardPreview'
import PartyGame from './PartyGame'
import { BOOSTSTONE_RUINS } from './booststoneRuins'
import { getClientId } from './multiplayer'
import {
  PARTY_CARS,
  formatPartyDieFace,
  getPartyCar,
} from './partyCars'
import {
  clearPartyCarSelection,
  createPartyRoom,
  joinPartyRoom,
  leavePartyRoom,
  listenToPartyRoom,
  selectPartyCar,
  startPartyRoom,
  updatePartyCardVisibility,
  updatePartyRounds,
} from './partyMultiplayer'

const ROUND_OPTIONS = [10, 15, 20]

function PartyMode({ onBack }) {
  const [screen, setScreen] = useState('home')
  const [name, setName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [room, setRoom] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [carLoadingId, setCarLoadingId] = useState('')

  const clientId = getClientId()

  const roomPlayers = useMemo(() => {
    if (!room?.players) return []

    return Object.values(room.players).sort(
      (first, second) => (first.joinedAt || 0) - (second.joinedAt || 0)
    )
  }, [room])

  const isHost = room?.hostId === clientId
  const rounds = room?.settings?.rounds ?? 10
  const cardVisibility = room?.settings?.cardVisibility === 'open' ? 'open' : 'hidden'
  const currentPlayer = roomPlayers.find((player) => player.id === clientId) || null
  const selectedCar = getPartyCar(currentPlayer?.carId)
  const allPlayersReady =
    roomPlayers.length >= 2 &&
    roomPlayers.length <= 4 &&
    roomPlayers.every((player) => Boolean(player.carId))

  const takenCarIds = useMemo(
    () => new Set(
      roomPlayers
        .filter((player) => player.id !== clientId && player.carId)
        .map((player) => player.carId)
    ),
    [roomPlayers, clientId]
  )

  useEffect(() => {
    if (!roomCode) return undefined

    const unsubscribe = listenToPartyRoom(roomCode, (nextRoom) => {
      if (!nextRoom) {
        setRoom(null)
        setRoomCode('')
        setScreen('home')
        setNotice('That Party room is no longer available.')
        return
      }

      if (nextRoom.status === 'ended') {
        setRoom(null)
        setRoomCode('')
        setScreen('home')
        setNotice('The host closed the Party room.')
        return
      }

      setRoom(nextRoom)
    })

    return () => unsubscribe()
  }, [roomCode])

  async function handleCreate(event) {
    event.preventDefault()
    const trimmedName = name.trim()

    if (!trimmedName) {
      setError('Enter your name first.')
      return
    }

    try {
      setLoading(true)
      setError('')
      setNotice('')
      const code = await createPartyRoom(trimmedName)
      setRoomCode(code)
      setScreen('lobby')
    } catch (createError) {
      setError(createError.message || 'Could not create the Party room.')
    } finally {
      setLoading(false)
    }
  }

  async function handleJoin(event) {
    event.preventDefault()
    const trimmedName = name.trim()
    const trimmedCode = joinCode.trim().toUpperCase()

    if (!trimmedName) {
      setError('Enter your name first.')
      return
    }

    if (!trimmedCode) {
      setError('Enter the Party room code.')
      return
    }

    try {
      setLoading(true)
      setError('')
      setNotice('')
      const code = await joinPartyRoom(trimmedCode, trimmedName)
      setRoomCode(code)
      setJoinCode(code)
      setScreen('lobby')
    } catch (joinError) {
      setError(joinError.message || 'Could not join the Party room.')
    } finally {
      setLoading(false)
    }
  }

  async function handleRoundsChange(nextRounds) {
    if (!roomCode || !isHost) return

    try {
      setError('')
      await updatePartyRounds(roomCode, clientId, nextRounds)
    } catch (settingsError) {
      setError(settingsError.message || 'Could not change the round count.')
    }
  }

  async function handleCardVisibilityChange(nextVisibility) {
    if (!roomCode || !isHost) return

    try {
      setError('')
      await updatePartyCardVisibility(roomCode, clientId, nextVisibility)
    } catch (settingsError) {
      setError(settingsError.message || 'Could not change Card visibility.')
    }
  }

  async function handleCarSelect(carId) {
    if (!roomCode || !currentPlayer || room?.status !== 'lobby') return

    try {
      setCarLoadingId(carId)
      setError('')
      await selectPartyCar(roomCode, clientId, carId)
    } catch (selectionError) {
      setError(selectionError.message || 'Could not select that car.')
    } finally {
      setCarLoadingId('')
    }
  }

  async function handleClearCar() {
    if (!roomCode || !currentPlayer) return

    try {
      setCarLoadingId('clear')
      setError('')
      await clearPartyCarSelection(roomCode, clientId)
    } catch (selectionError) {
      setError(selectionError.message || 'Could not clear your car selection.')
    } finally {
      setCarLoadingId('')
    }
  }

  async function handleStartParty() {
    if (!roomCode || !isHost) return

    try {
      setLoading(true)
      setError('')
      await startPartyRoom(roomCode, clientId)
    } catch (startError) {
      setError(startError.message || 'Could not start the Party game.')
    } finally {
      setLoading(false)
    }
  }

  async function handleLeaveParty() {
    if (!roomCode) {
      setScreen('home')
      return
    }

    try {
      setLoading(true)
      await leavePartyRoom(roomCode, clientId)
    } catch (leaveError) {
      setError(leaveError.message || 'Could not leave the Party room.')
    } finally {
      setRoom(null)
      setRoomCode('')
      setLoading(false)
      setScreen('home')
    }
  }

  if (roomCode && room?.status === 'playing') {
    return (
      <PartyGame
        roomCode={roomCode}
        room={room}
        clientId={clientId}
        onLeave={handleLeaveParty}
        isHost={isHost}
      />
    )
  }

  if (roomCode && room) {
    return (
      <div className="game home-screen party-lobby-screen">
        <div className="party-mode-home__topbar">
          <button type="button" onClick={handleLeaveParty} disabled={loading}>
            ← {isHost ? 'Close Party' : 'Leave Party'}
          </button>
        </div>

        <p className="home-mode-card__eyebrow">Party Lobby</p>
        <h1 className="party-lobby-title">Booststone Ruins</h1>
        <p className="home-screen__subtitle">
          Room Code: <strong>{roomCode}</strong>
        </p>

        <div className="party-lobby-grid">
          <section className="home-mode-card party-lobby-card">
            <div>
              <p className="home-mode-card__eyebrow">Players</p>
              <h2>{roomPlayers.length} / 4 Players</h2>
            </div>

            <div className="party-player-list">
              {roomPlayers.map((player, index) => {
                const car = getPartyCar(player.carId)

                return (
                  <div className="party-player-row" key={player.id}>
                    <span className="party-player-number">P{index + 1}</span>
                    <div className="party-player-row__identity">
                      <strong>{player.name}</strong>
                      <span>{car ? car.name : 'Choosing car…'}</span>
                    </div>
                    {player.id === room.hostId && <span className="party-host-badge">Host</span>}
                  </div>
                )
              })}
            </div>

            {roomPlayers.length < 2 && (
              <p className="party-lobby-hint">At least 2 players are required to start.</p>
            )}
            {roomPlayers.length >= 2 && !allPlayersReady && (
              <p className="party-lobby-hint">Every player must choose a different car before starting.</p>
            )}
          </section>

          <section className="home-mode-card home-mode-card--party party-lobby-card">
            <div>
              <p className="home-mode-card__eyebrow">Game Settings</p>
              <h2>{rounds} Rounds</h2>
              <p><strong>Map:</strong> {BOOSTSTONE_RUINS.name}</p>
              <p><strong>Trophy price:</strong> {BOOSTSTONE_RUINS.defaultTrophyPrice} Tokens</p>
              <p><strong>Players:</strong> 2–4</p>
            </div>

            <div className="party-round-picker" aria-label="Round count">
              {ROUND_OPTIONS.map((option) => (
                <button
                  type="button"
                  key={option}
                  className={rounds === option ? 'party-round-option party-round-option--active' : 'party-round-option'}
                  onClick={() => handleRoundsChange(option)}
                  disabled={!isHost || loading}
                >
                  {option}
                </button>
              ))}
            </div>

            <div style={{ marginTop: 18 }}>
              <p className="home-mode-card__eyebrow">Card Visibility</p>
              <p>
                <strong>{cardVisibility === 'open' ? 'Open Hands' : 'Hidden Hands'}</strong>
                {' — '}
                {cardVisibility === 'open'
                  ? 'Everyone can see every Card. Steal lets you choose the exact Card.'
                  : 'Only your own Cards are visible. Steal takes a random Card.'}
              </p>
              <div className="party-round-picker" aria-label="Card visibility">
                <button
                  type="button"
                  className={cardVisibility === 'hidden' ? 'party-round-option party-round-option--active' : 'party-round-option'}
                  onClick={() => handleCardVisibilityChange('hidden')}
                  disabled={!isHost || loading}
                >
                  Hidden Hands
                </button>
                <button
                  type="button"
                  className={cardVisibility === 'open' ? 'party-round-option party-round-option--active' : 'party-round-option'}
                  onClick={() => handleCardVisibilityChange('open')}
                  disabled={!isHost || loading}
                >
                  Open Hands
                </button>
              </div>
            </div>

            {!isHost && (
              <p className="party-lobby-hint">Only the host can change Party settings.</p>
            )}
          </section>
        </div>

        <section className="party-car-select-panel">
          <div className="party-car-select-panel__header">
            <div>
              <p className="home-mode-card__eyebrow">Your Car</p>
              <h2>{selectedCar ? selectedCar.name : 'Choose a Car'}</h2>
              <p>Every car can use the normal 1–6 die plus its own special die.</p>
            </div>

            {selectedCar && (
              <button
                type="button"
                className="party-car-clear"
                onClick={handleClearCar}
                disabled={Boolean(carLoadingId)}
              >
                Change / Clear
              </button>
            )}
          </div>

          {selectedCar && (
            <div className="party-selected-dice">
              <div>
                <strong>Normal Die</strong>
                <span>1 • 2 • 3 • 4 • 5 • 6</span>
              </div>
              <div>
                <strong>{selectedCar.name} Special Die</strong>
                <span>{selectedCar.specialDie.map(formatPartyDieFace).join(' • ')}</span>
              </div>
            </div>
          )}

          <div className="party-car-grid">
            {PARTY_CARS.map((car) => {
              const isTaken = takenCarIds.has(car.id)
              const isSelected = currentPlayer?.carId === car.id

              return (
                <button
                  type="button"
                  key={car.id}
                  className={`party-car-option${isSelected ? ' party-car-option--selected' : ''}`}
                  onClick={() => handleCarSelect(car.id)}
                  disabled={isTaken || Boolean(carLoadingId)}
                  aria-pressed={isSelected}
                >
                  <span className="party-car-option__name">{car.name}</span>
                  <span className="party-car-option__die-label">Special Die</span>
                  <span className="party-car-option__die">
                    {car.specialDie.map(formatPartyDieFace).join(' • ')}
                  </span>
                  <span className="party-car-option__status">
                    {isTaken
                      ? 'Taken'
                      : isSelected
                        ? 'Selected'
                        : carLoadingId === car.id
                          ? 'Selecting…'
                          : 'Select'}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {error && <p className="party-form-error"><strong>{error}</strong></p>}

        <div className="party-lobby-actions">
          {isHost ? (
            <button
              type="button"
              onClick={handleStartParty}
              disabled={loading || !allPlayersReady}
            >
              {loading ? 'Starting…' : `Start ${rounds}-Round Party`}
            </button>
          ) : (
            <div className="party-waiting-box">
              {allPlayersReady
                ? 'Everyone is ready. Waiting for the host to start…'
                : 'Choose your car, then wait for every player to be ready.'}
            </div>
          )}
        </div>

        <p className="party-stage-note">
          Stage 4 test: car selection shows each special die, and starting the Party now enters the synced dice + movement prototype.
        </p>
      </div>
    )
  }

  if (screen === 'booststone-preview') {
    return <V2BoardPreview onBack={() => setScreen('home')} />
  }

  if (screen === 'create' || screen === 'join') {
    const creating = screen === 'create'

    return (
      <div className="game home-screen party-form-screen">
        <div className="party-mode-home__topbar">
          <button type="button" onClick={() => { setScreen('home'); setError('') }}>
            ← Back to Party Mode
          </button>
        </div>

        <p className="home-mode-card__eyebrow">{creating ? 'Create Party' : 'Join Party'}</p>
        <h1 className="party-lobby-title">{creating ? 'Start a Party Lobby' : 'Join a Party Lobby'}</h1>

        <form className="party-online-form" onSubmit={creating ? handleCreate : handleJoin}>
          <label>
            Your Name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={20}
              autoComplete="nickname"
              placeholder="Player name"
            />
          </label>

          {!creating && (
            <label>
              Room Code
              <input
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                maxLength={4}
                autoCapitalize="characters"
                placeholder="ABCD"
              />
            </label>
          )}

          {error && <p className="party-form-error"><strong>{error}</strong></p>}

          <button type="submit" disabled={loading}>
            {loading
              ? 'Please wait…'
              : creating
                ? 'Create Party'
                : 'Join Party'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="game home-screen party-mode-home">
      <div className="party-mode-home__topbar">
        <button type="button" onClick={onBack}>
          ← Back to Main Menu
        </button>
      </div>

      <h1 className="home-screen__title">
        <span>Rocket League Freestyle</span>
        <span>Party Mode</span>
      </h1>

      <p className="home-screen__subtitle">2–4 Players • 10 / 15 / 20 Rounds</p>

      {notice && <p className="party-home-notice"><strong>{notice}</strong></p>}

      <div className="home-mode-grid home-mode-grid--party-menu">
        <section className="home-mode-card home-mode-card--party">
          <div>
            <p className="home-mode-card__eyebrow">Play Online</p>
            <h2>Create Party</h2>
            <p>Create the room, choose 10 / 15 / 20 rounds, and wait for 1–3 other players.</p>
          </div>

          <div className="menu home-mode-card__menu">
            <button type="button" onClick={() => { setScreen('create'); setError(''); setNotice('') }}>
              Create Party
            </button>
          </div>
        </section>

        <section className="home-mode-card home-mode-card--party">
          <div>
            <p className="home-mode-card__eyebrow">Play Online</p>
            <h2>Join Party</h2>
            <p>Join a friend's Party Mode lobby with its 4-character room code.</p>
          </div>

          <div className="menu home-mode-card__menu">
            <button type="button" onClick={() => { setScreen('join'); setError(''); setNotice('') }}>
              Join Party
            </button>
          </div>
        </section>

        <section className="home-mode-card">
          <div>
            <p className="home-mode-card__eyebrow">Map 1</p>
            <h2>Booststone Ruins</h2>
            <p>Preview the fixed 58-space board separately from an online Party lobby.</p>
          </div>

          <div className="menu home-mode-card__menu">
            <button type="button" onClick={() => setScreen('booststone-preview')}>
              Preview Booststone Ruins
            </button>
          </div>
        </section>

        <section className="home-mode-card party-coming-soon-card">
          <div>
            <p className="home-mode-card__eyebrow">Current Build Step</p>
            <h2>20 Cars + Special Dice</h2>
            <p>Each player chooses a unique Rocket League car. The normal 1–6 die and all 20 special dice are now defined for the next movement step.</p>
          </div>
        </section>
      </div>
    </div>
  )
}

export default PartyMode
