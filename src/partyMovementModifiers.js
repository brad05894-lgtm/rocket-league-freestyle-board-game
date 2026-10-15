// Shared Party die calculation. Card modifiers are applied once, on the roll
// transaction, before any board movement begins. All results floor at zero.
export const PARTY_DICE_NORMAL_REVEAL_MS = 1500
export const PARTY_DICE_MODIFIED_REVEAL_MS = 2100

const integer = value => {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : 0
}

export function pendingPartyMovementModifier(turn = {}, setup = {}) {
  // pendingMovementBonus is the existing Boost Canister / Golden Boost field.
  // A future negative Card can write a signed pendingMovementModifier on a
  // turn, or queue pendingMovementPenalty on the target player's setup.
  return integer(turn.pendingMovementBonus) + integer(turn.pendingMovementModifier)
    - Math.max(0, integer(setup.pendingMovementPenalty))
}

export function calculatePartyMovement(dieMovement, modifier = 0) {
  return Math.max(0, integer(dieMovement) + integer(modifier))
}

export function clearPendingPartyMovementModifiers(turn, setup) {
  delete turn.pendingMovementBonus
  delete turn.pendingMovementModifier
  delete setup.pendingMovementPenalty
}

export function partyDiceRevealDuration(modifier = 0) {
  return Number(modifier) ? PARTY_DICE_MODIFIED_REVEAL_MS : PARTY_DICE_NORMAL_REVEAL_MS
}
