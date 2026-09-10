import { useEffect, useRef, useState } from 'react'
import {
  createRoom,
  joinRoom,
  listenToRoom,
  getClientId,
  startRoom,
} from './multiplayer'


function OnlineLobby({ mode, onBack, onGameStart }) {
  const [name, setName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [room, setRoom] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const enteredGameRef = useRef(false)

  const clientId = getClientId()

  useEffect(() => {
    if (!roomCode) return

    const unsubscribe = listenToRoom(roomCode, (roomData) => {
      setRoom(roomData)
    })

    return () => unsubscribe()
  }, [roomCode])

  useEffect(() => {
    if (
      !roomCode ||
      room?.status !== 'playing' ||
      enteredGameRef.current
    ) {
      return
    }

    enteredGameRef.current = true

    onGameStart?.({
      roomCode,
      room,
      clientId,
    })
  }, [roomCode, room, clientId, onGameStart])

  async function handleCreate() {
    if (!name.trim()) {
      setError('Enter your name.')
      return
    }

    try {
      setLoading(true)
      setError('')

      const code = await createRoom(name.trim())
      setRoomCode(code)
    } catch (err) {
      setError(err.message || 'Could not create room.')
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
  if (roomCode && room?.status === 'playing') {
    return (
      <div className="game">
        <h1>Loading Game...</h1>
        <h2>Room: {roomCode}</h2>
      </div>
    )
  }
  if (roomCode && room) {
    const roomPlayers = room.players
      ? Object.values(room.players).sort(
          (a, b) => a.joinedAt - b.joinedAt
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

              {player.id === room.hostId && (
                <strong>Host</strong>
              )}
            </div>
          ))}
        </div>

        <p>{roomPlayers.length} / 4 Players</p>

        {isHost ? (
  <>
    <p>
      <strong>You are the host.</strong>
    </p>

    <button
      onClick={handleStartGame}
      disabled={roomPlayers.length < 2}
    >
      Continue to Rules
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
        <p>
          <strong>{error}</strong>
        </p>
      )}

      <div className="menu">
        <button onClick={onBack}>
          Back
        </button>

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