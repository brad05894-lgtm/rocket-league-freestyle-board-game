import { ref, set, get, onValue, update } from 'firebase/database'
import { db } from './firebase'

function makeRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''

  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }

  return code
}

export function getClientId() {
  let id = localStorage.getItem('rl-board-client-id')

  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('rl-board-client-id', id)
  }

  return id
}

export async function createRoom(playerName) {
  const playerId = getClientId()

  let roomCode
  let roomExists = true

  while (roomExists) {
    roomCode = makeRoomCode()

    const snapshot = await get(ref(db, `rooms/${roomCode}`))
    roomExists = snapshot.exists()
  }

  await set(ref(db, `rooms/${roomCode}`), {
    status: 'lobby',
    hostId: playerId,
    createdAt: Date.now(),

    players: {
      [playerId]: {
        id: playerId,
        name: playerName,
        joinedAt: Date.now(),
      },
    },
  })

  return roomCode
}

export async function joinRoom(roomCode, playerName) {
  const code = roomCode.trim().toUpperCase()
  const playerId = getClientId()

  const roomSnapshot = await get(ref(db, `rooms/${code}`))

  if (!roomSnapshot.exists()) {
    throw new Error('Room not found.')
  }

  const room = roomSnapshot.val()

  if (room.status !== 'lobby') {
    throw new Error('This game has already started.')
  }

  const existingPlayers = room.players
    ? Object.keys(room.players).length
    : 0

  if (!room.players?.[playerId] && existingPlayers >= 4) {
    throw new Error('This room is full.')
  }

  await update(ref(db, `rooms/${code}/players/${playerId}`), {
    id: playerId,
    name: playerName,
    joinedAt: Date.now(),
  })

  return code
}

export function listenToRoom(roomCode, callback) {
  return onValue(ref(db, `rooms/${roomCode}`), (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() : null)
  })
}
export async function startRoom(roomCode) {
  const code = roomCode.trim().toUpperCase()

  await update(ref(db, `rooms/${code}`), {
    status: 'playing',
    startedAt: Date.now(),
  })
}


export async function endRoom(roomCode, requesterId) {
  const code = roomCode.trim().toUpperCase()
  const roomRef = ref(db, `rooms/${code}`)
  const roomSnapshot = await get(roomRef)

  if (!roomSnapshot.exists()) {
    throw new Error('Room not found.')
  }

  const room = roomSnapshot.val()

  if (room.hostId !== requesterId) {
    throw new Error('Only the host can end the game for everyone.')
  }

  await update(roomRef, {
    status: 'ended',
    endedAt: Date.now(),
    endedBy: requesterId,
  })
}

export function listenToGame(roomCode, callback) {
  const code = roomCode.trim().toUpperCase()

  return onValue(ref(db, `rooms/${code}/game`), (snapshot) => {
    if (!snapshot.exists()) {
      callback(null)
      return
    }

    const payload = snapshot.val()

    // New format: the game state is stored as JSON text so null values survive
    // Firebase Realtime Database. This is important for states such as
    // battleState: null and opponentIndex: null.
    if (typeof payload.stateJson === 'string') {
      try {
        callback({
          ...payload,
          state: JSON.parse(payload.stateJson),
        })
      } catch (error) {
        console.error('Could not parse multiplayer game state:', error)
        callback(null)
      }
      return
    }

    // Backward compatibility for rooms created before this fix.
    callback(payload)
  })
}

export async function saveGameState(roomCode, state, updatedBy) {
  const code = roomCode.trim().toUpperCase()

  // Realtime Database treats null object properties as deletions. Storing the
  // whole state as JSON text preserves nulls, so remote browsers can correctly
  // clear Battle/Event/Special state instead of getting stuck on stale screens.
  const cleanState = JSON.parse(JSON.stringify(state))

  await set(ref(db, `rooms/${code}/game`), {
    stateJson: JSON.stringify(cleanState),
    updatedBy,
    updatedAt: Date.now(),
  })
}

