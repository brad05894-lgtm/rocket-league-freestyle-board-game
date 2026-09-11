const SPACE_WEIGHTS = [
  ['Mechanic', 52],
  ['Action', 15],
  ['Battle', 10],
  ['Event', 8],
  ['Gamble', 4],
  ['Action Shop', 5],
  ['Choose Difficulty', 6],
]

function hashSeed(seed) {
  const text = String(seed)
  let hash = 2166136261

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

function seededRandom(seed) {
  let state = hashSeed(seed) || 1

  return function random() {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function randomInt(random, min, max) {
  return Math.floor(random() * (max - min + 1)) + min
}

function weightedSpace(random) {
  const total = SPACE_WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0)
  let roll = random() * total

  for (const [type, weight] of SPACE_WEIGHTS) {
    roll -= weight
    if (roll <= 0) return type
  }

  return 'Mechanic'
}

function overlaps(aStart, aEnd, bStart, bEnd, padding = 0) {
  return aStart <= bEnd + padding && aEnd >= bStart - padding
}

export const MAIN_FINISH_POSITION = 75

export function generateBoard(seed = Date.now()) {
  const random = seededRandom(seed)

  // The original game used positions 0 -> 75. Keep that exact race length:
  // Start is main-0 and Finish is main-75, so there are always 75 movement
  // steps on the main route. Fork/shortcut spaces are EXTRA and do not shrink it.
  const mainSteps = MAIN_FINISH_POSITION
  const mainNodeCount = mainSteps + 1
  const finalStretch = randomInt(random, 5, 7)

  const nodes = []
  const nodeMap = new Map()
  const mainPath = []
  const forks = []

  function addNode(id, type, extra = {}) {
    const node = {
      id,
      type,
      next: [],
      previous: [],
      ...extra,
    }

    nodes.push(node)
    nodeMap.set(id, node)
    return node
  }

  function connect(fromId, toId) {
    const from = nodeMap.get(fromId)
    const to = nodeMap.get(toId)
    if (!from || !to) return

    if (!from.next.includes(toId)) from.next.push(toId)
    if (!to.previous.includes(fromId)) to.previous.push(fromId)
  }

  for (let index = 0; index < mainNodeCount; index += 1) {
    const id = `main-${index}`
    const type =
      index === 0
        ? 'Start'
        : index === mainSteps
          ? 'Finish'
          : weightedSpace(random)

    addNode(id, type, {
      route: 'main',
      mainIndex: index,
    })
    mainPath.push(id)
  }

  for (let index = 0; index < mainPath.length - 1; index += 1) {
    connect(mainPath[index], mainPath[index + 1])
  }

  // Reserve the shortcut area before normal forks are generated, so the map
  // never needs to draw a normal fork through the shortcut corridor.
  const shortcutGateIndex = mainSteps - finalStretch - 9
  const shortcutRejoinIndex = shortcutGateIndex + 7
  const shortcutGateId = mainPath[shortcutGateIndex]
  const shortcutRejoinId = mainPath[shortcutRejoinIndex]

  nodeMap.get(shortcutGateId).type = 'Shortcut Gate'

  const reservedIntervals = [
    {
      start: shortcutGateIndex,
      end: shortcutRejoinIndex,
      kind: 'shortcut',
    },
  ]

  const desiredForkCount = randomInt(random, 2, 4)
  const earliestForkIndex = 6
  const latestForkStart = Math.max(
    earliestForkIndex,
    shortcutGateIndex - 8
  )

  for (let forkNumber = 0; forkNumber < desiredForkCount; forkNumber += 1) {
    let chosen = null

    for (let attempt = 0; attempt < 140; attempt += 1) {
      const splitIndex = randomInt(
        random,
        earliestForkIndex,
        latestForkStart
      )
      const span = randomInt(random, 4, 7)
      const rejoinIndex = Math.min(splitIndex + span, shortcutGateIndex - 3)

      if (rejoinIndex - splitIndex < 4) continue

      const conflict = reservedIntervals.some((interval) =>
        overlaps(splitIndex, rejoinIndex, interval.start, interval.end, 2)
      )

      if (conflict) continue

      chosen = { splitIndex, rejoinIndex }
      break
    }

    // Fewer clean forks is better than forcing an overlapping/broken one.
    if (!chosen) break

    const { splitIndex, rejoinIndex } = chosen
    const splitId = mainPath[splitIndex]
    const rejoinId = mainPath[rejoinIndex]
    const branchLength = randomInt(random, 3, 5)
    const alternatePath = []

    for (let branchIndex = 0; branchIndex < branchLength; branchIndex += 1) {
      const id = `fork-${forkNumber}-${branchIndex}`
      addNode(id, weightedSpace(random), {
        route: 'fork',
        forkNumber,
        branchIndex,
      })
      alternatePath.push(id)
    }

    connect(splitId, alternatePath[0])

    for (let branchIndex = 0; branchIndex < alternatePath.length - 1; branchIndex += 1) {
      connect(alternatePath[branchIndex], alternatePath[branchIndex + 1])
    }

    connect(alternatePath[alternatePath.length - 1], rejoinId)

    forks.push({
      splitId,
      rejoinId,
      alternatePath,
      splitIndex,
      rejoinIndex,
    })

    reservedIntervals.push({
      start: splitIndex,
      end: rejoinIndex,
      kind: 'fork',
    })
  }

  // Shortcut: 3 spaces instead of the 7-space main-road segment.
  const shortcutPath = []

  for (let index = 0; index < 3; index += 1) {
    const id = `shortcut-${index}`
    addNode(id, weightedSpace(random), {
      route: 'shortcut',
      shortcutIndex: index,
    })
    shortcutPath.push(id)
  }

  connect(shortcutGateId, shortcutPath[0])
  connect(shortcutPath[0], shortcutPath[1])
  connect(shortcutPath[1], shortcutPath[2])
  connect(shortcutPath[2], shortcutRejoinId)

  return {
    seed: String(seed),
    nodes,
    mainPath,
    forks,
    startId: mainPath[0],
    finishId: mainPath[mainSteps],
    mainSteps,
    finishPosition: MAIN_FINISH_POSITION,
    finalStretch,
    shortcut: {
      gateId: shortcutGateId,
      normalRoute: mainPath[shortcutGateIndex + 1],
      shortcutRoute: shortcutPath[0],
      shortcutPath,
      rejoinId: shortcutRejoinId,
      difficulty: 'Hard',
      attempts: 1,
      failurePenalty: -1,
    },
  }
}
