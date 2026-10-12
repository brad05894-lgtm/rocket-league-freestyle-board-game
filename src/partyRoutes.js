const stops = new Set(['Junction', 'Shop', 'Paratroopa', 'Lakitu'])
// Directed, space-count distance: gates may require payment; shortcuts stay one-way.
export function trophyPathChoices(nodes, currentId, choices, trophyId) {
  if (!trophyId || currentId === trophyId) return []
  const map = Object.fromEntries(nodes.map(n => [n.id, n]))
  const distances = choices.map(first => {
    const queue = [[first, stops.has(map[first]?.type) ? 0 : 1]], seen = new Map([[currentId, 0]])
    while (queue.length) {
      queue.sort((a,b) => a[1]-b[1])
      const [id, distance] = queue.shift()
      if (seen.has(id) && seen.get(id) <= distance) continue
      if (id === trophyId) return distance
      seen.set(id, distance)
      for (const next of map[id]?.next || []) queue.push([next, distance + (stops.has(map[next]?.type) ? 0 : 1)])
    }
    return Infinity
  })
  const shortest = Math.min(...distances)
  return Number.isFinite(shortest) ? choices.filter((_,i) => distances[i] === shortest) : []
}
