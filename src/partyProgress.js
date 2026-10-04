export function addPartyStat(room, playerId, key) {
  room.partyStats ||= {}
  room.partyStats[playerId] ||= {}
  room.partyStats[playerId][key] = (Number(room.partyStats[playerId][key]) || 0) + 1
}

export function awardPartyBonuses(room, playerIds) {
  if (room.bonusResults) return room.bonusResults
  const categories = [
    ['mechanicsCompleted', 'Mechanic Master', 'Most successful Mechanic attempts (Free Pass excluded).'],
    ['cardsPlayed', 'Card Collector', 'Most Cards activated without Shield or Lockout blocking them.'],
  ]
  room.bonusResults = categories.map(([key, name, description]) => {
    const best = Math.max(0, ...playerIds.map((id) => Number(room.partyStats?.[id]?.[key]) || 0))
    const winners = best > 0 ? playerIds.filter((id) => (Number(room.partyStats?.[id]?.[key]) || 0) === best) : []
    for (const id of winners) room.playerSetup[id].trophies = (room.playerSetup[id].trophies || 0) + 1
    return { key, name, description, score: best, winners }
  })
  return room.bonusResults
}
