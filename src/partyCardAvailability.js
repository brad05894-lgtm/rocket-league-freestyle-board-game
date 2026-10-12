export function getPartyCardUseState(card, turn, isMyTurn, currentSetup, roomPhase, room, clientId) {
  if (!card) return { canUse: false, reason: 'No Card selected.' }
  if (card.enabled === false) return { canUse: false, reason: card.comingSoon || 'Not active yet.' }
  if (roomPhase !== 'board' || !isMyTurn) return { canUse: false, reason: 'Use on your turn.' }
  if (turn.battle?.status === 'active') return { canUse: false, reason: 'Resolve the current Battle first.' }
  if (turn.pendingLanding||turn.awaitingService||turn.awaitingGate||turn.awaitingChoice) return {canUse:false,reason:'Finish the current movement decision first.'}
  if (turn.cardUsedThisTurn) return { canUse: false, reason: 'One Card already used this turn.' }
  if (turn.awaitingTrophy) return { canUse: false, reason: 'Resolve the Trophy decision first.' }

  if (card.timing === 'before-roll' && turn.rolled) {
    return { canUse: false, reason: 'Use before rolling.' }
  }

  if (card.timing === 'mechanic-landing-choice') {
    return {
      canUse: false,
      reason: 'Jackpot is offered automatically when you land on a normal Mechanic, before the challenge is revealed.',
    }
  }

  if (card.timing === 'before-mechanic-attempt') {
    if (!turn.rolled || !turn.readyToEnd || !turn.landingEffect || turn.landingEffect.resolved) {
      return { canUse: false, reason: 'Use after landing on a Mechanic, before attempting it.' }
    }
    if ((Number(turn.landingEffect.attemptsUsed) || 0) > 0) {
      return { canUse: false, reason: 'Use before your first attempt on this Mechanic.' }
    }
    if (turn.awaitingMechanicChoice) {
      return { canUse: false, reason: 'Choose your replacement Mechanic first.' }
    }
  }

  if (card.timing === 'after-first-miss') {
    const effect = turn.landingEffect
    if (
      !turn.rolled ||
      !turn.readyToEnd ||
      !effect || effect.resolved ||
      Number(effect.attemptsUsed) !== 1 ||
      effect.lastAttemptSuccess !== false ||
      Number(effect.attemptLimit || 2) < 2
    ) {
      return { canUse: false, reason: 'Use after missing Attempt 1 and before Attempt 2.' }
    }
  }

  if (card.effect === 'double-payout' && currentSetup.doublePayout) {
    return { canUse: false, reason: 'Already armed.' }
  }

  if (card.effect === 'shield' && currentSetup.shieldActive) {
    return { canUse: false, reason: 'Shield already armed.' }
  }

  if (card.effect === 'hot-streak') {
    if (currentSetup.hotStreakActive) return { canUse: false, reason: 'Hot Streak already armed.' }
    if (currentSetup.lastMechanicSuccess !== true) {
      return { canUse: false, reason: 'Your most recent Mechanic must have been successful.' }
    }
  }

  if (card.effect === 'copycat') {
    if (!room?.lastScoredMechanic) return { canUse: false, reason: 'No completed Mechanic to copy yet.' }
    if (room.lastScoredMechanic.playerId === clientId) {
      return { canUse: false, reason: 'The latest completed Mechanic must be from another player.' }
    }
  }

  if (card.effect === 'insurance') {
    if (turn.landingEffect?.type !== 'mechanic') {
      return { canUse: false, reason: 'Insurance is for a normal Mechanic Space.' }
    }
  }

  if (card.effect === 'free-pass') {
    if (turn.landingEffect?.type !== 'mechanic') {
      return { canUse: false, reason: 'Free Pass is for a normal Mechanic Space.' }
    }
    if (currentSetup.doublePayout) {
      return { canUse: false, reason: 'Cannot combine with Double Payout.' }
    }
    if (turn.landingEffect?.jackpotTriggered) {
      return { canUse: false, reason: 'Cannot combine with Jackpot.' }
    }
  }

  if (card.effect === 'difficulty-spike' && turn.landingEffect?.difficulty === 'Insane') {
    return { canUse: false, reason: 'Already at the highest difficulty.' }
  }

  if (card.effect === 'difficulty-drop' && turn.landingEffect?.difficulty === 'Easy') {
    return { canUse: false, reason: 'Already at the lowest difficulty.' }
  }


  return { canUse: true, reason: '' }
}

