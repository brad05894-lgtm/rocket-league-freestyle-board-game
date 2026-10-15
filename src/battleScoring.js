// Battle Mode only. These points never touch Party Mode's Tokens or Trophies.
export const BATTLE_PLACE_POINTS = Object.freeze([3, 2, 1, 0])

// In individual FFA, ties share the LOWEST point value occupied by the tie.
// Team/asymmetric formats reward the winning team equally; no winner = +1 each.
export function battlePointsForPlacements(format, participantIds, placements) {
  const ids = [...participantIds]
  if (!ids.length || !Array.isArray(placements) || !placements.length) {
    throw new Error('Battle results are missing.')
  }
  const seen = placements.flat()
  if (!placements.every(group => Array.isArray(group) && group.length) ||
      seen.length !== ids.length || new Set(seen).size !== ids.length ||
      seen.some(id => !ids.includes(id))) {
    throw new Error('Battle results must include every participant exactly once.')
  }
  const points = Object.fromEntries(ids.map(id => [id, 0]))
  const ffa = format === '1v1v1' || format === '1v1v1v1'
  if (placements.length === 1) {
    // Only certain Challenges allow a draw.
    for (const id of ids) points[id] = 1
  } else if (!ffa) {
    // 1v1, 1v2, 1v3 and 2v2: winners receive +3 each; others receive 0.
    for (const id of placements[0]) points[id] = 3
  } else {
    let occupiedPlaces = 0
    for (const group of placements) {
      const placeEnd = occupiedPlaces + group.length - 1
      const awarded = BATTLE_PLACE_POINTS[Math.min(placeEnd, BATTLE_PLACE_POINTS.length - 1)]
      for (const id of group) points[id] = awarded
      occupiedPlaces += group.length
    }
  }
  return points
}

export function battleLeaderboard(game, playerNames = {}) {
  const entries = Object.entries(game?.points || {}).map(([id, score]) => ({
    id, name: playerNames[id] || 'Former player', points: Number(score) || 0,
  }))
  entries.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
  return entries.map(entry => ({
    ...entry,
    rank: 1 + entries.filter(other => other.points > entry.points).length,
  }))
}
