// Normalize only known numeric fields. Never rewrite arbitrary room strings.
export function finiteNumber(value, fallback = 0) {
 if (typeof value !== 'number' && typeof value !== 'string') return fallback
 if (typeof value === 'string' && !value.trim()) return fallback
 const n = Number(value)
 return Number.isFinite(n) ? n : fallback
}
export function normalizePartyNumbers(room) {
 if (!room) return
 const whole = (o, key, fallback = 0) => { o[key] = Math.max(0, Math.trunc(finiteNumber(o[key], fallback))) }
 for (const setup of Object.values(room.playerSetup || {})) {
  if (!setup) continue
  whole(setup, 'tokens'); whole(setup, 'trophies')
  if (setup.bombAlly) whole(setup.bombAlly, 'rollsLeft', 3)
 }
 const e = room.turnState?.eventEffect
 if (e?.id === 'gold-mine') for (const key of ['swings', 'unbanked', 'revision']) whole(e, key)
 if (room.boardMotion) room.boardMotion.stepMs = Math.max(1, finiteNumber(room.boardMotion.stepMs, 280))
}
// Do not silently turn a broken payout into zero. Abort with the precise field
// before Firebase sees an invalid number; the previous room remains unchanged.
export function assertFinitePartyState(value, path = 'room') {
 if (typeof value === 'number' && !Number.isFinite(value)) {
  throw new Error(`Invalid game number at ${path}. No changes were saved. Ask the host to skip or reset this event.`)
 }
 if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) assertFinitePartyState(child, `${path}.${key}`)
}
