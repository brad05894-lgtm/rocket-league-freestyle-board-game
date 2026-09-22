import { get, ref, runTransaction, set } from 'firebase/database'
import { signInAnonymously } from 'firebase/auth'
import { db, auth } from './firebase'

let pending

export async function initializeOnlineIdentity() {
  if (auth.currentUser) return auth.currentUser.uid

  if (!pending) {
    pending = (async () => {
      await auth.authStateReady()

      if (!auth.currentUser) {
        await signInAnonymously(auth)
      }

      if (!auth.currentUser?.uid) {
        throw new Error('Firebase signed in, but no user ID was created.')
      }

      return auth.currentUser.uid
    })().catch((error) => {
      pending = null

      if (error?.code === 'auth/operation-not-allowed') {
        throw new Error(
          'Anonymous Firebase sign-in is disabled. Enable the Anonymous provider in Firebase Authentication.'
        )
      }

      throw error
    })
  }

  return pending
}

export function requireOnlineIdentity(claimedId) {
  const uid = auth.currentUser?.uid

  if (!uid) {
    throw new Error('Online sign-in is unavailable. Reload the page and try again.')
  }

  if (claimedId && claimedId !== uid) {
    throw new Error('Your player session changed. Reload and rejoin the room.')
  }

  return uid
}

export function normalizeRoomCode(value) {
  const code = String(value || '').trim().toUpperCase()

  if (!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(code)) {
    throw new Error('Enter the new 8-character room code.')
  }

  return code
}

export function cleanPlayerName(value) {
  const name = String(value || '').trim()

  if (!name || name.length > 20 || /[\u0000-\u001f\u007f]/.test(name)) {
    throw new Error('Use a player name with 1–20 characters.')
  }

  return name
}

export function randomRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''

  while (code.length < 8) {
    const bytes = crypto.getRandomValues(new Uint8Array(16))

    for (const byte of bytes) {
      if (byte >= Math.floor(256 / alphabet.length) * alphabet.length) continue
      code += alphabet[byte % alphabet.length]
      if (code.length === 8) break
    }
  }

  return code
}

export async function joinProtectedRoom(namespace, code, playerName) {
  const initializedUid = await initializeOnlineIdentity()
  const uid = requireOnlineIdentity(initializedUid)
  const name = cleanPlayerName(playerName)
  code = normalizeRoomCode(code)

  const roomPath = `${namespace}/${code}`
  const seats = (await get(ref(db, `${roomPath}/seats`))).val() || {}

  let seat = Object.keys(seats).find((key) => seats[key] === uid)
  let newlyClaimed = false

  if (seat === undefined) {
    for (let i = 0; i < 4; i++) {
      if (seats[i]) continue

      try {
        const result = await runTransaction(
          ref(db, `${roomPath}/seats/${i}`),
          (value) => (value === null ? uid : undefined),
          { applyLocally: false }
        )

        if (result.committed) {
          seat = String(i)
          newlyClaimed = true
          break
        }
      } catch {
        // A simultaneous join may have claimed this seat.
      }
    }
  }

  if (seat === undefined) {
    throw new Error('Room not found, full, started, or unavailable.')
  }

  try {
    await runTransaction(
      ref(db, `${roomPath}/players/${uid}`),
      (existing) =>
        existing || {
          id: uid,
          name,
          joinedAt: Date.now(),
        },
      { applyLocally: false }
    )
  } catch {
    if (newlyClaimed) {
      await set(ref(db, `${roomPath}/seats/${seat}`), null).catch(() => {})
    }

    throw new Error('Could not join this room. It may have started or you were removed.')
  }

  return code
}

export function releasedSeatUpdates(room, uid) {
  if (room.status !== 'lobby') return {}

  return Object.fromEntries(
    Object.entries(room.seats || {})
      .filter(([, occupant]) => occupant === uid)
      .map(([seat]) => [`seats/${seat}`, null])
  )
}
