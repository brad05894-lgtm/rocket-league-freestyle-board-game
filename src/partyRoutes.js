const stops = new Set(['Junction', 'Shop', 'Paratroopa', 'Lakitu', 'BombPickup'])
export function isPartyIntermediateStop(node, trophyId) {
  return !!node && (stops.has(node.type) || (node.id === trophyId && !['Event','Start'].includes(node.type)))
}
// Directed, space-count distance: gates may require payment; shortcuts stay one-way.
export function trophyPathChoices(nodes, currentId, choices, trophyId) {
  if (!trophyId || currentId === trophyId) return []
  const map = Object.fromEntries(nodes.map(n => [n.id, n]))
  const distances = choices.map(first => {
    const queue = [[first, isPartyIntermediateStop(map[first], trophyId) ? 0 : 1]], seen = new Map([[currentId, 0]])
    while (queue.length) {
      queue.sort((a,b) => a[1]-b[1])
      const [id, distance] = queue.shift()
      if (seen.has(id) && seen.get(id) <= distance) continue
      if (id === trophyId) return distance
      seen.set(id, distance)
      for (const next of map[id]?.next || []) queue.push([next, distance + (isPartyIntermediateStop(map[next], trophyId) ? 0 : 1)])
    }
    return Infinity
  })
  const shortest = Math.min(...distances)
  return Number.isFinite(shortest) ? choices.filter((_,i) => distances[i] === shortest) : []
}
