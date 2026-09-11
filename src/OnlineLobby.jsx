import { useEffect, useRef, useState } from 'react'
import {
  createRoom,
  getClientId,
  joinRoom,
  kickPlayer,
  listenToRoom,
  startRoom,
} from './multiplayer'

function OnlineLobby({ mode, onBack, onGameStart }) {
  const [name, setName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [room, setRoom] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [kickBusyId, setKickBusyId] = useState(null)
  const [kickedNotice, setKickedNotice] = useState('')
  const gameStartSentRef = useRef(false)

  const clientId = getClientId()

  useEffect(() => {
    if (!roomCode) return

    return listenToRoom(roomCode, (roomData) => {
      if (!roomData) {
        setRoom(null)
        setError('This room is no longer available.')
        return
      }

      if (roomData.kickedPlayers?.[clientId]) {
        setKickedNotice('The host removed you from this room.')
        setRoom(null)
        setRoomCode('')
        return
      }

      setRoom(roomData)

      if (
        roomData.status === 'playing' &&
        !gameStartSentRef.current
      ) {
        gameStartSentRef.current = true
        onGameStart?.({
          roomCode,
          room: roomData,
          clientId,
        })
      }
    })
  }, [roomCode, clientId, onGameStart])

  async function handleCreate() {
    if (!name.trim()) {
      setError('Enter your name.')
      return
    }

    try {
      setLoading(true)
      setError('')
      setKickedNotice('')
      gameStartSentRef.current = false

      const code = await createRoom(name.trim())
      setRoomCode(code)
    } catch (err) {
      setError(err.message || 'Could not create room.')
    } finally {
      setLoading(false)
    }
  }

  async function handleJoin() {
    if (!name.trim()) {
      setError('Enter your name.')
      return
    }

    if (!joinCode.trim()) {
      setError('Enter the room code.')
      return
    }

    try {
      setLoading(true)
      setError('')
      setKickedNotice('')
      gameStartSentRef.current = false

      const code = await joinRoom(
        joinCode.trim().toUpperCase(),
        name.trim()
      )

      setRoomCode(code)
    } catch (err) {
      setError(err.message || 'Could not join room.')
    } finally {
      setLoading(false)
    }
  }

  async function handleStartGame() {
    try {
      setError('')
      await startRoom(roomCode)
    } catch (err) {
      setError(err.message || 'Could not start game.')
    }
  }

  async function handleKick(player) {
    if (!roomCode || !room || room.hostId !== clientId) return
    if (!player || player.id === clientId) return

    const confirmed = window.confirm(
      `Kick ${player.name} from this room?`
    )

    if (!confirmed) return

    try {
      setKickBusyId(player.id)
      setError('')
      await kickPlayer(roomCode, clientId, player.id)
    } catch (err) {
      setError(err.message || 'Could not kick that player.')
    } finally {
      setKickBusyId(null)
    }
  }

  if (kickedNotice) {
    return (
      <div className="game">
        <h1>Removed from Room</h1>

        <div className="rules-box">
          <p><strong>{kickedNotice}</strong></p>
          <p>You can return home and create or join a different room.</p>
        </div>

        <div className="menu">
          <button onClick={onBack}>Back to Home</button>
        </div>
      </div>
    )
  }

  if (roomCode && room) {
    const roomPlayers = room.players
      ? Object.values(room.players).sort(
          (a, b) => (a.joinedAt || 0) - (b.joinedAt || 0)
        )
      : []

    const isHost = room.hostId === clientId

    return (
      <div className="game">
        <h1>Online Lobby</h1>

        <h2>
          Room Code: <strong>{roomCode}</strong>
        </h2>

        <p>Send this code to your friends.</p>

        <div className="player-list">
          {roomPlayers.map((player, index) => (
            <div className="player" key={player.id}>
              <span>
                Player {index + 1}: {player.name}
              </span>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {player.id === room.hostId && (
                  <strong>Host</strong>
                )}

                {isHost && player.id !== room.hostId && (
                  <button
                    type="button"
                    onClick={() => handleKick(player)}
                    disabled={kickBusyId === player.id}
                    style={{
                      borderColor: 'rgba(248, 113, 113, .85)',
                      background: 'rgba(127, 29, 29, .88)',
                      color: '#fff',
                    }}
                  >
                    {kickBusyId === player.id ? 'Kicking...' : 'Kick'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <p>{roomPlayers.length} / 4 Players</p>

        {error && (
          <p><strong>{error}</strong></p>
        )}

        {isHost ? (
          <>
            <p><strong>You are the host.</strong></p>

            <button
              onClick={handleStartGame}
              disabled={roomPlayers.length < 2}
            >
              Start Game
            </button>

            {roomPlayers.length < 2 && (
              <p>You need at least 2 players.</p>
            )}
          </>
        ) : (
          <p>Waiting for the host to start...</p>
        )}
      </div>
    )
  }

  return (
    <div className="game">
      <h1>
        {mode === 'create'
          ? 'Create Online Game'
          : 'Join Online Game'}
      </h1>

      <div className="player-form">
        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={15}
        />
      </div>

      {mode === 'join' && (
        <div className="player-form">
          <input
            type="text"
            placeholder="Room code"
            value={joinCode}
            onChange={(event) =>
              setJoinCode(event.target.value.toUpperCase())
            }
            maxLength={4}
          />
        </div>
      )}

      {error && (
        <p><strong>{error}</strong></p>
      )}

      <div className="menu">
        <button onClick={onBack}>Back</button>

        {mode === 'create' ? (
          <button
            onClick={handleCreate}
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Room'}
          </button>
        ) : (
          <button
            onClick={handleJoin}
            disabled={loading}
          >
            {loading ? 'Joining...' : 'Join Room'}
          </button>
        )}
      </div>
    </div>
  )
}

export default OnlineLobby
