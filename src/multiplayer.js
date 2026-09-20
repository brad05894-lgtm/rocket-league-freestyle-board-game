import {
  ref,
  set,
  get,
  onValue,
  runTransaction,
  update,
  serverTimestamp,
} from 'firebase/database'
import { db, auth } from './firebase'
import {
  initializeOnlineIdentity,
  joinProtectedRoom,
  releasedSeatUpdates,
  requireOnlineIdentity,
  normalizeRoomCode,
  cleanPlayerName,
  randomRoomCode,
} from './onlineIdentity'

export function getClientId() {
  return auth.currentUser?.uid || 'local-only-player'
}

export async function createRoom(playerName) {
  // Wait for Firebase Anonymous Auth before touching the protected database.
  const playerId = await initializeOnlineIdentity()
  requireOnlineIdentity(playerId)

  playerName = cleanPlayerName(playerName)
  const roomCode = randomRoomCode()

  await set(ref(db, `secureRooms/${roomCode}`), {
    status: 'lobby',
    hostId: playerId,
    seats: { 0: playerId },

    // Use Firebase's clock so local computer clock differences
    // cannot cause the security-rule time check to fail.
    createdAt: serverTimestamp(),

    players: {
      [playerId]: {
        id: playerId,
        name: playerName,
        joinedAt: serverTimestamp(),
      },
    },
  })

  return roomCode
}

export async function joinRoom(roomCode, playerName) {
  await initializeOnlineIdentity()

  return joinProtectedRoom(
    'secureRooms',
    normalizeRoomCode(roomCode),
    playerName
  )
}

export function listenToRoom(roomCode, callback) {
  roomCode = normalizeRoomCode(roomCode)
  requireOnlineIdentity()

  return onValue(
    ref(db, `secureRooms/${roomCode}`),
    (snapshot) => {
      callback(snapshot.exists() ? snapshot.val() : null)
    },
    () => callback(null)
  )
}

export async function startRoom(roomCode) {
  await initializeOnlineIdentity()
  requireOnlineIdentity()

  const code = normalizeRoomCode(roomCode)

  await update(ref(db, `secureRooms/${code}`), {
    status: 'playing',
    startedAt: serverTimestamp(),
  })
}

export async function kickPlayer(
  roomCode,
  requesterId,
  targetPlayerId
) {
  requireOnlineIdentity(requesterId)

  const code = normalizeRoomCode(roomCode)
  const roomRef = ref(db, `secureRooms/${code}`)
  const roomSnapshot = await get(roomRef)

  if (!roomSnapshot.exists()) {
    throw new Error('Room not found.')
  }

  const room = roomSnapshot.val()

  if (room.hostId !== requesterId) {
    throw new Error('Only the host can kick players.')
  }

  if (targetPlayerId === requesterId) {
    throw new Error('The host cannot kick themselves.')
  }

  if (!['lobby', 'playing'].includes(room.status)) {
    throw new Error(
      'Players cannot be kicked after the room has ended.'
    )
  }

  if (!room.players?.[targetPlayerId]) {
    throw new Error('That player is no longer in the room.')
  }

  const kickedAt = Date.now()

  const updates = {
    ...releasedSeatUpdates(room, targetPlayerId),

    [`players/${targetPlayerId}`]: null,

    [`kickedPlayers/${targetPlayerId}`]: {
      kickedBy: requesterId,
      kickedAt,
    },
  }

  if (room.status === 'playing') {
    updates[`departedPlayers/${targetPlayerId}`] = {
      leftAt: kickedAt,
      reason: 'kicked',
    }
  }

  await update(roomRef, updates)
}

export async function leaveRoom(roomCode, playerId) {
  requireOnlineIdentity(playerId)

  const code = normalizeRoomCode(roomCode)
  const roomRef = ref(db, `secureRooms/${code}`)
  const roomSnapshot = await get(roomRef)

  if (!roomSnapshot.exists()) {
    throw new Error('Room not found.')
  }

  const room = roomSnapshot.val()

  if (room.hostId === playerId) {
    throw new Error(
      'The host must end the game instead of leaving it.'
    )
  }

  if (!room.players?.[playerId]) {
    return
  }

  await update(roomRef, {
    ...releasedSeatUpdates(room, playerId),

    [`players/${playerId}`]: null,

    [`departedPlayers/${playerId}`]: {
      leftAt: Date.now(),
    },
  })
}

export async function endRoom(roomCode, requesterId) {
  requireOnlineIdentity(requesterId)

  const code = normalizeRoomCode(roomCode)
  const roomRef = ref(db, `secureRooms/${code}`)
  const roomSnapshot = await get(roomRef)

  if (!roomSnapshot.exists()) {
    throw new Error('Room not found.')
  }

  const room = roomSnapshot.val()

  if (room.hostId !== requesterId) {
    throw new Error(
      'Only the host can end the game for everyone.'
    )
  }

  await update(roomRef, {
    status: 'ended',
    endedAt: Date.now(),
    endedBy: requesterId,
  })
}

export function listenToGame(roomCode, callback) {
  const code = normalizeRoomCode(roomCode)

  return onValue(
    ref(db, `secureRooms/${code}/game`),

    (snapshot) => {
      if (!snapshot.exists()) {
        callback(null)
        return
      }

      const payload = snapshot.val()

      // New format:
      // Store the game state as JSON text so null values survive
      // Firebase Realtime Database.
      if (typeof payload.stateJson === 'string') {
        try {
          callback({
            ...payload,
            state: JSON.parse(payload.stateJson),
          })
        } catch (error) {
          console.error(
            'Could not parse multiplayer game state:',
            error
          )

          callback(null)
        }

        return
      }

      // Fallback for an older game-state format.
      callback(payload)
    },

    () => callback(null)
  )
}

export async function saveGameState(
  roomCode,
  state,
  updatedBy
) {
  requireOnlineIdentity(updatedBy)

  const code = normalizeRoomCode(roomCode)

  // Realtime Database treats null object properties as deletions.
  // JSON text preserves those null values.
  const cleanState = JSON.parse(JSON.stringify(state))

  await set(ref(db, `secureRooms/${code}/game`), {
    stateJson: JSON.stringify(cleanState),
    updatedBy,
    updatedAt: Date.now(),
  })
}

export async function saveClassicCarSelection(
  roomCode,
  playerId,
  carId
) {
  requireOnlineIdentity(playerId)

  const code = normalizeRoomCode(roomCode)
  const gameRef = ref(db, `secureRooms/${code}/game`)

  await runTransaction(gameRef, (payload) => {
    if (!payload || typeof payload.stateJson !== 'string') {
      return payload
    }

    let state

    try {
      state = JSON.parse(payload.stateJson)
    } catch {
      return payload
    }

    if (
      state.screen !== 'rules' ||
      !Array.isArray(state.players)
    ) {
      return payload
    }

    const playerIndex = state.players.findIndex(
      (player) => player.id === playerId
    )

    if (playerIndex < 0) {
      return payload
    }

    const carIsTaken = state.players.some(
      (player, index) =>
        index !== playerIndex && player.carId === carId
    )

    if (carIsTaken) {
      return payload
    }

    state.players[playerIndex] = {
      ...state.players[playerIndex],
      carId,
    }

    return {
      ...payload,
      stateJson: JSON.stringify(state),
      updatedBy: playerId,
      updatedAt: Date.now(),
    }
  })
}