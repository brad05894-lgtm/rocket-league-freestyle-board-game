export function addPartyStat(room, playerId, key, amount = 1) {
  room.partyStats ||= {}
  room.partyStats[playerId] ||= {}
  room.partyStats[playerId][key] = (Number(room.partyStats[playerId][key]) || 0) + (Number(amount) || 0)
}

export function awardPartyBonuses(room, playerIds) {
  if (room.bonusResults) return room.bonusResults

  const ids = playerIds.filter((id) => room.playerSetup?.[id])
  if (!ids.length) {
    room.bonusResults = []
    return room.bonusResults
  }

  // These are the two fixed end-game bonus categories. mechanicsCompleted is
  // only incremented by a real made shot in resolvePartyMechanicLanding, so a
  // Free Pass never counts toward Mechanic Master. cardsPlayed is incremented
  // only when the activation actually goes through, so Shield/Lockout blocks
  // do not count toward Card Collector.
  const categories = [
    {
      key: 'mechanicsCompleted',
      name: 'Mechanic Master',
      description: 'Completed the most Mechanics with an actual successful attempt. Free Pass does not count.',
    },
    {
      key: 'cardsPlayed',
      name: 'Card Collector',
      description: 'Activated the most Action Cards that were not blocked by Shield or Lockout.',
    },
  ]

  room.bonusResults = categories.map((category) => {
    const values = ids.map((id) => Number(room.partyStats?.[id]?.[category.key]) || 0)
    const best = Math.max(...values)
    const winners = best > 0
      ? ids.filter((id) => (Number(room.partyStats?.[id]?.[category.key]) || 0) === best)
      : []

    for (const winnerId of winners) {
      room.playerSetup[winnerId].trophies = (Number(room.playerSetup[winnerId].trophies) || 0) + 1
    }

    return {
      key: category.key,
      name: category.name,
      description: category.description,
      score: best,
      winners,
      winnerId: winners[0] || '',
      awarded: winners.length > 0,
    }
  })

  room.bonusAwardedAt = Date.now()
  return room.bonusResults
}
