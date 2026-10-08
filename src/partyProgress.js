export const BONUS_CATEGORIES = [
  ['minigameTokens', 'Minigame Trophy', 'Most Tokens won in minigames.'],
  ['tokensCollected', 'Rich Star', 'Most Tokens collected throughout the game.'],
  ['eventSpaces', 'Eventful Star', 'Most Event spaces landed on.'],
  ['itemsUsed', 'Item Star', 'Most Action Cards used.'],
  ['spacesTraveled', 'Sightseer Star', 'Most spaces traveled.'],
  ['spacesTraveled', 'Slowpoke Star', 'Fewest spaces traveled.', 'min'],
  ['unluckySpaces', 'Unlucky Star', 'Most Red and Bad Luck spaces landed on.'],
]
export function addPartyStat(room, playerId, key, amount = 1) {
  if (!Number.isFinite(amount) || amount <= 0) return
  room.partyStats ||= {}
  room.partyStats[playerId] ||= {}
  room.partyStats[playerId][key] = (Number(room.partyStats[playerId][key]) || 0) + amount
}
export function awardPartyBonuses(room, playerIds, categorySeed = Math.random(), tieSeed = Math.random()) {
  if (room.bonusResults) return room.bonusResults
  const ids = [...new Set(playerIds)].filter(id => room.playerSetup?.[id])
  if (!ids.length) return []
  const index = Math.min(6, Math.max(0, Math.floor(categorySeed * 7)))
  const [key, name, description, direction] = BONUS_CATEGORIES[index]
  const value = id => Number(room.partyStats?.[id]?.[key]) || 0
  const score = (direction === 'min' ? Math.min : Math.max)(...ids.map(value))
  const tied = ids.filter(id => value(id) === score)
  for (const winner of tied) room.playerSetup[winner].trophies = (Number(room.playerSetup[winner].trophies) || 0) + 1
  room.bonusResults = [{ key, name, description, score, winners: tied, tiedPlayerIds: tied }]
  return room.bonusResults
}
