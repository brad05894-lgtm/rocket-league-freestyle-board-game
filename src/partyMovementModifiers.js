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

export function partyDiceRevealDuration(modifier = 0, bombRoll = null) {
  return bombRoll ? 3600 : Number(modifier) ? PARTY_DICE_MODIFIED_REVEAL_MS : PARTY_DICE_NORMAL_REVEAL_MS
}

// A genuine zero-movement roll may end without reactivating its old space.
// Do not mistake a completed normal move or an active service stop for a zero roll.
export function isPartyZeroMovementTurn(turn = {}) {
  if (!turn.rolled || Number(turn.movementRemaining || 0) > 0 ||
      Number(turn.movementSpacesTaken || 0) > 0 || turn.movementStarted) return false
  return turn.noMovement === true ||
    (turn.rollMovementTotal != null && Number(turn.rollMovementTotal) === 0) ||
    (turn.rollMovementTotal == null && turn.baseMovement != null && Number(turn.baseMovement) === 0)
}

export function settlePartyZeroMovementTurn(turn = {}) {
  if (!isPartyZeroMovementTurn(turn)) return turn
  turn.readyToEnd = true
  turn.noMovement = true
  turn.movementRemaining = 0
  turn.awaitingChoice = false
  for (const key of ['landedNodeId','landedType','landingEffect','spaceEffect','eventEffect',
    'pendingLanding','awaitingService','awaitingTrophy','awaitingGate','gateId','gateFromNodeId',
    'gateToNodeId','gateToll','gatePassApproved','selectedRoute','choiceNodeId','choices',
    'awaitingJackpotDecision','awaitingMechanicChoice']) delete turn[key]
  return turn
}
