import { joinProtectedRoom, releasedSeatUpdates, requireOnlineIdentity, normalizeRoomCode, cleanPlayerName, randomRoomCode } from './onlineIdentity'
import { ref, set, get, onValue, update, runTransaction } from 'firebase/database'
import { db } from './firebase'
import { BOOSTSTONE_RUINS } from './booststoneRuins'
import { getPartyCar, formatPartyDieFace } from './partyCars'
import { PARTY_MECHANICS, pickPartyMechanic } from './partyMechanics'
import { getPartyCard, normalizePartyCards, pickPartyCard } from './partyCards'

const PARTY_ROUNDS = [10, 15, 20]
const PARTY_MAP_ID = 'booststone-ruins'
const PARTY_BATTLE_WIN_REWARD = 5
const PARTY_BATTLE_LOSS_PENALTY = 1

// Core Party economy. Mechanic payouts scale with challenge difficulty so
// mechanics stay a major source of Tokens without being the only path to win.
const PARTY_MECHANIC_REWARDS = {
  Easy: 2,
  Medium: 3,
  Hard: 4,
  Insane: 6,
}
const PARTY_FINAL_FIVE_MECHANIC_BONUS = 1
const PARTY_DANGER_PENALTY = 2
const PARTY_FINAL_FIVE_DANGER_PENALTY = 3

// Lucky / Bad Luck Space roulette. Lucky effects provide meaningful catch-up
// options without replacing Mechanics as the main Token source. During the
// final five rounds, every Bad Luck Space becomes a Very Bad Luck Space.
const PARTY_LUCKY_OUTCOMES = [
  { id: 'small-cache', name: 'Small Token Cache', kind: 'tokens', amount: 2 },
  { id: 'token-cache', name: 'Token Cache', kind: 'tokens', amount: 3 },
  { id: 'big-cache', name: 'Big Token Cache', kind: 'tokens', amount: 4 },
  { id: 'jackpot-cache', name: 'Jackpot Cache', kind: 'tokens', amount: 5 },
  { id: 'free-card', name: 'Free Action Card', kind: 'draw-card' },
  { id: 'underdog-boost', name: 'Underdog Boost', kind: 'underdog' },
  { id: 'token-swipe', name: 'Token Swipe', kind: 'steal-tokens', amount: 4 },
]

const PARTY_BAD_LUCK_OUTCOMES = [
  { id: 'flat-tire', name: 'Flat Tire', kind: 'tokens', amount: -1 },
  { id: 'boost-leak', name: 'Boost Leak', kind: 'tokens', amount: -1 },
  { id: 'repair-bill', name: 'Repair Bill', kind: 'tokens', amount: -2 },
  { id: 'missed-toll', name: 'Missed Toll', kind: 'tokens', amount: -2 },
  { id: 'cracked-wheel', name: 'Cracked Wheel', kind: 'tokens', amount: -3 },
  { id: 'card-spill', name: 'Card Spill', kind: 'discard-card', count: 1 },
  { id: 'pay-everyone', name: 'Everyone Gets Paid', kind: 'give-tokens-all', amount: 1 },
  { id: 'pay-random-rival', name: 'Random Rival Payday', kind: 'give-tokens-random', amount: 3 },
  { id: 'pay-last-place', name: 'Last Place Payday', kind: 'give-tokens-last', amount: 4 },
  { id: 'move-trophy', name: 'Trophy Relocation', kind: 'move-trophy' },
  { id: 'double-trophy-price', name: 'Double Trophy Price', kind: 'double-trophy-price' },
]

const PARTY_VERY_BAD_LUCK_OUTCOMES = [
  { id: 'severe-flat-tire', name: 'Severe Flat Tire', kind: 'tokens', amount: -2 },
  { id: 'major-repair-bill', name: 'Major Repair Bill', kind: 'tokens', amount: -3 },
  { id: 'wrecked-wheel', name: 'Wrecked Wheel', kind: 'tokens', amount: -5 },
  { id: 'major-card-spill', name: 'Major Card Spill', kind: 'discard-card', count: 2 },
  { id: 'pay-everyone-big', name: 'Everyone Gets a Bigger Payday', kind: 'give-tokens-all', amount: 2 },
  { id: 'pay-random-rival-big', name: 'Random Rival Jackpot', kind: 'give-tokens-random', amount: 5 },
  { id: 'pay-last-place-big', name: 'Last Place Mega Payday', kind: 'give-tokens-last', amount: 6 },
  { id: 'move-trophy-very-bad', name: 'Trophy Relocation', kind: 'move-trophy' },
  { id: 'double-trophy-price-very-bad', name: 'Double Trophy Price', kind: 'double-trophy-price' },
  { id: 'half-tokens', name: 'Token Wipeout', kind: 'half-tokens' },
  { id: 'lose-trophy', name: 'Lose a Trophy', kind: 'lose-trophy' },
  { id: 'give-trophy-random', name: 'Give Away a Trophy', kind: 'give-trophy-random' },
]

// These two Trophy-specific roulette outcomes are intentionally omitted from
// the future Kamek's Tantalizing Tower remake because that board has its own
// Trophy-location / Trophy-price rules.
const PARTY_TROPHY_CHAOS_OMIT_MAP_IDS = new Set([
  'kameks-tantalizing-tower',
  'kameks-tantalizing-tower-remake',
])

const PARTY_VERY_BAD_TROPHY_FALLBACK_TOKENS = 5

const PARTY_SUPPLY_CRATE_REWARDS = [
  { id: 'crate-3-tokens', name: '3 Tokens', kind: 'tokens', amount: 3 },
  { id: 'crate-5-tokens', name: '5 Tokens', kind: 'tokens', amount: 5 },
  { id: 'crate-precision-dice', name: 'Precision Dice', kind: 'card', cardId: 'precision-dice' },
  { id: 'crate-golden-teleporter', name: 'Golden Teleporter', kind: 'card', cardId: 'golden-teleporter' },
  { id: 'crate-shield', name: 'Shield', kind: 'card', cardId: 'shield' },
]

export const PARTY_BATTLES = [
  {
    number: 1,
    id: 'one-minute-1v1',
    name: '1-Minute 1v1',
    rules: [
      'Play a normal 1v1 for 60 seconds, starting with a normal midfield kickoff.',
      'Both players may score however they want.',
      'After 60 seconds, the player with more goals wins.',
      'If tied, play sudden death. Next goal wins.',
    ],
  },
  {
    number: 2,
    id: 'beat-the-defender',
    name: 'Beat the Defender',
    rules: [
      'Take turns as attacker and defender.',
      'Each player gets 3 attacking attempts from around midfield while the other player defends the net.',
      'Each attacking goal is 1 mini-point. A save or miss is 0.',
      'After 3 attacks each, the player with more goals wins.',
      'If tied, play sudden-death rounds: each player gets 1 attack; one score and one miss decides the winner.',
    ],
  },
  {
    number: 3,
    id: 'freestyle-shootout',
    name: 'Freestyle Shootout',
    rules: [
      'Each player gets 3 freestyle attempts total. Any freestyle move is allowed.',
      'Only successful goals are eligible for judging.',
      "After all attempts, compare each player's best successful freestyle shot and judge which was better.",
      'If one player misses all 3 and the other makes at least 1, the scorer wins automatically.',
      'If both miss all 3, use sudden death with 1 freestyle attempt each per round.',
    ],
  },
  {
    number: 4,
    id: 'goalie-challenge',
    name: 'Goalie Challenge',
    rules: [
      'Each player gets 3 shots to defend as goalie.',
      'Player A shoots 3 while Player B is goalie, then Player B shoots 3 while Player A is goalie.',
      'The goalie earns 1 mini-point for each save.',
      'After both players defend 3 shots, more saves wins.',
      'If tied, use sudden-death rounds with 1 shot faced by each goalie.',
    ],
  },
  {
    number: 5,
    id: 'crossbar-contest',
    name: 'Crossbar Contest',
    rules: [
      'Each player gets 3 attempts to hit the crossbar.',
      'Every attempt starts with the ball on the exact center kickoff spot and the shot taken from center.',
      'No wall, dribble, ceiling, or moved-ball setup is allowed.',
      'A crossbar hit is 1 mini-point. More hits after 3 attempts each wins.',
      'If tied, use sudden-death center-kickoff attempts.',
    ],
  },
  {
    number: 6,
    id: 'same-mechanic-duel',
    name: 'Same Mechanic Duel',
    needsBattleMechanic: true,
    allowMutualConcede: true,
    rules: [
      'Both players must attempt the exact same randomly drawn Battle mechanic shown below.',
      'Each player gets 3 attempts. Every successful completion is 1 mini-point.',
      'After 3 attempts each, more completions wins.',
      'If tied, use sudden-death rounds on the same mechanic: 1 attempt each.',
      'If the mechanic is unreasonable for both players, both may agree to mutually concede for no Token change.',
    ],
  },
  {
    number: 9,
    id: 'one-letter-horse',
    name: 'One-Letter HORSE',
    rules: [
      'Randomly decide who sets first outside the app.',
      'The Setter clearly calls a freestyle shot and gets exactly 1 attempt.',
      'If the Setter misses, roles switch and no challenge is set.',
      'If the Setter makes it, the Copier gets exactly 1 attempt to copy the called shot.',
      'If the Copier misses, the Copier immediately loses. If the Copier makes it, roles switch.',
    ],
  },
  {
    number: 12,
    id: 'copycat-chain',
    name: 'Copycat Chain',
    rules: [
      'One player starts by setting and making a freestyle shot.',
      'The other player gets exactly 1 attempt to copy it. Failing a copy is an immediate loss.',
      'If the copy succeeds, that player gets 1 attempt to upgrade the shot by adding something or making it harder.',
      'Failing an upgrade does not lose the Battle; the chain ends and the original Setter starts a new chain.',
      'A player only loses by failing to copy a successfully made shot.',
    ],
  },
  {
    number: 14,
    id: 'accuracy-horse',
    name: 'Accuracy HORSE',
    rules: [
      'Randomly decide who sets first outside the app.',
      'The Setter calls a target such as top left, top right, bottom left, bottom right, crossbar in, or post in.',
      'Every attempt must be a legitimate flick from a fair distance from goal.',
      'The Setter gets 1 attempt. If they hit the called target, the Copier gets 1 attempt to reproduce it.',
      'If the Copier misses, the Copier immediately loses. If the Copier makes it, roles switch.',
    ],
  },
  {
    number: 15,
    id: 'speed-challenge',
    name: 'Speed Challenge',
    rules: [
      'Each player gets exactly 3 attempts to score the fastest shot possible. Pinches are allowed.',
      'Record the KPH of every successful goal. A miss counts as 0 KPH.',
      'Add all 3 attempt speeds together for each player.',
      'Higher total KPH wins.',
      'If exactly tied, use sudden death: 1 shot each, faster successful shot wins.',
    ],
  },
  {
    number: 18,
    id: 'kuxir-pinch-battle',
    name: 'Kuxir Pinch Battle',
    rules: [
      'Play repeated rounds. Each player gets exactly 1 Kuxir pinch attempt per round.',
      'If exactly one player scores the Kuxir pinch, that player wins immediately.',
      'If both miss, repeat another round.',
      'If both score in the same round, the faster Kuxir pinch wins.',
      'If the speeds tie exactly, repeat another round.',
    ],
  },
  {
    number: 19,
    id: 'reset-ladder',
    name: 'Reset Ladder',
    allowMutualConcede: true,
    rules: [
      'Start at 1 reset. Both players get exactly 1 attempt at the same required reset count.',
      'If one player scores and the other misses, the scorer wins immediately.',
      'If both miss, repeat the same reset level.',
      'If both score, add 1 reset for the next round: single to double to triple to quadruple and so on.',
      'If the required reset count becomes unreasonable, both players may agree to mutually concede for no Token change.',
    ],
  },
  {
    number: 20,
    id: 'kickoff-battle',
    name: 'Kickoff Battle',
    rules: [
      'Play a best-of-3 series of normal 1v1 kickoffs.',
      "If the ball clearly ends up on the opponent's side of the field, you win that kickoff and earn 1 mini-point.",
      'First player to 2 mini-points wins the Battle.',
      'If a kickoff is too close or ambiguous to judge, redo that kickoff with no mini-point awarded.',
    ],
  },
  {
    number: 21,
    id: 'training-pack-race',
    name: 'Training Pack Race',
    rules: [
      'Choose a random training pack yourselves. The app does not choose the pack.',
      'The training pack must contain at least 10 shots.',
      'Both players race through Shots 1-10 in order, retrying each shot until it is scored.',
      'The first player to successfully complete Shot 10 wins.',
    ],
  },
  {
    number: 23,
    id: 'reverse-one-minute-1v1',
    name: 'Reverse 1v1',
    rules: [
      'Play a 60-second 1v1, but both players must drive in reverse for the entire Battle, including kickoff.',
      'No normal forward driving is allowed; a play made by clearly driving forward does not count.',
      'After 60 seconds, more goals wins.',
      'If tied, play sudden death under the same reverse-only rule.',
    ],
  },
  {
    number: 24,
    id: 'random-car-one-minute-1v1',
    name: 'Random Car 1v1',
    rules: [
      'Before starting, each player chooses a random car and keeps it for the entire Battle.',
      'Play a normal 1v1 for 60 seconds, starting with a normal midfield kickoff.',
      'After 60 seconds, more goals wins.',
      'If tied, play sudden death with the same random cars.',
    ],
  },
  {
    number: 25,
    id: 'random-mutators-one-minute-1v1',
    name: 'Random Mutators 1v1',
    rules: [
      'Before starting, set random Rocket League mutators for the private match. Both players use the same settings.',
      'Play a 60-second 1v1 with those mutators, starting from kickoff.',
      'After 60 seconds, more goals wins.',
      'If tied, keep the same mutators and play sudden death.',
    ],
  },
]

const BOARD_NODE_BY_ID = Object.fromEntries(
  BOOSTSTONE_RUINS.nodes.map((node) => [node.id, node])
)

const PARTY_MECHANIC_DIFFICULTY_ORDER = ['Easy', 'Medium', 'Hard', 'Insane']

function getPartyMechanicDifficulty(mechanic) {
  if (!mechanic) return 'Medium'
  return mechanic.difficulty || 'Medium'
}

function shuffledPartyMechanics() {
  const pool = [...PARTY_MECHANICS]

  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]]
  }

  return pool
}

function getAdjacentPartyMechanicDifficulty(currentDifficulty, direction) {
  const index = PARTY_MECHANIC_DIFFICULTY_ORDER.indexOf(currentDifficulty)
  if (index === -1) return null
  const nextIndex = index + direction
  if (nextIndex < 0 || nextIndex >= PARTY_MECHANIC_DIFFICULTY_ORDER.length) return null
  return PARTY_MECHANIC_DIFFICULTY_ORDER[nextIndex]
}

function getPartyBattleBySeed(seed = 0) {
  if (!PARTY_BATTLES.length) return null
  const normalized = Math.max(0, Math.min(0.999999999, Number(seed) || 0))
  return PARTY_BATTLES[Math.floor(normalized * PARTY_BATTLES.length)] || PARTY_BATTLES[0]
}

function getPartyBattleOpponent(room, challengerId, seed = 0) {
  const candidates = orderedPlayerIds(room).filter((id) => id && id !== challengerId && room.playerSetup?.[id])
  if (!candidates.length) return ''
  const normalized = Math.max(0, Math.min(0.999999999, Number(seed) || 0))
  return candidates[Math.floor(normalized * candidates.length)] || candidates[0]
}

function makePartyBattle(room, challengerId, opponentId, source, battleSeed = 0, battleMechanic = null) {
  const battle = getPartyBattleBySeed(battleSeed)
  if (!battle || !challengerId || !opponentId) return null

  const state = {
    id: battle.id,
    name: battle.name,
    number: battle.number,
    rules: battle.rules,
    challengerId,
    opponentId,
    participantIds: [challengerId, opponentId],
    source,
    status: 'active',
    rewardTokens: PARTY_BATTLE_WIN_REWARD,
    lossTokens: PARTY_BATTLE_LOSS_PENALTY,
    allowMutualConcede: Boolean(battle.allowMutualConcede),
    startedAt: Date.now(),
  }

  if (battle.needsBattleMechanic && battleMechanic) {
    state.battleMechanic = {
      id: battleMechanic.id,
      name: battleMechanic.name,
      difficulty: getPartyMechanicDifficulty(battleMechanic),
    }
  }

  return state
}

function startPartyBattle(room, turn, challengerId, source, options = {}) {
  const opponentId = options.opponentId || getPartyBattleOpponent(room, challengerId, options.opponentSeed)
  if (!opponentId) return null

  const battle = makePartyBattle(
    room,
    challengerId,
    opponentId,
    source,
    options.battleSeed,
    options.battleMechanic
  )
  if (!battle) return null

  turn.battle = battle
  const challengerName = room.players?.[challengerId]?.name || 'Player'
  const opponentName = room.players?.[opponentId]?.name || 'Player'
  if (source === 'battle-space') {
    addPartyActivity(
      room,
      challengerId,
      `${challengerName} landed on a Battle Space and drew ${battle.name} against ${opponentName}.`,
      'battle'
    )
  }
  return battle
}

function pickTrophySpot(excludeNodeId = '') {
  const spots = BOOSTSTONE_RUINS.trophySpots || []
  if (!spots.length) return BOOSTSTONE_RUINS.startId

  const candidates = spots.filter((nodeId) => nodeId !== excludeNodeId)
  const pool = candidates.length ? candidates : spots
  return pool[Math.floor(Math.random() * pool.length)]
}

function findNodeOneSpaceBefore(targetNodeId) {
  const predecessors = BOOSTSTONE_RUINS.nodes.filter((node) =>
    (node.next || []).includes(targetNodeId)
  )

  if (!predecessors.length) return null

  // Prefer a space whose only forward path is the Trophy, so a roll of 1
  // reaches it without forcing an extra route choice.
  const forcedPredecessor = predecessors.find(
    (node) => (node.next || []).length === 1
  )

  return (forcedPredecessor || predecessors[0]).id
}


function makeLandingEffect(room, nodeId, mechanic) {
  const node = BOARD_NODE_BY_ID[nodeId]
  if (!node || !mechanic) return null

  const totalRounds = room.settings?.rounds || 10
  const currentRound = room.currentRound || 1
  const finalFive = currentRound > Math.max(0, totalRounds - 5)
  const difficulty = getPartyMechanicDifficulty(mechanic)
  const baseReward = PARTY_MECHANIC_REWARDS[difficulty] ?? PARTY_MECHANIC_REWARDS.Medium
  const mechanicReward = baseReward + (finalFive ? PARTY_FINAL_FIVE_MECHANIC_BONUS : 0)
  const dangerPenalty = finalFive
    ? PARTY_FINAL_FIVE_DANGER_PENALTY
    : PARTY_DANGER_PENALTY

  if (node.type === 'Mechanic') {
    return {
      type: 'mechanic',
      challengeId: mechanic.id,
      challengeName: mechanic.name,
      difficulty,
      resolved: false,
      attemptLimit: 2,
      attemptsUsed: 0,
      reward: mechanicReward,
      baseReward,
      finalFiveBonus: finalFive ? PARTY_FINAL_FIVE_MECHANIC_BONUS : 0,
      finalFive,
    }
  }

  if (node.type === 'Danger Mechanic') {
    return {
      type: 'danger-mechanic',
      challengeId: mechanic.id,
      challengeName: mechanic.name,
      difficulty,
      resolved: false,
      attemptLimit: 2,
      attemptsUsed: 0,
      penalty: dangerPenalty,
      finalFive,
    }
  }

  return null
}

function setNegativeCardResultNotice(room, playerId, message) {
  if (!playerId || !message) return

  const setup = room.playerSetup?.[playerId]
  if (!setup) return

  setup.negativeCardResultNotice = message
  setup.negativeCardResultNoticeAt = Date.now()
}

function attachLandingEffect(room, turn, playerId, nodeId, mechanic) {
  const effect = makeLandingEffect(room, nodeId, mechanic)

  if (!effect) {
    delete turn.landingEffect
    return
  }

  const setup = room.playerSetup?.[playerId]
  if (setup) {
    const targetName = room.players?.[playerId]?.name || 'Player'

    if (setup.pressureActive) {
      effect.pressureTriggered = true
      effect.attemptLimit = 1
      setup.pressureActive = false
      setNegativeCardResultNotice(
        room,
        setup.pressureSourcePlayerId,
        `Pressure triggered on ${targetName}. Their Mechanic is now limited to 1 attempt.`
      )
      delete setup.pressureSourcePlayerId
    }

    if (setup.noBounceActive) {
      effect.noBounceRequired = true
      setup.noBounceActive = false
      setNegativeCardResultNotice(
        room,
        setup.noBounceSourcePlayerId,
        `Zero Bounce triggered on ${targetName}. Their Mechanic now requires no bounce.`
      )
      delete setup.noBounceSourcePlayerId
    }

    if (setup.kph100Active) {
      effect.kph100Required = true
      setup.kph100Active = false
      setNegativeCardResultNotice(
        room,
        setup.kph100SourcePlayerId,
        `100+ KPH triggered on ${targetName}. Their Mechanic goal must now be at least 100 KPH.`
      )
      delete setup.kph100SourcePlayerId
    }

    if (setup.topCornerActive) {
      effect.topCornerRequired = true
      setup.topCornerActive = false
      setNegativeCardResultNotice(
        room,
        setup.topCornerSourcePlayerId,
        `Top Corner triggered on ${targetName}. Their Mechanic goal must now finish in a top corner.`
      )
      delete setup.topCornerSourcePlayerId
    }

    if (setup.hotStreakActive) {
      effect.hotStreakTriggered = true
      effect.attemptLimit = 1
      setup.hotStreakActive = false
    }

  }

  turn.landingEffect = effect
}

function addPartyActivity(room, playerId, message, type = 'info') {
  const nextSeq = (room.activitySeq || 0) + 1
  room.activitySeq = nextSeq

  if (!room.activityFeed || typeof room.activityFeed !== 'object') {
    room.activityFeed = {}
  }

  const key = `a${String(nextSeq).padStart(4, '0')}`
  room.activityFeed[key] = {
    seq: nextSeq,
    playerId: playerId || '',
    message,
    type,
    createdAt: Date.now(),
  }

  const newestFirst = Object.entries(room.activityFeed)
    .sort(([, first], [, second]) => (second.seq || 0) - (first.seq || 0))

  for (const [oldKey] of newestFirst.slice(10)) {
    delete room.activityFeed[oldKey]
  }
}

function addLandingActivity(room, playerId, nodeId) {
  const node = BOARD_NODE_BY_ID[nodeId]
  if (!node) return

  // Card Space activity is combined with the draw/full-inventory result below
  // so the shared feed reads like one smooth game event.
  if (node.type === 'Card') return

  const playerName = room.players?.[playerId]?.name || 'Player'
  const spaceNumber = Number(String(nodeId).replace('n', '')) || nodeId
  addPartyActivity(
    room,
    playerId,
    `${playerName} landed on Space ${spaceNumber} • ${node.type}.`,
    'landing'
  )
}

function applyCardLanding(room, turn, playerId, card) {
  const node = BOARD_NODE_BY_ID[turn.landedNodeId]
  if (!node || node.type !== 'Card' || !card) return

  const setup = room.playerSetup?.[playerId]
  if (!setup) return

  const playerName = room.players?.[playerId]?.name || 'Player'
  const cards = normalizePartyCards(setup.cards)

  delete turn.cardDrawCardId
  delete turn.cardDrawStatus

  if (cards.length >= 3) {
    turn.cardDrawStatus = 'full'
    addPartyActivity(
      room,
      playerId,
      `${playerName} landed on a Card Space, but their 3-card inventory was full.`,
      'card'
    )
    return
  }

  cards.push(card.id)
  setup.cards = cards
  turn.cardDrawStatus = 'drawn'
  turn.cardDrawCardId = card.id

  const cardVisibility = room.settings?.cardVisibility === 'open' ? 'open' : 'hidden'
  addPartyActivity(
    room,
    playerId,
    cardVisibility === 'open'
      ? `${playerName} landed on a Card Space and drew ${card.name}.`
      : `${playerName} landed on a Card Space and drew a Card.`,
    'card'
  )
}

function isPartyFinalFive(room) {
  const totalRounds = room?.settings?.rounds || 10
  const currentRound = room?.currentRound || 1
  return currentRound > Math.max(0, totalRounds - 5)
}

function getPartyBaseTrophyPrice(room) {
  return room?.settings?.trophyPrice ?? BOOSTSTONE_RUINS.defaultTrophyPrice
}

function getPartyEffectiveTrophyPrice(room) {
  const basePrice = getPartyBaseTrophyPrice(room)
  const multiplier = Math.max(1, Number(room?.temporaryTrophyPriceMultiplier) || 1)
  return Math.max(0, Math.round(basePrice * multiplier))
}

function normalizePartySeed(seed = 0) {
  return Math.max(0, Math.min(0.999999999, Number(seed) || 0))
}

function shiftedPartySeed(seed = 0, shift = 0) {
  return (normalizePartySeed(seed) * 9973 + shift * 0.61803398875) % 1
}

function choosePartySeeded(items, seed = 0, shift = 0) {
  if (!items?.length) return null
  const value = shiftedPartySeed(seed, shift)
  return items[Math.min(items.length - 1, Math.floor(value * items.length))]
}

function getPartySpaceOutcome(room, playerId, spaceType, seed = 0) {
  const setup = room.playerSetup?.[playerId] || {}
  const forceVeryBad = spaceType === 'Very Bad Luck'
  const veryBad = forceVeryBad || (spaceType === 'Bad Luck' && isPartyFinalFive(room))
  let pool = spaceType === 'Lucky'
    ? PARTY_LUCKY_OUTCOMES
    : veryBad
      ? PARTY_VERY_BAD_LUCK_OUTCOMES
      : PARTY_BAD_LUCK_OUTCOMES

  const mapId = room.settings?.mapId || PARTY_MAP_ID
  if (PARTY_TROPHY_CHAOS_OMIT_MAP_IDS.has(mapId)) {
    pool = pool.filter((outcome) => !['move-trophy', 'double-trophy-price'].includes(outcome.kind))
  }

  if ((Number(room.temporaryTrophyPriceMultiplier) || 1) >= 2) {
    pool = pool.filter((outcome) => outcome.kind !== 'double-trophy-price')
  }


  const outcome = choosePartySeeded(pool, seed)
  return { outcome: outcome || pool[0], veryBad }
}

function getPartyOpponentIds(room, playerId) {
  return orderedPlayerIds(room).filter((id) => id !== playerId && room.playerSetup?.[id])
}

function getPartyLowestRankedOpponentId(room, playerId, seed = 0) {
  const candidates = getPartyOpponentIds(room, playerId)
  if (!candidates.length) return ''

  let fewestTrophies = Infinity
  let fewestTokens = Infinity
  for (const id of candidates) {
    const setup = room.playerSetup?.[id] || {}
    const trophies = Number(setup.trophies) || 0
    const tokens = Number(setup.tokens) || 0
    if (trophies < fewestTrophies || (trophies === fewestTrophies && tokens < fewestTokens)) {
      fewestTrophies = trophies
      fewestTokens = tokens
    }
  }

  const tied = candidates.filter((id) => {
    const setup = room.playerSetup?.[id] || {}
    return (Number(setup.trophies) || 0) === fewestTrophies &&
      (Number(setup.tokens) || 0) === fewestTokens
  })
  return choosePartySeeded(tied, seed, 7)?.toString() || tied[0] || ''
}

function transferPartyTokens(room, fromPlayerId, toPlayerId, requestedAmount) {
  const fromSetup = room.playerSetup?.[fromPlayerId]
  const toSetup = room.playerSetup?.[toPlayerId]
  if (!fromSetup || !toSetup || fromPlayerId === toPlayerId) return 0

  const available = Math.max(0, Number(fromSetup.tokens) || 0)
  const amount = Math.max(0, Math.min(available, Number(requestedAmount) || 0))
  fromSetup.tokens = available - amount
  toSetup.tokens = Math.max(0, Number(toSetup.tokens) || 0) + amount
  return amount
}

function transferPartyTokensToAll(room, fromPlayerId, requestedEach, seed = 0) {
  const recipients = getPartyOpponentIds(room, fromPlayerId)
  const changes = {}
  if (!recipients.length) return changes

  const startIndex = Math.floor(shiftedPartySeed(seed, 11) * recipients.length)
  const ordered = recipients.map((_, index) => recipients[(startIndex + index) % recipients.length])
  const cycles = Math.max(0, Number(requestedEach) || 0)

  for (let cycle = 0; cycle < cycles; cycle += 1) {
    for (const recipientId of ordered) {
      const amount = transferPartyTokens(room, fromPlayerId, recipientId, 1)
      if (!amount) return changes
      changes[recipientId] = (changes[recipientId] || 0) + amount
    }
  }

  return changes
}

function relocatePartyTrophy(room, seed = 0) {
  const spots = BOOSTSTONE_RUINS.trophySpots || []
  if (!spots.length) return { from: '', to: '' }

  const from = room.activeTrophyNodeId || spots[0]
  const candidates = spots.filter((id) => id !== from)
  const to = choosePartySeeded(candidates.length ? candidates : spots, seed, 19) || from
  room.activeTrophyNodeId = to
  return { from, to }
}

function partyNodeNumber(nodeId) {
  return Number(String(nodeId || '').replace('n', '')) || 0
}

function applyPartyLuckLanding(room, turn, playerId, spaceType, seed = 0, card = null) {
  const setup = room.playerSetup?.[playerId]
  if (!setup) return null

  const { outcome, veryBad } = getPartySpaceOutcome(room, playerId, spaceType, seed)
  if (!outcome) return null

  const isBadLuck = spaceType !== 'Lucky'
  const effectiveSpaceType = veryBad ? 'Very Bad Luck' : spaceType
  const rouletteLabel = veryBad ? 'Very Bad Luck Roulette' : isBadLuck ? 'Bad Luck Roulette' : 'Lucky Roulette'
  const playerName = room.players?.[playerId]?.name || 'Player'
  const openHands = room.settings?.cardVisibility === 'open'
  let publicMessage = ''
  let privateMessage = ''
  let tokenChange = 0
  let trophyChange = 0
  let cardId = ''
  let cardIds = []
  let targetPlayerId = ''
  let targetPlayerIds = []
  let recipientTokenChanges = {}

  if (outcome.kind === 'tokens') {
    const before = Math.max(0, Number(setup.tokens) || 0)
    const after = Math.max(0, before + outcome.amount)
    setup.tokens = after
    tokenChange = after - before
    publicMessage = tokenChange >= 0
      ? `${playerName}'s ${rouletteLabel} landed on ${outcome.name}: +${tokenChange} Tokens.`
      : `${playerName}'s ${rouletteLabel} landed on ${outcome.name}: ${tokenChange} Tokens.`
    privateMessage = publicMessage
  } else if (outcome.kind === 'draw-card') {
    const cards = normalizePartyCards(setup.cards)
    if (cards.length < 3 && card) {
      cards.push(card.id)
      setup.cards = cards
      cardId = card.id
      cardIds = [card.id]
      publicMessage = openHands
        ? `${playerName}'s Lucky Roulette awarded ${card.name}.`
        : `${playerName}'s Lucky Roulette awarded an Action Card.`
      privateMessage = `${playerName}'s Lucky Roulette awarded ${card.name}.`
    } else {
      setup.tokens = Math.max(0, (Number(setup.tokens) || 0) + 2)
      tokenChange = 2
      publicMessage = `${playerName}'s inventory was full, so Free Action Card converted into +2 Tokens.`
      privateMessage = publicMessage
    }
  } else if (outcome.kind === 'underdog') {
    const trophyCounts = orderedPlayerIds(room)
      .map((id) => Number(room.playerSetup?.[id]?.trophies) || 0)
    const fewestTrophies = trophyCounts.length ? Math.min(...trophyCounts) : 0
    const playerTrophies = Number(setup.trophies) || 0
    const amount = playerTrophies === fewestTrophies ? 4 : 2
    setup.tokens = Math.max(0, (Number(setup.tokens) || 0) + amount)
    tokenChange = amount
    publicMessage = playerTrophies === fewestTrophies
      ? `${playerName}'s Lucky Roulette landed on Underdog Boost: +4 Tokens for being tied for the fewest Trophies.`
      : `${playerName}'s Lucky Roulette landed on Underdog Boost: +2 Tokens.`
    privateMessage = publicMessage
  } else if (outcome.kind === 'steal-tokens') {
    targetPlayerIds = getPartyOpponentIds(room, playerId)
    publicMessage = `${playerName}'s Lucky Roulette landed on Token Swipe. ${playerName} must choose a player to steal up to ${outcome.amount} Tokens from.`
    privateMessage = publicMessage

    turn.spaceEffect = {
      type: 'lucky',
      spaceType: effectiveSpaceType,
      id: outcome.id,
      kind: outcome.kind,
      name: outcome.name,
      resolved: false,
      awaitingTarget: true,
      amount: outcome.amount,
      targetPlayerIds,
      tokenChange: 0,
      trophyChange: 0,
      cardId: '',
      cardIds: [],
      publicMessage,
      privateMessage,
    }
    addPartyActivity(room, playerId, publicMessage, 'lucky')
    return turn.spaceEffect
  } else if (outcome.kind === 'discard-card') {
    const cards = normalizePartyCards(setup.cards)
    const discardCount = Math.min(cards.length, Math.max(1, Number(outcome.count) || 1))

    for (let index = 0; index < discardCount; index += 1) {
      if (!cards.length) break
      const scaled = shiftedPartySeed(seed, 23 + index)
      const discardIndex = Math.min(cards.length - 1, Math.floor(scaled * cards.length))
      const [discardedId] = cards.splice(discardIndex, 1)
      if (discardedId) cardIds.push(discardedId)
    }

    if (cardIds.length) {
      setup.cards = cards
      cardId = cardIds[0]
      const discardedNames = cardIds.map((id) => getPartyCard(id)?.name || 'a Card')
      publicMessage = openHands
        ? `${playerName}'s ${rouletteLabel} landed on ${outcome.name} and discarded ${discardedNames.join(' and ')}.`
        : `${playerName}'s ${rouletteLabel} landed on ${outcome.name} and discarded ${cardIds.length} random Action Card${cardIds.length === 1 ? '' : 's'}.`
      privateMessage = `${playerName}'s ${rouletteLabel} landed on ${outcome.name} and discarded ${discardedNames.join(' and ')}.`
    } else {
      const fallbackLoss = veryBad ? 2 : 1
      const before = Math.max(0, Number(setup.tokens) || 0)
      const after = Math.max(0, before - fallbackLoss)
      setup.tokens = after
      tokenChange = after - before
      publicMessage = `${playerName} had no Action Cards to spill, so ${outcome.name} cost ${Math.abs(tokenChange)} Token${Math.abs(tokenChange) === 1 ? '' : 's'} instead.`
      privateMessage = publicMessage
    }
  } else if (outcome.kind === 'give-tokens-all') {
    recipientTokenChanges = transferPartyTokensToAll(room, playerId, outcome.amount, seed)
    const totalGiven = Object.values(recipientTokenChanges).reduce((sum, amount) => sum + amount, 0)
    tokenChange = -totalGiven
    targetPlayerIds = Object.keys(recipientTokenChanges)
    publicMessage = totalGiven > 0
      ? `${playerName}'s ${rouletteLabel} landed on ${outcome.name} and gave ${totalGiven} Token${totalGiven === 1 ? '' : 's'} across the other players.`
      : `${playerName}'s ${rouletteLabel} landed on ${outcome.name}, but had no Tokens to give.`
    privateMessage = publicMessage
  } else if (outcome.kind === 'give-tokens-random') {
    const opponents = getPartyOpponentIds(room, playerId)
    targetPlayerId = choosePartySeeded(opponents, seed, 29) || ''
    const amount = targetPlayerId ? transferPartyTokens(room, playerId, targetPlayerId, outcome.amount) : 0
    tokenChange = -amount
    const targetName = room.players?.[targetPlayerId]?.name || 'another player'
    publicMessage = amount > 0
      ? `${playerName}'s ${rouletteLabel} landed on ${outcome.name} and gave ${amount} Token${amount === 1 ? '' : 's'} to ${targetName}.`
      : `${playerName}'s ${rouletteLabel} landed on ${outcome.name}, but had no Tokens to give.`
    privateMessage = publicMessage
  } else if (outcome.kind === 'give-tokens-last') {
    targetPlayerId = getPartyLowestRankedOpponentId(room, playerId, seed)
    const amount = targetPlayerId ? transferPartyTokens(room, playerId, targetPlayerId, outcome.amount) : 0
    tokenChange = -amount
    const targetName = room.players?.[targetPlayerId]?.name || 'the lowest-ranked rival'
    publicMessage = amount > 0
      ? `${playerName}'s ${rouletteLabel} landed on ${outcome.name} and gave ${amount} Token${amount === 1 ? '' : 's'} to ${targetName}, the lowest-ranked other player.`
      : `${playerName}'s ${rouletteLabel} landed on ${outcome.name}, but had no Tokens to give.`
    privateMessage = publicMessage
  } else if (outcome.kind === 'move-trophy') {
    const moved = relocatePartyTrophy(room, seed)
    publicMessage = moved.to && moved.to !== moved.from
      ? `${playerName}'s ${rouletteLabel} moved the active Trophy from Space ${partyNodeNumber(moved.from)} to Space ${partyNodeNumber(moved.to)}.`
      : `${playerName}'s ${rouletteLabel} tried to relocate the Trophy, but no alternate Trophy spot was available.`
    privateMessage = publicMessage
  } else if (outcome.kind === 'double-trophy-price') {
    room.temporaryTrophyPriceMultiplier = 2
    room.temporaryTrophyPriceUntil = 'next-trophy-purchase'
    const doubledPrice = getPartyEffectiveTrophyPrice(room)
    publicMessage = `${playerName}'s ${rouletteLabel} doubled the Trophy price to ${doubledPrice} Tokens until the next Trophy is purchased.`
    privateMessage = publicMessage
  } else if (outcome.kind === 'half-tokens') {
    const before = Math.max(0, Number(setup.tokens) || 0)
    const after = Math.floor(before / 2)
    setup.tokens = after
    tokenChange = after - before
    publicMessage = `${playerName}'s Very Bad Luck Roulette landed on ${outcome.name} and wiped out ${Math.abs(tokenChange)} Token${Math.abs(tokenChange) === 1 ? '' : 's'} — half their Token total.`
    privateMessage = publicMessage
  } else if (outcome.kind === 'lose-trophy') {
    const trophies = Math.max(0, Number(setup.trophies) || 0)
    if (trophies > 0) {
      setup.trophies = trophies - 1
      trophyChange = -1
      publicMessage = `${playerName}'s Very Bad Luck Roulette landed on ${outcome.name}: -1 Trophy.`
    } else {
      const before = Math.max(0, Number(setup.tokens) || 0)
      const after = Math.max(0, before - PARTY_VERY_BAD_TROPHY_FALLBACK_TOKENS)
      setup.tokens = after
      tokenChange = after - before
      const lost = Math.abs(tokenChange)
      publicMessage = lost > 0
        ? `${playerName} had no Trophy to lose, so ${outcome.name} became a ${lost}-Token penalty instead.`
        : `${playerName} had no Trophy or Tokens available for the ${outcome.name} penalty.`
    }
    privateMessage = publicMessage
  } else if (outcome.kind === 'give-trophy-random') {
    const opponents = getPartyOpponentIds(room, playerId)
    targetPlayerId = choosePartySeeded(opponents, seed, 37) || ''
    const targetSetup = room.playerSetup?.[targetPlayerId]
    const targetName = room.players?.[targetPlayerId]?.name || 'another player'
    const trophies = Math.max(0, Number(setup.trophies) || 0)
    if (targetSetup && trophies > 0) {
      setup.trophies = trophies - 1
      targetSetup.trophies = (Number(targetSetup.trophies) || 0) + 1
      trophyChange = -1
      publicMessage = `${playerName}'s Very Bad Luck Roulette gave 1 of their Trophies to ${targetName}.`
    } else if (targetSetup) {
      const amount = transferPartyTokens(room, playerId, targetPlayerId, PARTY_VERY_BAD_TROPHY_FALLBACK_TOKENS)
      tokenChange = -amount
      publicMessage = amount > 0
        ? `${playerName} had no Trophy to give, so ${outcome.name} sent ${amount} Token${amount === 1 ? '' : 's'} to ${targetName} instead.`
        : `${playerName} had no Trophy or Tokens available to give to ${targetName}.`
    } else {
      publicMessage = `${playerName} had no valid rival to receive the Very Bad Luck penalty.`
    }
    privateMessage = publicMessage
  }

  turn.spaceEffect = {
    type: veryBad ? 'very-bad-luck' : isBadLuck ? 'bad-luck' : 'lucky',
    spaceType: effectiveSpaceType,
    id: outcome.id,
    kind: outcome.kind,
    name: outcome.name,
    resolved: true,
    tokenChange,
    trophyChange,
    cardId,
    cardIds,
    targetPlayerId,
    targetPlayerIds,
    recipientTokenChanges,
    publicMessage,
    privateMessage,
  }

  addPartyActivity(room, playerId, publicMessage, veryBad ? 'very-bad-luck' : isBadLuck ? 'bad-luck' : 'lucky')
  return turn.spaceEffect
}

export async function resolvePartyLuckyTokenSteal(roomCode, playerId, targetId = '') {
  requireOnlineIdentity(playerId)
  const code = normalizeCode(roomCode)
  const roomRef = ref(db, `securePartyRooms/${code}`)
  const randomSeed = Math.random()
  let failureReason = ''

  const result = await runTransaction(roomRef, (room) => {
    if (!room) {
      failureReason = 'Party room not found.'
      return
    }

    if (room.status !== 'playing' || room.phase !== 'board') {
      failureReason = 'The Lucky Space cannot be resolved right now.'
      return
    }

    const order = orderedPlayerIds(room)
    const activePlayerId = order[room.turnIndex || 0]
    const turn = room.turnState
    const effect = turn?.spaceEffect

    if (activePlayerId !== playerId || turn?.playerId !== playerId) {
      failureReason = 'It is not your turn.'
      return
    }

    if (!effect || effect.id !== 'token-swipe' || effect.resolved || !effect.awaitingTarget) {
      failureReason = 'There is no Token Swipe target waiting.'
      return
    }

    const eligibleIds = getPartyOpponentIds(room, playerId)
    if (!eligibleIds.length) {
      failureReason = 'No valid player is available to steal from.'
      return
    }

    const chosenTargetId = targetId
      ? targetId
      : choosePartySeeded(eligibleIds, randomSeed, 41)

    if (!eligibleIds.includes(chosenTargetId)) {
      failureReason = 'That player is not a valid Token Swipe target.'
      return
    }

    const sourceSetup = room.playerSetup?.[chosenTargetId]
    const destinationSetup = room.playerSetup?.[playerId]
    const amount = Math.min(
      Math.max(0, Number(effect.amount) || 4),
      Math.max(0, Number(sourceSetup?.tokens) || 0)
    )

    sourceSetup.tokens = Math.max(0, (Number(sourceSetup.tokens) || 0) - amount)
    destinationSetup.tokens = Math.max(0, Number(destinationSetup.tokens) || 0) + amount

    const playerName = room.players?.[playerId]?.name || 'Player'
    const targetName = room.players?.[chosenTargetId]?.name || 'another player'
    const message = amount > 0
      ? `${playerName}'s Lucky Token Swipe stole ${amount} Token${amount === 1 ? '' : 's'} from ${targetName}.`
      : `${playerName}'s Lucky Token Swipe targeted ${targetName}, but they had no Tokens to steal.`

    effect.resolved = true
    effect.awaitingTarget = false
    effect.targetPlayerId = chosenTargetId
    effect.targetPlayerIds = eligibleIds
    effect.tokenChange = amount
    effect.publicMessage = message
    effect.privateMessage = message
    turn.spaceEffect = effect

    addPartyActivity(room, playerId, message, 'lucky')
    room.turnState = turn
    return room
  })

  if (!result.committed) {
    throw new Error(failureReason || 'Could not resolve Token Swipe.')
  }
}


function ensurePartyBoardState(room) {
  if (!room.boardState || typeof room.boardState !== 'object') room.boardState = {}
  if (!room.boardState.usedBoardEvents || typeof room.boardState.usedBoardEvents !== 'object') {
    room.boardState.usedBoardEvents = {}
  }
  if (!room.boardState.closedGarageGateId) {
    room.boardState.closedGarageGateId = BOOSTSTONE_RUINS.gates?.[0]?.id || ''
  }
  return room.boardState
}

function getPartyClosedGarageGate(room) {
  const boardState = ensurePartyBoardState(room)
  const gates = BOOSTSTONE_RUINS.gates || []
  return gates.find((gate) => gate.id === boardState.closedGarageGateId) || gates[0] || null
}

function partyGateEdgeKey(fromId, toId) {
  return `${fromId}->${toId}`
}

function getPartyClosedGateForEdge(room, fromId, toId) {
  const gate = getPartyClosedGarageGate(room)
  if (!gate || !Array.isArray(gate.between) || gate.between.length < 2) return null
  const [first, second] = gate.between
  const matches = (first === fromId && second === toId) || (first === toId && second === fromId)
  return matches ? gate : null
}

function rotatePartyGarageGate(room) {
  const boardState = ensurePartyBoardState(room)
  const gates = BOOSTSTONE_RUINS.gates || []
  if (!gates.length) return null
  const currentIndex = Math.max(0, gates.findIndex((gate) => gate.id === boardState.closedGarageGateId))
  const nextGate = gates[(currentIndex + 1) % gates.length]
  boardState.closedGarageGateId = nextGate.id
  return nextGate
}

function getPartySupplyCrateChoices(seed = 0) {
  const pool = [...PARTY_SUPPLY_CRATE_REWARDS]
  const choices = []
  for (let index = 0; index < 3 && pool.length; index += 1) {
    const value = shiftedPartySeed(seed, 71 + index)
    const pickIndex = Math.min(pool.length - 1, Math.floor(value * pool.length))
    choices.push(pool.splice(pickIndex, 1)[0])
  }
  return choices
}

function applyPartyEventLanding(room, turn, playerId, nodeId, seed = 0) {
  const node = BOARD_NODE_BY_ID[nodeId]
  const eventId = node?.special || ''
  const event = BOOSTSTONE_RUINS.boardEvents?.[eventId]
  const playerName = room.players?.[playerId]?.name || 'Player'
  const setup = room.playerSetup?.[playerId]
  const boardState = ensurePartyBoardState(room)
  const openHands = room.settings?.cardVisibility === 'open'

  let effect = {
    type: 'event',
    id: eventId || 'generic-event',
    name: event?.name || 'Ruins Event',
    resolved: true,
    publicMessage: '',
    privateMessage: '',
    affectedPlayerIds: [],
  }

  if (!setup) return effect

  if (eventId === 'supply-crates') {
    const choices = getPartySupplyCrateChoices(seed)
    effect = {
      ...effect,
      resolved: false,
      awaitingCrateChoice: true,
      crateCount: choices.length,
      crateRewardIds: choices.map((choice) => choice.id),
      publicMessage: `${playerName} found 3 Supply Crates and must choose one mystery crate.`,
      privateMessage: 'Choose Crate 1, 2, or 3. The reward stays hidden until you open it.',
    }
    turn.eventEffect = effect
    addPartyActivity(room, playerId, effect.publicMessage, 'event')
    return effect
  }

  if (eventId.startsWith('reactor-trigger-')) {
    const used = Boolean(boardState.usedBoardEvents[eventId])
    if (event?.oneUse && used) {
      effect.publicMessage = `${playerName} reached ${event.name}, but that reactor has already discharged this game.`
      effect.privateMessage = effect.publicMessage
    } else {
      boardState.usedBoardEvents[eventId] = true
      const affectedNodes = Array.isArray(event?.affectedNodes) ? event.affectedNodes : []
      const resetTo = event?.resetTo || BOOSTSTONE_RUINS.startId
      const affectedIds = []
      for (const id of orderedPlayerIds(room)) {
        const playerSetup = room.playerSetup?.[id]
        if (!playerSetup || !affectedNodes.includes(playerSetup.boardNodeId)) continue
        playerSetup.boardNodeId = resetTo
        affectedIds.push(id)
      }
      effect.affectedPlayerIds = affectedIds
      effect.resetTo = resetTo
      const names = affectedIds.map((id) => room.players?.[id]?.name || 'Player')
      effect.publicMessage = names.length
        ? `${event.name} fired! ${names.join(', ')} ${names.length === 1 ? 'was' : 'were'} knocked back to Space ${partyNodeNumber(resetTo)}.`
        : `${event.name} fired, but nobody was caught in that reactor lane.`
      effect.privateMessage = effect.publicMessage
    }
  } else if (eventId.startsWith('gate-switch-')) {
    const nextGate = rotatePartyGarageGate(room)
    effect.closedGarageGateId = nextGate?.id || ''
    const gateName = nextGate?.id?.includes('west') ? 'West Garage Gate' : 'Center Garage Gate'
    effect.publicMessage = nextGate
      ? `${playerName} hit the Garage Gate Switch. ${gateName} is now CLOSED and costs ${nextGate.toll || 3} Tokens to pass; the other gate is open.`
      : `${playerName} hit the Garage Gate Switch, but no Garage Gate was available.`
    effect.privateMessage = effect.publicMessage
  } else if (eventId === 'ancient-boost-cache') {
    setup.tokens = Math.max(0, Number(setup.tokens) || 0) + 3
    effect.tokenChange = 3
    effect.publicMessage = `${playerName} opened the Ancient Boost Cache and gained +3 Tokens.`
    effect.privateMessage = effect.publicMessage
  } else {
    setup.tokens = Math.max(0, Number(setup.tokens) || 0) + 2
    effect.tokenChange = 2
    effect.publicMessage = `${playerName} triggered a Ruins Event and gained +2 Tokens.`
    effect.privateMessage = effect.publicMessage
  }

  turn.eventEffect = effect
  addPartyActivity(room, playerId, effect.publicMessage, 'event')
  return effect
}

export async function resolvePartySupplyCrate(roomCode, playerId, crateIndex) {
  requireOnlineIdentity(playerId)
  const code = normalizeCode(roomCode)
  const roomRef = ref(db, `securePartyRooms/${code}`)
  let failureReason = ''

  const result = await runTransaction(roomRef, (room) => {
    if (!room) {
      failureReason = 'Party room not found.'
      return
    }

    const order = orderedPlayerIds(room)
    const activePlayerId = order[room.turnIndex || 0]
    const turn = room.turnState
    const effect = turn?.eventEffect

    if (room.status !== 'playing' || room.phase !== 'board' || activePlayerId !== playerId || turn?.playerId !== playerId) {
      failureReason = 'The Supply Crate cannot be opened right now.'
      return
    }
    if (!effect || effect.id !== 'supply-crates' || effect.resolved || !effect.awaitingCrateChoice) {
      failureReason = 'There is no Supply Crate choice waiting.'
      return
    }

    const index = Number(crateIndex)
    const rewardId = effect.crateRewardIds?.[index]
    const reward = PARTY_SUPPLY_CRATE_REWARDS.find((item) => item.id === rewardId)
    if (!reward) {
      failureReason = 'Choose one of the three Supply Crates.'
      return
    }

    const setup = room.playerSetup?.[playerId]
    const playerName = room.players?.[playerId]?.name || 'Player'
    const openHands = room.settings?.cardVisibility === 'open'
    let message = ''
    let privateMessage = ''

    if (reward.kind === 'tokens') {
      setup.tokens = Math.max(0, Number(setup.tokens) || 0) + reward.amount
      effect.tokenChange = reward.amount
      message = `${playerName} opened Crate ${index + 1} and found +${reward.amount} Tokens.`
      privateMessage = message
    } else if (reward.kind === 'card') {
      const card = getPartyCard(reward.cardId)
      const cards = normalizePartyCards(setup.cards)
      if (card && cards.length < 3) {
        cards.push(card.id)
        setup.cards = cards
        effect.cardId = card.id
        message = openHands
          ? `${playerName} opened Crate ${index + 1} and found ${card.name}.`
          : `${playerName} opened Crate ${index + 1} and found an Action Card.`
        privateMessage = `${playerName} opened Crate ${index + 1} and found ${card.name}.`
      } else {
        setup.tokens = Math.max(0, Number(setup.tokens) || 0) + 2
        effect.tokenChange = 2
        message = `${playerName}'s Card inventory was full, so Crate ${index + 1} converted into +2 Tokens.`
        privateMessage = card
          ? `${card.name} could not fit in your inventory, so it converted into +2 Tokens.`
          : message
      }
    }

    effect.resolved = true
    effect.awaitingCrateChoice = false
    effect.selectedCrateIndex = index
    effect.rewardId = reward.id
    effect.rewardName = reward.name
    effect.publicMessage = message
    effect.privateMessage = privateMessage || message
    delete effect.crateRewardIds
    turn.eventEffect = effect
    room.turnState = turn
    addPartyActivity(room, playerId, message, 'event')
    return room
  })

  if (!result.committed) throw new Error(failureReason || 'Could not open that Supply Crate.')
}

function finishLanding(room, turn, playerId, nodeId, mechanic, card, battleOptions = {}) {
  turn.readyToEnd = true
  turn.landedNodeId = nodeId
  turn.landedType = BOARD_NODE_BY_ID[nodeId]?.type || 'Space'
  delete turn.spaceEffect
  delete turn.eventEffect

  const landedNode = BOARD_NODE_BY_ID[nodeId]
  const setup = room.playerSetup?.[playerId]
  const hasJackpot = normalizePartyCards(setup?.cards).includes('jackpot')

  if (landedNode?.type === 'Event') {
    delete turn.awaitingJackpotDecision
    delete turn.landingEffect
    addLandingActivity(room, playerId, nodeId)
    applyPartyEventLanding(room, turn, playerId, nodeId, battleOptions.eventSeed ?? battleOptions.spaceOutcomeSeed)
    return
  }

  if (landedNode?.type === 'Lucky' || landedNode?.type === 'Bad Luck') {
    delete turn.awaitingJackpotDecision
    delete turn.landingEffect
    addLandingActivity(room, playerId, nodeId)
    applyPartyLuckLanding(
      room,
      turn,
      playerId,
      landedNode.type,
      battleOptions.spaceOutcomeSeed,
      card
    )
    return
  }

  if (landedNode?.type === 'Battle') {
    delete turn.awaitingJackpotDecision
    delete turn.landingEffect
    startPartyBattle(room, turn, playerId, 'battle-space', battleOptions)
    addLandingActivity(room, playerId, nodeId)
    return
  }

  // Jackpot is offered only after the player lands on a normal Mechanic Space,
  // but before the actual Mechanic is generated/revealed. Declining keeps the
  // Card. Accepting consumes it before the challenge becomes visible.
  if (
    landedNode?.type === 'Mechanic' &&
    hasJackpot &&
    !turn.cardUsedThisTurn
  ) {
    turn.awaitingJackpotDecision = true
    delete turn.landingEffect
  } else {
    delete turn.awaitingJackpotDecision
    attachLandingEffect(room, turn, playerId, nodeId, mechanic)
  }

  addLandingActivity(room, playerId, nodeId)
  applyCardLanding(room, turn, playerId, card)

  const effect = turn.landingEffect
  if (effect) {
    const cardVisibility = room.settings?.cardVisibility === 'open' ? 'open' : 'hidden'
    const modifiers = []

    if (cardVisibility === 'open') {
      if (effect.pressureTriggered) modifiers.push('Pressure: 1 attempt only')
      if (effect.noBounceRequired) modifiers.push('Zero Bounce: no bounce')
      if (effect.kph100Required) modifiers.push('100+ KPH: 100+ KPH required')
      if (effect.topCornerRequired) modifiers.push('Top Corner: top corner required')
      if (effect.hotStreakTriggered) modifiers.push('Hot Streak: 1 attempt, +2 Tokens on success')
      if (effect.jackpotTriggered) modifiers.push('Jackpot: 2× payout on success / lose the normal payout on failure')
    } else {
      if (effect.pressureTriggered) modifiers.push('1 attempt only')
      if (effect.noBounceRequired) modifiers.push('no bounce')
      if (effect.kph100Required) modifiers.push('100+ KPH')
      if (effect.topCornerRequired) modifiers.push('top corner')
      if (effect.hotStreakTriggered) modifiers.push('1 attempt, +2 bonus Tokens on success')
      if (effect.jackpotTriggered) modifiers.push('2× payout on success / lose the normal payout on failure')
    }

    if (modifiers.length) {
      const playerName = room.players?.[playerId]?.name || 'Player'
      addPartyActivity(
        room,
        playerId,
        cardVisibility === 'open'
          ? `${playerName}'s Mechanic has Card effects active: ${modifiers.join(', ')}.`
          : `${playerName}'s Mechanic has special Card effects: ${modifiers.join(', ')}.`,
        'card'
      )
    }
  }
}

function normalizeCode(roomCode) {
  return normalizeRoomCode(roomCode)
}

function orderedPlayerIds(room) {
  if (Array.isArray(room.playerOrder)) return room.playerOrder.filter(Boolean)
  if (room.playerOrder) return Object.values(room.playerOrder).filter(Boolean)

  return Object.values(room.players || {})
    .sort((first, second) => (first.joinedAt || 0) - (second.joinedAt || 0))
    .map((player) => player.id)
}

function makeTurnState(playerId) {
  return {
    playerId,
    rolled: false,
    movementRemaining: 0,
    awaitingChoice: false,
    readyToEnd: false,
  }
}

export async function createPartyRoom(playerName) {
  requireOnlineIdentity()
  const playerId = requireOnlineIdentity()
  playerName = cleanPlayerName(playerName)
  const roomCode = randomRoomCode()

  await set(ref(db, `securePartyRooms/${roomCode}`), {
    mode: 'party',
    status: 'lobby',
    hostId: playerId,
    seats: { 0: playerId },
    createdAt: Date.now(),
    settings: {
      mapId: PARTY_MAP_ID,
      rounds: 10,
      trophyPrice: 10,
      cardVisibility: 'hidden',
    },
    players: {
      [playerId]: {
        id: playerId,
        name: playerName,
        joinedAt: Date.now(),
        carId: null,
      },
    },
  })

  return roomCode
}

export async function joinPartyRoom(roomCode, playerName) {
  return joinProtectedRoom('securePartyRooms', normalizeRoomCode(roomCode), playerName)
}

export function listenToPartyRoom(roomCode, callback) {
  const code = normalizeCode(roomCode)

  return onValue(ref(db, `securePartyRooms/${code}`), (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() : null)
  }, () => callback(null))
}

export async function updatePartyRounds(roomCode, requesterId, rounds) {
  requireOnlineIdentity(requesterId)
  const code = normalizeCode(roomCode)

  if (!PARTY_ROUNDS.includes(rounds)) {
    throw new Error('Rounds must be 10, 15, or 20.')
  }

  const roomRef = ref(db, `securePartyRooms/${code}`)
  const snapshot = await get(roomRef)

  if (!snapshot.exists()) {
    throw new Error('Party room not found.')
  }

  const room = snapshot.val()

  if (room.hostId !== requesterId) {
    throw new Error('Only the host can change Party settings.')
  }

  if (room.status !== 'lobby') {
    throw new Error('Party settings cannot be changed after the game starts.')
  }

  await update(ref(db, `securePartyRooms/${code}/settings`), {
    rounds,
  })
}

export async function updatePartyCardVisibility(roomCode, requesterId, visibility) {
  requireOnlineIdentity(requesterId)
  const code = normalizeCode(roomCode)
  const nextVisibility = visibility === 'open' ? 'open' : visibility === 'hidden' ? 'hidden' : ''

  if (!nextVisibility) {
    throw new Error('Card visibility must be Hidden Hands or Open Hands.')
  }

  const roomRef = ref(db, `securePartyRooms/${code}`)
  const snapshot = await get(roomRef)

  if (!snapshot.exists()) {
    throw new Error('Party room not found.')
  }

  const room = snapshot.val()

  if (room.hostId !== requesterId) {
    throw new Error('Only the host can change Party settings.')
  }

  if (room.status !== 'lobby') {
    throw new Error('Party settings cannot be changed after the game starts.')
  }

  await update(ref(db, `securePartyRooms/${code}/settings`), {
    cardVisibility: nextVisibility,
  })
}

export async function selectPartyCar(roomCode, playerId, carId) {
  requireOnlineIdentity(playerId)
  requireOnlineIdentity(playerId)
  const code = normalizeCode(roomCode)
  if (!getPartyCar(carId)) throw new Error('Choose a valid car.')
  const snapshot = await get(ref(db, `securePartyRooms/${code}`))
  const room = snapshot.val()
  if (!room || room.status !== 'lobby') throw new Error('Car selection is closed.')
  if (Object.values(room.players || {}).some((p) => p.id !== playerId && p.carId === carId)) {
    throw new Error('Another player already selected that car.')
  }
  await set(ref(db, `securePartyRooms/${code}/players/${playerId}/carId`), carId)
}

export async function clearPartyCarSelection(roomCode, playerId) {
  requireOnlineIdentity(playerId)
  const code = normalizeCode(roomCode)
  const playerRef = ref(db, `securePartyRooms/${code}/players/${playerId}/carId`)
  await set(playerRef, null)
}

export async function startPartyRoom(roomCode, requesterId) {
  requireOnlineIdentity(requesterId)
  const code = normalizeCode(roomCode)
  const roomRef = ref(db, `securePartyRooms/${code}`)
  const snapshot = await get(roomRef)

  if (!snapshot.exists()) {
    throw new Error('Party room not found.')
  }

  const room = snapshot.val()

  if (room.hostId !== requesterId) {
    throw new Error('Only the host can start the Party game.')
  }

  if (room.status !== 'lobby') {
    throw new Error('This Party game has already started.')
  }

  const players = room.players ? Object.values(room.players) : []

  if (players.length < 2 || players.length > 4) {
    throw new Error('Party Mode requires 2–4 players.')
  }

  if (players.some((player) => !player.carId)) {
    throw new Error('Every player must choose a car before the Party starts.')
  }

  const selectedCars = players.map((player) => player.carId)
  if (new Set(selectedCars).size !== selectedCars.length) {
    throw new Error('Each player must use a different car.')
  }

  const rounds = room.settings?.rounds ?? 10

  if (!PARTY_ROUNDS.includes(rounds)) {
    throw new Error('Choose 10, 15, or 20 rounds before starting.')
  }

  const orderedPlayers = [...players].sort(
    (first, second) => (first.joinedAt || 0) - (second.joinedAt || 0)
  )

  const playerOrder = orderedPlayers.map((player) => player.id)

  const playerSetup = Object.fromEntries(
    orderedPlayers.map((player) => [
      player.id,
      {
        tokens: 10,
        trophies: 0,
        boardNodeId: BOOSTSTONE_RUINS.startId,
        cards: [],
      },
    ])
  )

  const activeTrophyNodeId = pickTrophySpot()

  await update(roomRef, {
    status: 'playing',
    startedAt: Date.now(),
    currentRound: 1,
    turnIndex: 0,
    turnDirection: 1,
    roundTakenPlayerIds: [],
    phase: 'turn-order',
    playerOrder,
    turnOrderRolls: {},
    playerSetup,
    activeTrophyNodeId,
    boardState: {
      closedGarageGateId: BOOSTSTONE_RUINS.gates?.[0]?.id || '',
      usedBoardEvents: {},
    },
    temporaryTrophyPriceMultiplier: null,
    temporaryTrophyPriceUntil: null,
    activitySeq: 1,
    activityFeed: {
      a0001: {
        seq: 1,
        playerId: '',
        message: 'Party started on Booststone Ruins. Roll for turn order on the starting deck.',
        type: 'system',
        createdAt: Date.now(),
      },
    },
    turnState: null,
  })
}

export async function rollPartyTurnOrder(roomCode, playerId) {
  requireOnlineIdentity(playerId)
  const code = normalizeCode(roomCode)
  const roomRef = ref(db, `securePartyRooms/${code}`)
  const rollSeed = Math.random()
  let failureReason = ''

  const result = await runTransaction(roomRef, (room) => {
    if (!room) {
      failureReason = 'Party room not found.'
      return
    }

    if (room.status !== 'playing' || room.phase !== 'turn-order') {
      failureReason = 'Turn order has already been decided.'
      return
    }

    if (!room.players?.[playerId]) {
      failureReason = 'You are no longer in this Party game.'
      return
    }

    if (!room.turnOrderRolls || typeof room.turnOrderRolls !== 'object') {
      room.turnOrderRolls = {}
    }

    if (Number(room.turnOrderRolls[playerId]) > 0) {
      failureReason = 'You already rolled for turn order.'
      return
    }

    const usedRolls = new Set(
      Object.values(room.turnOrderRolls)
        .map((value) => Number(value))
        .filter((value) => value >= 1 && value <= 6)
    )
    const availableRolls = [1, 2, 3, 4, 5, 6].filter((value) => !usedRolls.has(value))

    if (!availableRolls.length) {
      failureReason = 'No unique turn-order rolls are available.'
      return
    }

    const rollIndex = Math.min(availableRolls.length - 1, Math.floor(rollSeed * availableRolls.length))
    const roll = availableRolls[rollIndex]
    room.turnOrderRolls[playerId] = roll

    const playerName = room.players[playerId]?.name || 'Player'
    addPartyActivity(room, playerId, `${playerName} rolled a ${roll} for turn order.`, 'roll')

    const playerIds = Object.keys(room.players || {})
    const everyoneRolled = playerIds.every((id) => Number(room.turnOrderRolls[id]) > 0)

    if (everyoneRolled) {
      const finalOrder = [...playerIds].sort((firstId, secondId) => {
        const rollDifference = Number(room.turnOrderRolls[secondId]) - Number(room.turnOrderRolls[firstId])
        if (rollDifference !== 0) return rollDifference
        return (room.players[firstId]?.joinedAt || 0) - (room.players[secondId]?.joinedAt || 0)
      })

      room.playerOrder = finalOrder
      room.turnIndex = 0
      room.turnDirection = 1
      room.roundTakenPlayerIds = []
      room.phase = 'board'
      room.turnState = makeTurnState(finalOrder[0])

      const orderText = finalOrder
        .map((id, index) => `${index + 1}. ${room.players[id]?.name || 'Player'} (${room.turnOrderRolls[id]})`)
        .join(' • ')
      addPartyActivity(room, '', `Turn order locked: ${orderText}`, 'system')
    }

    return room
  })

  if (!result.committed) {
    throw new Error(failureReason || 'Could not roll for turn order. Try again.')
  }
}

export async function rollPartyDie(roomCode, playerId, dieType) {
  requireOnlineIdentity(playerId)
  const code = normalizeCode(roomCode)
  const roomRef = ref(db, `securePartyRooms/${code}`)
  const randomFaceIndex = Math.floor(Math.random() * 6)
  const normalRoll = randomFaceIndex + 1
  let failureReason = ''

  const result = await runTransaction(roomRef, (room) => {
    if (!room) {
      failureReason = 'Party room not found.'
      return
    }

    if (room.status !== 'playing' || room.phase !== 'board') {
      failureReason = 'Dice can only be rolled during the board phase.'
      return
    }

    const order = orderedPlayerIds(room)
    const activePlayerId = order[room.turnIndex || 0]

    if (activePlayerId !== playerId || room.turnState?.playerId !== playerId) {
      failureReason = 'It is not your turn.'
      return
    }

    if (room.turnState?.battle && room.turnState.battle.status === 'active') {
      failureReason = 'Resolve the current Battle before rolling.'
      return
    }

    if (room.turnState?.rolled) {
      failureReason = 'You already rolled this turn.'
      return
    }

    if (dieType !== 'normal' && dieType !== 'special') {
      failureReason = 'Choose the normal die or your special die.'
      return
    }

    let face = normalRoll
    let movement = normalRoll
    let tokenChange = 0
    let selectedCar = null

    if (dieType === 'special') {
      selectedCar = getPartyCar(room.players?.[playerId]?.carId)

      const car = selectedCar

      if (!car) {
        failureReason = 'Your selected car could not be found.'
        return
      }

      face = car.specialDie[randomFaceIndex]

      if (typeof face === 'number') {
        movement = face
      } else if (face?.type === 'tokens') {
        movement = 0
        tokenChange = face.value
      } else {
        failureReason = 'That die face is not valid.'
        return
      }
    }

    const setup = room.playerSetup?.[playerId]
    if (!setup) {
      failureReason = 'Your board position could not be found.'
      return
    }

    if (tokenChange !== 0) {
      setup.tokens = Math.max(0, (setup.tokens || 0) + tokenChange)
    }

    const previousTurn = room.turnState || makeTurnState(playerId)
    const movementBonus = Math.max(0, Number(previousTurn.pendingMovementBonus) || 0)
    const totalMovement = Math.max(0, movement + movementBonus)

    room.turnState = {
      ...previousTurn,
      playerId,
      rolled: true,
      dieType,
      faceLabel: formatPartyDieFace(face),
      baseMovement: movement,
      movementRemaining: totalMovement,
      movementStarted: false,
      awaitingChoice: false,
      readyToEnd: totalMovement === 0,
    }

    if (room.turnState.battle?.status === 'resolved' && room.turnState.battle.source === 'challenge-glove') {
      delete room.turnState.battle
    }

    if (movementBonus > 0) {
      room.turnState.movementBonusApplied = movementBonus
    } else {
      delete room.turnState.movementBonusApplied
    }
    delete room.turnState.pendingMovementBonus

    if (tokenChange !== 0) {
      room.turnState.tokenChange = tokenChange
    } else {
      delete room.turnState.tokenChange
    }

    delete room.turnState.landedNodeId
    delete room.turnState.landedType
    delete room.turnState.landingEffect
    delete room.turnState.spaceEffect

    if (totalMovement === 0) {
      room.turnState.landedNodeId = setup.boardNodeId || BOOSTSTONE_RUINS.startId
      room.turnState.landedType = BOARD_NODE_BY_ID[room.turnState.landedNodeId]?.type || 'Space'
    }

    const playerName = room.players?.[playerId]?.name || 'Player'
    const dieName = dieType === 'normal'
      ? 'Normal Die'
      : `${selectedCar?.name || 'Special'} Special Die`
    addPartyActivity(
      room,
      playerId,
      movementBonus > 0
        ? `${playerName} rolled ${formatPartyDieFace(face)} with the ${dieName} and has ${totalMovement} total movement after a +${movementBonus} Card boost.`
        : `${playerName} rolled ${formatPartyDieFace(face)} with the ${dieName}.`,
      'roll'
    )

    return room
  })

  if (!result.committed) {
    throw new Error(failureReason || 'Could not roll the die. Try again.')
  }
}

export async function continuePartyMovement(roomCode, playerId, chosenNextId = '') {
  requireOnlineIdentity(playerId)
  const code = normalizeCode(roomCode)
  const roomRef = ref(db, `securePartyRooms/${code}`)
  const landingMechanic = pickPartyMechanic()
  const landingCard = pickPartyCard()
  const landingBattleMechanic = pickPartyMechanic()
  const landingBattleSeed = Math.random()
  const landingOpponentSeed = Math.random()
  const landingSpaceOutcomeSeed = Math.random()
  let failureReason = ''

  const result = await runTransaction(roomRef, (room) => {
    if (!room) {
      failureReason = 'Party room not found.'
      return
    }

    if (room.status !== 'playing' || room.phase !== 'board') {
      failureReason = 'Movement is not active right now.'
      return
    }

    const order = orderedPlayerIds(room)
    const activePlayerId = order[room.turnIndex || 0]
    const turn = room.turnState

    if (activePlayerId !== playerId || turn?.playerId !== playerId) {
      failureReason = 'It is not your turn.'
      return
    }

    if (turn?.battle && turn.battle.status === 'active') {
      failureReason = 'Resolve the current Battle before continuing movement.'
      return
    }

    if (turn?.awaitingTrophy) {
      failureReason = 'Choose whether to buy the Trophy before continuing.'
      return
    }

    if (turn?.awaitingGate) {
      failureReason = 'Choose whether to pay the Garage Gate toll before continuing.'
      return
    }

    if (!turn?.rolled || turn.readyToEnd || (turn.movementRemaining || 0) <= 0) {
      failureReason = 'There is no movement left to complete.'
      return
    }

    const setup = room.playerSetup?.[playerId]
    if (!setup) {
      failureReason = 'Your board position could not be found.'
      return
    }

    turn.movementStarted = true

    let currentNodeId = setup.boardNodeId || BOOSTSTONE_RUINS.startId
    let remaining = turn.movementRemaining || 0
    let choiceUsed = false

    while (remaining > 0) {
      const currentNode = BOARD_NODE_BY_ID[currentNodeId]
      const options = currentNode?.next || []

      if (options.length === 0) {
        remaining = 0
        break
      }

      let nextId

      if (options.length > 1) {
        if (!chosenNextId || choiceUsed) {
          turn.awaitingChoice = true
          turn.choiceNodeId = currentNodeId
          turn.choices = options
          break
        }

        if (!options.includes(chosenNextId)) {
          failureReason = 'That route is not available from this junction.'
          return
        }

        nextId = chosenNextId
        choiceUsed = true
      } else {
        nextId = options[0]
      }

      const closedGate = getPartyClosedGateForEdge(room, currentNodeId, nextId)
      const gateEdgeKey = partyGateEdgeKey(currentNodeId, nextId)
      if (closedGate && turn.gatePassApproved !== gateEdgeKey) {
        turn.awaitingGate = true
        turn.gateId = closedGate.id
        turn.gateFromNodeId = currentNodeId
        turn.gateToNodeId = nextId
        turn.gateToll = Number(closedGate.toll) || 3
        break
      }
      if (turn.gatePassApproved === gateEdgeKey) delete turn.gatePassApproved

      currentNodeId = nextId
      remaining -= 1

      if (currentNodeId === room.activeTrophyNodeId) {
        turn.awaitingChoice = false
        delete turn.choiceNodeId
        delete turn.choices
        turn.awaitingTrophy = true
        turn.trophyNodeId = currentNodeId
        turn.trophyPrice = getPartyEffectiveTrophyPrice(room)
        break
      }

      if (remaining > 0) {
        const nextNode = BOARD_NODE_BY_ID[currentNodeId]
        if ((nextNode?.next || []).length > 1) {
          turn.awaitingChoice = true
          turn.choiceNodeId = currentNodeId
          turn.choices = nextNode.next
          break
        }
      }
    }

    setup.boardNodeId = currentNodeId
    turn.movementRemaining = remaining

    if (remaining === 0 && !turn.awaitingTrophy) {
      turn.awaitingChoice = false
      delete turn.choiceNodeId
      delete turn.choices
      finishLanding(room, turn, playerId, currentNodeId, landingMechanic, landingCard, { battleSeed: landingBattleSeed, opponentSeed: landingOpponentSeed, battleMechanic: landingBattleMechanic, spaceOutcomeSeed: landingSpaceOutcomeSeed })
    }

    room.turnState = turn
    return room
  })

  if (!result.committed) {
    throw new Error(failureReason || 'Could not move your car. Try again.')
  }
}


export async function resolvePartyGarageGate(roomCode, playerId, payToll) {
  requireOnlineIdentity(playerId)
  const code = normalizeCode(roomCode)
  const roomRef = ref(db, `securePartyRooms/${code}`)
  const landingMechanic = pickPartyMechanic()
  const landingCard = pickPartyCard()
  const landingBattleMechanic = pickPartyMechanic()
  const landingBattleSeed = Math.random()
  const landingOpponentSeed = Math.random()
  const landingSpaceOutcomeSeed = Math.random()
  const landingEventSeed = Math.random()
  let failureReason = ''

  const result = await runTransaction(roomRef, (room) => {
    if (!room) {
      failureReason = 'Party room not found.'
      return
    }

    const order = orderedPlayerIds(room)
    const activePlayerId = order[room.turnIndex || 0]
    const turn = room.turnState
    const setup = room.playerSetup?.[playerId]

    if (room.status !== 'playing' || room.phase !== 'board' || activePlayerId !== playerId || turn?.playerId !== playerId) {
      failureReason = 'The Garage Gate cannot be resolved right now.'
      return
    }
    if (!turn.awaitingGate || !turn.gateId || !turn.gateFromNodeId || !turn.gateToNodeId) {
      failureReason = 'There is no Garage Gate toll waiting.'
      return
    }
    if (!setup) {
      failureReason = 'Your board position could not be found.'
      return
    }

    const toll = Math.max(0, Number(turn.gateToll) || 3)
    const playerName = room.players?.[playerId]?.name || 'Player'

    if (payToll) {
      if ((Number(setup.tokens) || 0) < toll) {
        failureReason = `You need ${toll} Tokens to pass the closed Garage Gate.`
        return
      }
      setup.tokens = Math.max(0, (Number(setup.tokens) || 0) - toll)
      turn.gatePassApproved = partyGateEdgeKey(turn.gateFromNodeId, turn.gateToNodeId)
      delete turn.awaitingGate
      delete turn.gateId
      delete turn.gateFromNodeId
      delete turn.gateToNodeId
      delete turn.gateToll
      addPartyActivity(room, playerId, `${playerName} paid ${toll} Tokens to pass the closed Garage Gate.`, 'event')
    } else {
      const stopNodeId = setup.boardNodeId || turn.gateFromNodeId
      turn.movementRemaining = 0
      delete turn.awaitingGate
      delete turn.gateId
      delete turn.gateFromNodeId
      delete turn.gateToNodeId
      delete turn.gateToll
      delete turn.gatePassApproved
      addPartyActivity(room, playerId, `${playerName} did not pay the Garage Gate toll and stopped at Space ${partyNodeNumber(stopNodeId)}.`, 'event')
      finishLanding(room, turn, playerId, stopNodeId, landingMechanic, landingCard, {
        battleSeed: landingBattleSeed,
        opponentSeed: landingOpponentSeed,
        battleMechanic: landingBattleMechanic,
        spaceOutcomeSeed: landingSpaceOutcomeSeed,
        eventSeed: landingEventSeed,
      })
    }

    room.turnState = turn
    return room
  })

  if (!result.committed) throw new Error(failureReason || 'Could not resolve the Garage Gate.')
}

export async function resolvePartyTrophyPass(roomCode, playerId, buyTrophy) {
  requireOnlineIdentity(playerId)
  const code = normalizeCode(roomCode)
  const roomRef = ref(db, `securePartyRooms/${code}`)
  const nextTrophySpot = pickTrophySpot()
  const landingMechanic = pickPartyMechanic()
  const landingCard = pickPartyCard()
  const landingBattleMechanic = pickPartyMechanic()
  const landingBattleSeed = Math.random()
  const landingOpponentSeed = Math.random()
  const landingSpaceOutcomeSeed = Math.random()
  let failureReason = ''

  const result = await runTransaction(roomRef, (room) => {
    if (!room) {
      failureReason = 'Party room not found.'
      return
    }

    if (room.status !== 'playing' || room.phase !== 'board') {
      failureReason = 'The Trophy cannot be handled right now.'
      return
    }

    const order = orderedPlayerIds(room)
    const activePlayerId = order[room.turnIndex || 0]
    const turn = room.turnState

    if (activePlayerId !== playerId || turn?.playerId !== playerId) {
      failureReason = 'It is not your turn.'
      return
    }

    if (!turn?.awaitingTrophy) {
      failureReason = 'There is no Trophy decision waiting.'
      return
    }

    const setup = room.playerSetup?.[playerId]
    if (!setup) {
      failureReason = 'Your player data could not be found.'
      return
    }

    const trophyPrice = turn.trophyPrice ?? getPartyEffectiveTrophyPrice(room)

    if (buyTrophy) {
      if ((setup.tokens || 0) < trophyPrice) {
        failureReason = `You need ${trophyPrice} Tokens to buy this Trophy.`
        return
      }

      setup.tokens = Math.max(0, (setup.tokens || 0) - trophyPrice)
      setup.trophies = (setup.trophies || 0) + 1

      if (room.temporaryTrophyPriceUntil === 'next-trophy-purchase') {
        delete room.temporaryTrophyPriceMultiplier
        delete room.temporaryTrophyPriceUntil
      }

      const currentTrophy = room.activeTrophyNodeId
      const spots = BOOSTSTONE_RUINS.trophySpots || []
      let newTrophy = nextTrophySpot
      if (newTrophy === currentTrophy && spots.length > 1) {
        const currentIndex = spots.indexOf(currentTrophy)
        newTrophy = spots[(currentIndex + 1) % spots.length]
      }

      room.activeTrophyNodeId = newTrophy
      turn.trophyResult = 'bought'
      turn.trophyMessage = `Bought a Trophy for ${trophyPrice} Tokens.`
    } else {
      turn.trophyResult = 'skipped'
      turn.trophyMessage = 'Passed the Trophy without buying it.'
    }

    const playerName = room.players?.[playerId]?.name || 'Player'
    addPartyActivity(
      room,
      playerId,
      buyTrophy
        ? `${playerName} bought a Trophy for ${trophyPrice} Tokens!`
        : `${playerName} passed the Trophy.`,
      'trophy'
    )

    turn.awaitingTrophy = false
    delete turn.trophyNodeId
    delete turn.trophyPrice

    if (turn.trophyFromCardBeforeRoll) {
      // Golden Teleporter happens before the roll. After the Trophy decision,
      // the player still gets their normal die choice and full board turn.
      delete turn.trophyFromCardBeforeRoll
      turn.readyToEnd = false
      turn.rolled = false
      turn.movementRemaining = 0
      turn.movementStarted = false
    } else if ((turn.movementRemaining || 0) <= 0) {
      const landedNodeId = setup.boardNodeId || BOOSTSTONE_RUINS.startId
      finishLanding(room, turn, playerId, landedNodeId, landingMechanic, landingCard, { battleSeed: landingBattleSeed, opponentSeed: landingOpponentSeed, battleMechanic: landingBattleMechanic, spaceOutcomeSeed: landingSpaceOutcomeSeed })
    } else {
      turn.readyToEnd = false
    }

    room.turnState = turn
    return room
  })

  if (!result.committed) {
    throw new Error(failureReason || 'Could not resolve the Trophy decision.')
  }
}


export async function preparePartyCardDevTest(roomCode, requesterId, cardId) {
  requireOnlineIdentity(requesterId)
  const code = normalizeCode(roomCode)
  const roomRef = ref(db, `securePartyRooms/${code}`)
  const card = getPartyCard(cardId)
  const devMechanics = shuffledPartyMechanics()
  let failureReason = ''

  if (!card || card.enabled === false) {
    throw new Error(card?.comingSoon || 'That Card is not available for testing yet.')
  }

  const result = await runTransaction(roomRef, (room) => {
    if (!room) {
      failureReason = 'Party room not found.'
      return
    }

    if (room.hostId !== requesterId) {
      failureReason = 'Only the host can use the DEV Card Test Lab.'
      return
    }

    const order = orderedPlayerIds(room)
    const testerIndex = order.indexOf(requesterId)
    if (testerIndex === -1) {
      failureReason = 'The host is not an active player in this Party room.'
      return
    }

    const targetId = order.find((id) => id !== requesterId) || ''
    if (card.requiresTarget && !targetId) {
      failureReason = `${card.name} needs another player for its test setup.`
      return
    }

    if (!room.playerSetup || typeof room.playerSetup !== 'object') {
      room.playerSetup = {}
    }

    const testerNodeId = BOOSTSTONE_RUINS.nodes[2]?.id || BOOSTSTONE_RUINS.startId
    const targetNodeId = BOOSTSTONE_RUINS.nodes[Math.max(3, BOOSTSTONE_RUINS.nodes.length - 5)]?.id || BOOSTSTONE_RUINS.startId
    const mechanicNodeId = BOOSTSTONE_RUINS.nodes.find((node) => node.type === 'Mechanic')?.id || BOOSTSTONE_RUINS.startId
    const dangerNodeId = BOOSTSTONE_RUINS.nodes.find((node) => node.type === 'Danger Mechanic')?.id || mechanicNodeId

    const pickDevMechanic = (difficulty = '') => {
      if (difficulty) {
        const exact = devMechanics.find((mechanic) => getPartyMechanicDifficulty(mechanic) === difficulty)
        if (exact) return exact
      }
      return devMechanics[0] || pickPartyMechanic()
    }

    // Reset every player to a clean, predictable Card-testing state so old
    // status effects cannot make a test pass/fail for the wrong reason.
    for (const [index, playerId] of order.entries()) {
      const existing = room.playerSetup[playerId] || {}
      room.playerSetup[playerId] = {
        ...existing,
        tokens: 20,
        trophies: existing.trophies || 0,
        boardNodeId: index === testerIndex ? testerNodeId : targetNodeId,
        cards: [],
        shieldActive: false,
        doublePayout: false,
        hotStreakActive: false,
        pressureActive: false,
        noBounceActive: false,
        kph100Active: false,
        topCornerActive: false,
        lockoutActive: false,
      }

      const resetSetup = room.playerSetup[playerId]
      delete resetSetup.pressureSourcePlayerId
      delete resetSetup.noBounceSourcePlayerId
      delete resetSetup.kph100SourcePlayerId
      delete resetSetup.topCornerSourcePlayerId
      delete resetSetup.lockoutSourcePlayerId
      delete resetSetup.negativeCardResultNotice
      delete resetSetup.negativeCardResultNoticeAt
      delete resetSetup.shieldBlockNotice
      delete resetSetup.shieldBlockNoticeAt
    }

    const testerSetup = room.playerSetup[requesterId]
    const targetSetup = targetId ? room.playerSetup[targetId] : null
    const testerName = room.players?.[requesterId]?.name || 'Host'
    const targetName = targetId ? room.players?.[targetId]?.name || 'Player 2' : ''

    testerSetup.cards = [card.id]
    room.status = 'playing'
    room.phase = 'board'
    room.turnIndex = testerIndex
    room.turnDirection = 1
    room.roundTakenPlayerIds = []
    delete room.lastScoredMechanic
    delete room.devBattleTest
    delete room.devSpaceTest

    let turn = makeTurnState(requesterId)
    let instructions = `Use ${card.name} now and verify its result.`

    // Prepare any extra inventory/resources the specific Card requires.
    if (card.effect === 'token-steal' && targetSetup) {
      targetSetup.tokens = 12
      instructions = `Use Token Tornado on ${targetName}. They start with 12 Tokens, so exactly 4 should move to you.`
    } else if (card.effect === 'teleport-swap' && targetSetup) {
      testerSetup.boardNodeId = testerNodeId
      targetSetup.boardNodeId = targetNodeId
      instructions = `Use Teleport Pad on ${targetName}. Your two player markers start far apart and should swap positions.`
    } else if (card.effect === 'golden-teleporter') {
      testerSetup.tokens = 20
      const trophyChoices = (BOOSTSTONE_RUINS.trophySpots || []).filter((nodeId) => nodeId !== testerSetup.boardNodeId)
      if (trophyChoices.length) room.activeTrophyNodeId = trophyChoices[0]
      instructions = 'Use Golden Teleporter. You should move to exactly one space before the active Trophy, then still need to roll. A 0-movement roll should leave you short; any forward movement of at least 1 should reach the Trophy on the first step.'
    } else if (card.effect === 'shield' && targetSetup) {
      targetSetup.cards = ['token-tornado']
      instructions = `Arm Shield. ${targetName} already has Token Tornado for the follow-up: finish your turn, then use their Tornado on you and confirm Shield blocks it once.`
    } else if (card.effect === 'double-payout') {
      instructions = 'Arm Double Payout before rolling. It should wait for your next normal Mechanic. Make it to double the payout; miss it and the effect should disappear with no payout boost.'
    } else if (card.effect === 'steal-card' && targetSetup) {
      targetSetup.cards = ['boost-canister', 'golden-boost']
      const visibility = room.settings?.cardVisibility === 'open' ? 'open' : 'hidden'
      instructions = visibility === 'open'
        ? `Use Steal on ${targetName}. Their 2 Cards should be visible, and you should be able to choose exactly which one to steal.`
        : `Use Steal on ${targetName}. Their Card identities should stay hidden and one of the 2 Cards should be stolen randomly.`
    } else if (card.effect === 'swap-hands' && targetSetup) {
      testerSetup.cards = [card.id, 'boost-canister']
      targetSetup.cards = ['golden-boost', 'precision-dice']
      instructions = `Use Swap Hands on ${targetName}. After the Swap Hands card is consumed, you should receive their 2 Cards and they should receive your remaining Boost Canister.`
    } else if (card.effect === 'lockout' && targetSetup) {
      targetSetup.cards = ['boost-canister', 'golden-boost']
      const visibility = room.settings?.cardVisibility === 'open' ? 'open' : 'hidden'
      instructions = visibility === 'open'
        ? `Use Lockout on ${targetName}. Open Hands should show that Lockout is armed. On their next Card attempt, let them choose Boost Canister or Golden Boost to sacrifice: that Card should be discarded with no effect, then Lockout should disappear.`
        : `Use Lockout on ${targetName}. Hidden Hands should NOT warn them that Lockout is armed. When they next try Boost Canister or Golden Boost, that attempted Card should be discarded with no effect; only then should Lockout be revealed and removed.`
    } else if (card.effect === 'clean-slate') {
      testerSetup.cards = [card.id, 'boost-canister', 'shield']
      instructions = 'Use Clean Slate. Your full 3-Card hand should be replaced by 3 fresh random Cards.'
    } else if (card.effect === 'pressure' && targetSetup) {
      instructions = `Use Pressure on ${targetName}. It should stay secret until their next Mechanic, which should show a 1-attempt limit.`
    } else if (card.effect === 'zero-bounce' && targetSetup) {
      instructions = `Use Zero Bounce on ${targetName}. It should stay secret until their next Mechanic, which should require no bounce.`
    } else if (card.effect === '100-kph' && targetSetup) {
      instructions = `Use 100+ KPH on ${targetName}. It should stay secret until their next Mechanic, which should require 100+ KPH.`
    } else if (card.effect === 'top-corner' && targetSetup) {
      instructions = `Use Top Corner on ${targetName}. It should stay secret until their next Mechanic, which should require a top-corner finish.`
    } else if (card.effect === 'challenge-glove' && targetSetup) {
      instructions = `Use Challenge Glove on ${targetName}. A random 1v1 Battle should be revealed only after the opponent is locked in. Resolve the Battle, then confirm you can still roll normally afterward.`
    } else if (card.effect === 'reverse-turn-order') {
      instructions = 'Use Reverse before rolling. Turn direction should change from Normal to Reversed and stay that way until another Reverse is used.'
    } else if (card.effect === 'movement-boost') {
      instructions = `Use ${card.name}, then roll. The final movement should be the die movement plus ${card.amount || 0}.`
    } else if (card.effect === 'precision-die') {
      instructions = 'Use Precision Dice and choose any value 1–6. That exact number should become your movement without a random roll.'
    } else if (card.effect === 'jackpot') {
      testerSetup.boardNodeId = mechanicNodeId
      turn = {
        ...makeTurnState(requesterId),
        rolled: true,
        dieType: 'dev',
        faceLabel: 'DEV',
        baseMovement: 0,
        movementRemaining: 0,
        movementStarted: true,
        readyToEnd: true,
        landedNodeId: mechanicNodeId,
        landedType: 'Mechanic',
        awaitingJackpotDecision: true,
      }
      instructions = 'You have landed on a normal Mechanic, but the challenge is still hidden. Choose whether to use Jackpot before the Mechanic is revealed. Yes should consume Jackpot and make the revealed Mechanic 2× payout on success / lose its normal would-be payout on failure. No should keep Jackpot and reveal the Mechanic normally.'
    }

    // Cards used after landing on a Mechanic get placed directly at the exact
    // timing window where their Use button should become legal.
    if (card.timing === 'before-mechanic-attempt') {
      let requestedDifficulty = 'Medium'
      if (card.effect === 'difficulty-spike') requestedDifficulty = 'Medium'
      if (card.effect === 'difficulty-drop') requestedDifficulty = 'Hard'

      const mechanic = pickDevMechanic(requestedDifficulty)
      if (!mechanic) {
        failureReason = 'Could not prepare a DEV Mechanic challenge.'
        return
      }

      testerSetup.boardNodeId = mechanicNodeId
      const effect = makeLandingEffect(room, mechanicNodeId, mechanic)
      effect.difficulty = requestedDifficulty || getPartyMechanicDifficulty(mechanic)

      turn = {
        ...makeTurnState(requesterId),
        rolled: true,
        dieType: 'dev',
        faceLabel: 'DEV',
        baseMovement: 0,
        movementRemaining: 0,
        movementStarted: true,
        readyToEnd: true,
        landedNodeId: mechanicNodeId,
        landedType: 'Mechanic',
        landingEffect: effect,
      }

      if (card.effect === 'copycat' && targetId) {
        const copied = pickDevMechanic('Hard') || mechanic
        room.lastScoredMechanic = {
          playerId: targetId,
          challengeId: copied.id,
          challengeName: copied.name,
          difficulty: getPartyMechanicDifficulty(copied),
        }
        instructions = `A normal Mechanic is waiting, and ${targetName} already has the latest completed Mechanic. Use Copycat and confirm your challenge changes to theirs.`
      } else if (card.effect === 'insurance') {
        instructions = 'A normal Mechanic is waiting before any attempt. Use Insurance, then miss both normal attempts; only after the second miss should Insurance award +1 Token.'
      } else if (card.effect === 'mechanic-reroll') {
        instructions = 'A Mechanic is waiting before any attempt. Use Reroll and confirm it changes to a different random Mechanic.'
      } else if (card.effect === 'pick-your-poison') {
        instructions = 'A Mechanic is waiting before any attempt. Use Pick Your Poison; two replacement Mechanics should appear and you must choose one.'
      } else if (card.effect === 'difficulty-spike') {
        instructions = 'A Medium Mechanic is waiting. Use Difficulty Spike; it should be replaced by a Hard Mechanic.'
      } else if (card.effect === 'difficulty-drop') {
        instructions = 'A Hard Mechanic is waiting. Use Difficulty Drop; it should be replaced by a Medium Mechanic.'
      } else if (card.effect === 'free-pass') {
        const expectedReward = effect.reward || PARTY_MECHANIC_REWARDS.Medium
        instructions = `A normal Mechanic is already revealed before Attempt 1. Use Free Pass: it should automatically complete the Mechanic without an attempt and award +${expectedReward} Tokens. Then confirm the Mechanic is recorded as completed.`
      }
    } else if (card.timing === 'after-failed-mechanic') {
      const mechanic = pickDevMechanic('Medium')
      if (!mechanic) {
        failureReason = 'Could not prepare a failed DEV Mechanic.'
        return
      }

      testerSetup.boardNodeId = dangerNodeId
      const effect = makeLandingEffect(room, dangerNodeId, mechanic)
      const devDangerPenalty = Number(effect?.penalty) || PARTY_DANGER_PENALTY
      testerSetup.tokens = Math.max(0, 20 - devDangerPenalty)
      effect.resolved = true
      effect.success = false
      effect.tokenChange = -devDangerPenalty
      effect.resultMessage = `DEV setup: failed Danger Mechanic and lost ${devDangerPenalty} Tokens.`

      turn = {
        ...makeTurnState(requesterId),
        rolled: true,
        dieType: 'dev',
        faceLabel: 'DEV',
        baseMovement: 0,
        movementRemaining: 0,
        movementStarted: true,
        readyToEnd: true,
        landedNodeId: dangerNodeId,
        landedType: 'Danger Mechanic',
        landingEffect: effect,
      }
      instructions = `A Danger Mechanic is already failed and ${devDangerPenalty} Tokens were removed. Use Mulligan: those ${devDangerPenalty} Tokens should be restored and the same challenge should reopen for one retry.`
    } else if (card.timing === 'after-successful-mechanic') {
      const mechanic = pickDevMechanic('Medium')
      if (!mechanic) {
        failureReason = 'Could not prepare a successful DEV Mechanic.'
        return
      }

      testerSetup.boardNodeId = mechanicNodeId
      const effect = makeLandingEffect(room, mechanicNodeId, mechanic)
      const devMechanicReward = Number(effect?.reward) || PARTY_MECHANIC_REWARDS.Medium
      testerSetup.tokens = 20 + devMechanicReward
      effect.resolved = true
      effect.success = true
      effect.tokenChange = devMechanicReward
      effect.resultMessage = `DEV setup: Mechanic completed for +${devMechanicReward} Tokens.`
      room.lastScoredMechanic = {
        playerId: requesterId,
        challengeId: mechanic.id,
        challengeName: mechanic.name,
        difficulty: getPartyMechanicDifficulty(mechanic),
      }

      turn = {
        ...makeTurnState(requesterId),
        rolled: true,
        dieType: 'dev',
        faceLabel: 'DEV',
        baseMovement: 0,
        movementRemaining: 0,
        movementStarted: true,
        readyToEnd: true,
        landedNodeId: mechanicNodeId,
        landedType: 'Mechanic',
        landingEffect: effect,
      }
      instructions = 'A normal Mechanic is already marked successful. Use Hot Streak now; it should arm the next Mechanic for 1 attempt and a +2 Token success bonus.'
    }

    room.turnState = turn
    room.devCardTest = {
      cardId: card.id,
      cardName: card.name,
      testerId: requesterId,
      targetId: targetId || '',
      instructions,
      preparedAt: Date.now(),
    }

    addPartyActivity(
      room,
      requesterId,
      `DEV prepared a ${card.name} test setup for ${testerName}.`,
      'system'
    )

    return room
  })

  if (!result.committed) {
    throw new Error(failureReason || 'Could not prepare that DEV Card test.')
  }
}

export async function usePartyCard(roomCode, playerId, cardIndex, options = {}) {
  requireOnlineIdentity(playerId)
  const code = normalizeCode(roomCode)
  const roomRef = ref(db, `securePartyRooms/${code}`)
  const randomSeed = Math.random()
  const battleSeed = Math.random()
  const battleMechanic = pickPartyMechanic()
  const cleanSlateDraws = Array.from({ length: 3 }, () => pickPartyCard().id)
  const mechanicCandidates = shuffledPartyMechanics()
  let failureReason = ''

  const result = await runTransaction(roomRef, (room) => {
    if (!room) {
      failureReason = 'Party room not found.'
      return
    }

    if (room.status !== 'playing' || room.phase !== 'board') {
      failureReason = 'Cards can only be used during the board phase.'
      return
    }

    const order = orderedPlayerIds(room)
    const activePlayerId = order[room.turnIndex || 0]
    const turn = room.turnState

    if (activePlayerId !== playerId || turn?.playerId !== playerId) {
      failureReason = 'It is not your turn.'
      return
    }

    if (turn?.battle && turn.battle.status === 'active') {
      failureReason = 'Resolve the current Battle before using another Card.'
      return
    }

    if (turn?.cardUsedThisTurn) {
      failureReason = 'You can only use one Card per turn.'
      return
    }

    const setup = room.playerSetup?.[playerId]
    if (!setup) {
      failureReason = 'Your player data could not be found.'
      return
    }

    const cards = normalizePartyCards(setup.cards)
    if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= cards.length) {
      failureReason = 'That Card is no longer in your inventory.'
      return
    }

    const cardId = cards[cardIndex]
    const card = getPartyCard(cardId)
    if (!card) {
      failureReason = 'That Card could not be found.'
      return
    }

    if (card.enabled === false) {
      failureReason = card.comingSoon || 'That Card is not active yet.'
      return
    }

    const playerName = room.players?.[playerId]?.name || 'Player'
    const cardVisibility = room.settings?.cardVisibility === 'open' ? 'open' : 'hidden'

    // Lockout is a trap, not a turn-long prohibition. The target can still try
    // to play any otherwise-legal Card. That attempted Card is consumed with no
    // effect, Lockout clears immediately, and the attempt uses their one Card
    // play for the turn. Hidden Hands keeps the trap secret until it springs.
    if (setup.lockoutActive) {
      const lockoutSourcePlayerId = setup.lockoutSourcePlayerId

      cards.splice(cardIndex, 1)
      setup.cards = cards
      setup.lockoutActive = false
      delete setup.lockoutSourcePlayerId

      turn.cardUsedThisTurn = true
      turn.lastCardUserId = playerId
      turn.lastPrivateCardMessage = `LOCKOUT! ${card.name} had no effect and was discarded. Lockout is now gone.`
      room.turnState = turn

      setNegativeCardResultNotice(
        room,
        lockoutSourcePlayerId,
        `Your Lockout triggered on ${playerName}. ${card.name} was nullified and discarded with no effect.`
      )

      const lockoutActivity = cardVisibility === 'open'
        ? `${playerName} tried to use ${card.name}, but Lockout nullified it. ${card.name} was discarded.`
        : `${playerName} tried to use an Action Card, but Lockout nullified it. The Card was discarded.`

      addPartyActivity(room, playerId, lockoutActivity, 'card')
      return room
    }

    if (card.timing === 'before-roll' && turn.rolled) {
      failureReason = `${card.name} must be used before you roll.`
      return
    }

    if (card.timing === 'mechanic-landing-choice') {
      failureReason = 'Jackpot is offered automatically when you land on a normal Mechanic Space, before the challenge is revealed.'
      return
    }

    if (card.timing === 'before-mechanic-attempt') {
      if (!turn.rolled || !turn.readyToEnd || !turn.landingEffect || turn.landingEffect.resolved) {
        failureReason = `${card.name} can only be used after landing on a Mechanic and before attempting it.`
        return
      }

      if ((Number(turn.landingEffect.attemptsUsed) || 0) > 0) {
        failureReason = `${card.name} must be used before your first attempt on this Mechanic.`
        return
      }

      if (turn.awaitingMechanicChoice) {
        failureReason = 'Choose your pending replacement Mechanic first.'
        return
      }
    }

    if (card.timing === 'after-failed-mechanic') {
      if (
        !turn.rolled ||
        !turn.readyToEnd ||
        !turn.landingEffect?.resolved ||
        turn.landingEffect.success !== false
      ) {
        failureReason = `${card.name} can only be used after you miss that Mechanic and before you end the turn.`
        return
      }
    }

    if (card.timing === 'after-successful-mechanic') {
      if (!turn.landingEffect?.resolved || turn.landingEffect.success !== true) {
        failureReason = `${card.name} can only be used immediately after completing a Mechanic challenge.`
        return
      }
    }

    let privateMessage = ''
    let publicMessage = ''
    let publicType = 'card'
    let targetSetup = null
    let targetName = ''
    let targetId = ''
    let blockedByShield = false

    if (card.requiresTarget) {
      targetId = String(options.targetId || '')
      if (!targetId || targetId === playerId || !room.players?.[targetId]) {
        failureReason = 'Choose another active player.'
        return
      }

      targetSetup = room.playerSetup?.[targetId]
      if (!targetSetup) {
        failureReason = 'That player is not available.'
        return
      }
      targetName = room.players?.[targetId]?.name || 'Player'

      if (card.negativeTargetEffect) {
        delete setup.negativeCardResultNotice
        delete setup.negativeCardResultNoticeAt
      }

      if (card.negativeTargetEffect && targetSetup.shieldActive) {
        targetSetup.shieldActive = false
        targetSetup.shieldBlockNotice = `Your Shield blocked an attack from ${playerName}. Your Shield is now gone.`
        targetSetup.shieldBlockNoticeAt = Date.now()
        blockedByShield = true
      }
    }

    if (card.effect === 'challenge-glove') {
      const battle = startPartyBattle(room, turn, playerId, 'challenge-glove', {
        opponentId: targetId,
        battleSeed,
        battleMechanic,
      })
      if (!battle) {
        failureReason = 'Could not start a Battle with that player.'
        return
      }

      privateMessage = `Challenge Glove locked in ${targetName}. Random Battle: ${battle.name}. Resolve it, then you still get your normal roll.`
      publicMessage = `${playerName} challenged ${targetName} to ${battle.name} with a Card.`
      publicType = 'battle'
    } else if (card.effect === 'precision-die') {
      const value = Number(options.value)
      if (!Number.isInteger(value) || value < 1 || value > 6) {
        failureReason = 'Choose a Precision Dice result from 1 to 6.'
        return
      }

      turn.rolled = true
      turn.dieType = 'precision'
      turn.faceLabel = String(value)
      turn.baseMovement = value
      turn.movementRemaining = value
      turn.movementStarted = false
      turn.awaitingChoice = false
      turn.readyToEnd = false
      delete turn.pendingMovementBonus
      delete turn.movementBonusApplied
      delete turn.tokenChange
      delete turn.landedNodeId
      delete turn.landedType
      delete turn.landingEffect

      privateMessage = `Precision Dice set your movement to ${value}.`
      publicMessage = `${playerName} chose ${value} movement with a Card instead of rolling.`
      publicType = 'roll'
    } else if (card.effect === 'movement-boost') {
      const amount = Number(card.amount) || 0
      if (amount <= 0) {
        failureReason = 'That movement Card has an invalid value.'
        return
      }

      turn.pendingMovementBonus = amount
      privateMessage = `${card.name} is armed. Your upcoming roll gets +${amount} movement.`
      publicMessage = ''
    } else if (card.effect === 'double-payout') {
      if (setup.doublePayout) {
        failureReason = 'Double Payout is already armed.'
        return
      }

      setup.doublePayout = true
      privateMessage = 'Double Payout is armed for your next normal Mechanic. Make it to double the payout; miss it and the effect is lost.'
      publicMessage = ''
    } else if (card.effect === 'shield') {
      if (setup.shieldActive) {
        failureReason = 'Your Shield is already armed.'
        return
      }

      setup.shieldActive = true
      delete setup.shieldBlockNotice
      delete setup.shieldBlockNoticeAt
      privateMessage = 'Shield armed. The next negative Card used on you will be blocked.'
      publicMessage = ''
    } else if (card.effect === 'token-steal') {
      if (blockedByShield) {
        privateMessage = `${targetName}'s Shield blocked ${card.name}. ${card.name} had no effect.`
        publicMessage = `${playerName} used a Card on ${targetName}, but it was blocked.`
      } else {
        const requested = Math.max(0, Number(card.amount) || 4)
        const stolen = Math.min(requested, Math.max(0, targetSetup.tokens || 0))
        targetSetup.tokens = Math.max(0, (targetSetup.tokens || 0) - stolen)
        setup.tokens = (setup.tokens || 0) + stolen
        privateMessage = `You stole ${stolen} Token${stolen === 1 ? '' : 's'} from ${targetName}.`
        publicMessage = `${playerName} stole ${stolen} Token${stolen === 1 ? '' : 's'} from ${targetName} with a Card.`
      }
    } else if (card.effect === 'teleport-swap') {
      if (blockedByShield) {
        privateMessage = `${targetName}'s Shield blocked ${card.name}. ${card.name} had no effect.`
        publicMessage = `${playerName} used a Card on ${targetName}, but it was blocked.`
      } else {
        const myNode = setup.boardNodeId || BOOSTSTONE_RUINS.startId
        const targetNode = targetSetup.boardNodeId || BOOSTSTONE_RUINS.startId
        setup.boardNodeId = targetNode
        targetSetup.boardNodeId = myNode
        privateMessage = `You swapped board positions with ${targetName}.`
        publicMessage = `${playerName} and ${targetName} swapped board positions because of a Card.`
      }
    } else if (card.effect === 'golden-teleporter') {
      const trophyNodeId = room.activeTrophyNodeId
      if (!trophyNodeId || !BOARD_NODE_BY_ID[trophyNodeId]) {
        failureReason = 'The active Trophy location is not available.'
        return
      }

      const setupNodeId = findNodeOneSpaceBefore(trophyNodeId)
      if (!setupNodeId || !BOARD_NODE_BY_ID[setupNodeId]) {
        failureReason = 'Could not find a space immediately before the active Trophy.'
        return
      }

      setup.boardNodeId = setupNodeId
      turn.readyToEnd = false
      privateMessage = 'Golden Teleporter moved you to one space before the active Trophy. You still need to roll to reach it.'
      publicMessage = `${playerName} used a Card to teleport one space before the active Trophy.`
    } else if (card.effect === 'steal-card') {
      const targetCards = normalizePartyCards(targetSetup.cards)
      if (!blockedByShield && targetCards.length === 0) {
        failureReason = `${targetName} has no Cards to steal.`
        return
      }

      if (blockedByShield) {
        privateMessage = `${targetName}'s Shield blocked ${card.name}. ${card.name} had no effect.`
        publicMessage = `${playerName} used a Card on ${targetName}, but it was blocked.`
      } else {
        let stolenIndex = -1

        if (cardVisibility === 'open') {
          const requestedIndex = Number(options.targetCardIndex)
          if (!Number.isInteger(requestedIndex) || requestedIndex < 0 || requestedIndex >= targetCards.length) {
            failureReason = `Open Hands is active. Choose which Card to steal from ${targetName}.`
            return
          }
          stolenIndex = requestedIndex
        } else {
          stolenIndex = Math.min(targetCards.length - 1, Math.floor(randomSeed * targetCards.length))
        }

        const [stolenCardId] = targetCards.splice(stolenIndex, 1)
        targetSetup.cards = targetCards
        cards.splice(cardIndex, 1)
        cards.push(stolenCardId)
        setup.cards = cards
        const stolenCard = getPartyCard(stolenCardId)
        privateMessage = cardVisibility === 'open'
          ? `You chose and stole ${stolenCard?.name || 'a Card'} from ${targetName}.`
          : `You randomly stole ${stolenCard?.name || 'a Card'} from ${targetName}.`
        publicMessage = cardVisibility === 'open'
          ? `${playerName} stole ${stolenCard?.name || 'a Card'} from ${targetName} with a Card.`
          : `${playerName} stole a Card from ${targetName}.`
      }
    } else if (card.effect === 'swap-hands') {
      if (blockedByShield) {
        privateMessage = `${targetName}'s Shield blocked ${card.name}. ${card.name} had no effect.`
        publicMessage = `${playerName} used a Card on ${targetName}, but it was blocked.`
      } else {
        const targetCards = normalizePartyCards(targetSetup.cards)
        const myRemainingCards = cards.filter((_, index) => index !== cardIndex)
        setup.cards = targetCards
        targetSetup.cards = myRemainingCards
        privateMessage = `You swapped your remaining Card inventory with ${targetName}.`
        publicMessage = `${playerName} and ${targetName} swapped Card inventories.`
      }
    } else if (card.effect === 'lockout') {
      if (targetSetup.lockoutActive) {
        failureReason = `${targetName} already has a Lockout waiting to trigger.`
        return
      }

      if (blockedByShield) {
        privateMessage = `${targetName}'s Shield blocked ${card.name}. ${card.name} had no effect.`
        publicMessage = `${playerName} used a Card on ${targetName}, but it was blocked.`
      } else {
        targetSetup.lockoutActive = true
        targetSetup.lockoutSourcePlayerId = playerId
        privateMessage = `You placed Lockout on ${targetName}. Their next attempted Card will be discarded with no effect, and you will be notified when it triggers.`
        publicMessage = ''
      }
    } else if (card.effect === 'mulligan') {
      const effect = turn.landingEffect
      if (!effect?.resolved || effect.success !== false) {
        failureReason = 'Mulligan can only be used after you miss a Mechanic or Danger Mechanic and before you end the turn.'
        return
      }

      // A Danger failure already removed Tokens. A Mulligan rewinds that failed
      // result before granting the retry, so the retry can genuinely avoid it.
      const refund = effect.type === 'danger-mechanic'
        ? Math.max(0, -(Number(effect.tokenChange) || 0))
        : 0
      if (refund > 0) {
        setup.tokens = (setup.tokens || 0) + refund
      }

      effect.resolved = false
      delete effect.success
      delete effect.tokenChange
      delete effect.resultMessage
      delete effect.publicResultMessage
      effect.attemptLimit = 1
      effect.attemptsUsed = 0
      effect.mulliganRetry = true
      turn.landingEffect = effect
      turn.mulliganUsed = true

      privateMessage = refund > 0
        ? `Mulligan granted a retry and restored ${refund} Token${refund === 1 ? '' : 's'} from the failed Danger attempt.`
        : 'Mulligan granted one retry on your failed Mechanic.'
      publicMessage = `${playerName} used a Card to retry the failed Mechanic.`
    } else if (card.effect === 'mechanic-reroll') {
      const effect = turn.landingEffect
      if (!effect || effect.resolved) {
        failureReason = 'There is no unresolved Mechanic to reroll.'
        return
      }

      const replacement = mechanicCandidates.find(
        (candidate) => candidate?.id !== effect.challengeId
      ) || mechanicCandidates[0]

      if (!replacement) {
        failureReason = 'A replacement Mechanic could not be drawn.'
        return
      }

      const oldName = effect.challengeName
      effect.challengeId = replacement.id
      effect.challengeName = replacement.name
      effect.difficulty = getPartyMechanicDifficulty(replacement)
      effect.rerolled = true
      turn.landingEffect = effect

      privateMessage = `Reroll replaced ${oldName} with ${replacement.name}.`
      publicMessage = `${playerName} replaced their current Mechanic with a Card.`
    } else if (card.effect === 'pick-your-poison') {
      const effect = turn.landingEffect
      if (!effect || effect.resolved) {
        failureReason = 'There is no unresolved Mechanic to replace.'
        return
      }

      const unique = []
      for (const candidate of mechanicCandidates) {
        if (!candidate) continue
        if (candidate.id === effect.challengeId) continue
        if (unique.some((item) => item.id === candidate.id)) continue
        unique.push({ id: candidate.id, name: candidate.name, difficulty: getPartyMechanicDifficulty(candidate) })
        if (unique.length >= 2) break
      }

      if (unique.length < 2) {
        failureReason = 'Could not draw two different replacement Mechanics.'
        return
      }

      turn.mechanicChoices = unique
      turn.awaitingMechanicChoice = true
      privateMessage = 'Pick Your Poison drew 2 replacement Mechanics. Choose one before attempting the challenge.'
      publicMessage = `${playerName} used a Card and must choose between two replacement Mechanics.`
    } else if (card.effect === 'pressure') {
      if (targetSetup.pressureActive) {
        failureReason = `${targetName} already has Pressure waiting for their next Mechanic.`
        return
      }

      if (blockedByShield) {
        privateMessage = `${targetName}'s Shield blocked ${card.name}. ${card.name} had no effect.`
        publicMessage = `${playerName} used a Card, but it was blocked.`
      } else {
        targetSetup.pressureActive = true
        targetSetup.pressureSourcePlayerId = playerId
        privateMessage = `Pressure was secretly placed on ${targetName}. Their next Mechanic will have only 1 attempt, and you will be notified when it triggers.`
        publicMessage = ''
      }
    } else if (card.effect === 'zero-bounce') {
      if (targetSetup.noBounceActive) {
        failureReason = `${targetName} already has a no-bounce requirement waiting.`
        return
      }

      if (blockedByShield) {
        privateMessage = `${targetName}'s Shield blocked ${card.name}. ${card.name} had no effect.`
        publicMessage = `${playerName} used a Card, but it was blocked.`
      } else {
        targetSetup.noBounceActive = true
        targetSetup.noBounceSourcePlayerId = playerId
        privateMessage = `Zero Bounce was secretly placed on ${targetName}. Their next Mechanic must be completed with no bounce, and you will be notified when it triggers.`
        publicMessage = ''
      }
    } else if (card.effect === '100-kph') {
      if (targetSetup.kph100Active) {
        failureReason = `${targetName} already has a 100+ KPH requirement waiting.`
        return
      }

      if (blockedByShield) {
        privateMessage = `${targetName}'s Shield blocked ${card.name}. ${card.name} had no effect.`
        publicMessage = `${playerName} used a Card, but it was blocked.`
      } else {
        targetSetup.kph100Active = true
        targetSetup.kph100SourcePlayerId = playerId
        privateMessage = `100+ KPH was secretly placed on ${targetName}. Their next Mechanic goal must be at least 100 KPH, and you will be notified when it triggers.`
        publicMessage = ''
      }
    } else if (card.effect === 'top-corner') {
      if (targetSetup.topCornerActive) {
        failureReason = `${targetName} already has a Top Corner requirement waiting.`
        return
      }

      if (blockedByShield) {
        privateMessage = `${targetName}'s Shield blocked ${card.name}. ${card.name} had no effect.`
        publicMessage = `${playerName} used a Card, but it was blocked.`
      } else {
        targetSetup.topCornerActive = true
        targetSetup.topCornerSourcePlayerId = playerId
        privateMessage = `Top Corner was secretly placed on ${targetName}. Their next Mechanic goal must finish in a top corner, and you will be notified when it triggers.`
        publicMessage = ''
      }
    } else if (card.effect === 'copycat') {
      const effect = turn.landingEffect
      const last = room.lastScoredMechanic
      if (!effect || effect.resolved) {
        failureReason = 'There is no unresolved Mechanic to copy onto.'
        return
      }
      if (!last?.challengeId || !last?.challengeName) {
        failureReason = 'No other player has completed a Mechanic to copy yet.'
        return
      }
      if (last.playerId === playerId) {
        failureReason = 'Copycat needs the most recent completed Mechanic from another player.'
        return
      }

      effect.challengeId = last.challengeId
      effect.challengeName = last.challengeName
      effect.difficulty = last.difficulty || getPartyMechanicDifficulty(last)
      effect.copycatUsed = true
      turn.landingEffect = effect
      privateMessage = `Copycat changed your challenge to ${last.challengeName}.`
      publicMessage = `${playerName} copied the most recently completed Mechanic with a Card.`
    } else if (card.effect === 'insurance') {
      const effect = turn.landingEffect
      if (!effect || effect.resolved || effect.type !== 'mechanic') {
        failureReason = 'Insurance can only be used before attempting a normal Mechanic Space.'
        return
      }
      if (setup.doublePayout) {
        failureReason = 'Insurance cannot be combined with an armed Double Payout.'
        return
      }
      if (effect.jackpotTriggered) {
        failureReason = 'Insurance cannot be combined with an active Jackpot challenge.'
        return
      }
      if (effect.insuranceActive) {
        failureReason = 'This Mechanic is already insured.'
        return
      }

      effect.insuranceActive = true
      turn.landingEffect = effect
      privateMessage = 'Insurance is active. If you miss this Mechanic, you still gain +1 Token.'
      publicMessage = `${playerName} insured their current Mechanic with a Card.`
    } else if (card.effect === 'free-pass') {
      const effect = turn.landingEffect
      if (!effect || effect.resolved || effect.type !== 'mechanic') {
        failureReason = 'Free Pass can only be used on a revealed normal Mechanic before Attempt 1.'
        return
      }
      if ((Number(effect.attemptsUsed) || 0) > 0) {
        failureReason = 'Free Pass must be used before your first attempt.'
        return
      }
      if (setup.doublePayout) {
        failureReason = 'Free Pass cannot be combined with an armed Double Payout.'
        return
      }
      if (effect.jackpotTriggered) {
        failureReason = 'Free Pass cannot be combined with Jackpot.'
        return
      }

      const baseReward = effect.reward || PARTY_MECHANIC_REWARDS.Medium
      const hotStreakBonus = effect.hotStreakTriggered ? 2 : 0
      const automaticReward = baseReward + hotStreakBonus
      setup.tokens = (setup.tokens || 0) + automaticReward

      effect.resolved = true
      effect.success = true
      effect.tokenChange = automaticReward
      effect.automaticCompletion = true
      effect.resultMessage = `Free Pass automatically completed ${effect.challengeName} without an attempt. +${automaticReward} Tokens${hotStreakBonus ? ' (including Hot Streak +2)' : ''}.`
      effect.publicResultMessage = `An Action Card automatically completed ${effect.challengeName} without an attempt. +${automaticReward} Tokens.`
      turn.landingEffect = effect

      room.lastScoredMechanic = {
        playerId,
        challengeId: effect.challengeId,
        challengeName: effect.challengeName,
        difficulty: effect.difficulty || 'Medium',
      }

      privateMessage = effect.resultMessage
      publicMessage = `${playerName} automatically completed ${effect.challengeName} without taking the shot and gained +${automaticReward} Tokens with a Card.`
    } else if (card.effect === 'hot-streak') {
      if (setup.hotStreakActive) {
        failureReason = 'Hot Streak is already armed for your next Mechanic.'
        return
      }

      setup.hotStreakActive = true
      privateMessage = 'Hot Streak armed. Your next Mechanic has only 1 attempt; success earns +2 bonus Tokens.'
      publicMessage = ''
    } else if (card.effect === 'difficulty-spike' || card.effect === 'difficulty-drop') {
      const effect = turn.landingEffect
      if (!effect || effect.resolved) {
        failureReason = 'There is no unresolved Mechanic to change.'
        return
      }

      const currentDifficulty = effect.difficulty || 'Medium'
      const direction = card.effect === 'difficulty-spike' ? 1 : -1
      const targetDifficulty = getAdjacentPartyMechanicDifficulty(currentDifficulty, direction)
      if (!targetDifficulty) {
        failureReason = card.effect === 'difficulty-spike'
          ? 'This Mechanic is already at the highest difficulty tier.'
          : 'This Mechanic is already at the lowest difficulty tier.'
        return
      }

      const replacement = mechanicCandidates.find((candidate) =>
        candidate?.id !== effect.challengeId &&
        getPartyMechanicDifficulty(candidate) === targetDifficulty
      )
      if (!replacement) {
        failureReason = `Could not draw a ${targetDifficulty} replacement Mechanic. Try again.`
        return
      }

      const oldName = effect.challengeName
      effect.challengeId = replacement.id
      effect.challengeName = replacement.name
      effect.difficulty = targetDifficulty
      effect.difficultyChanged = card.effect === 'difficulty-spike' ? 'up' : 'down'
      turn.landingEffect = effect
      privateMessage = `${card.name} replaced ${oldName} with ${replacement.name} (${targetDifficulty}).`
      publicMessage = `${playerName} changed their Mechanic to a ${targetDifficulty} challenge with a Card.`
    } else if (card.effect === 'reverse-turn-order') {
      const currentDirection = room.turnDirection === -1 ? -1 : 1
      room.turnDirection = currentDirection * -1
      privateMessage = room.turnDirection === -1
        ? 'Reverse activated. Turn direction is now reversed.'
        : 'Reverse activated. Turn direction is back to normal.'
      publicMessage = `${playerName} reversed the turn direction with a Card.`
    } else if (card.effect === 'clean-slate') {
      const oldHandSize = cards.length
      const replacements = cleanSlateDraws.slice(0, oldHandSize)
      setup.cards = replacements
      privateMessage = `Clean Slate replaced your ${oldHandSize} Card${oldHandSize === 1 ? '' : 's'} with ${oldHandSize} new Card${oldHandSize === 1 ? '' : 's'}.`
      publicMessage = ''
    } else {
      failureReason = 'That Card effect is not active yet.'
      return
    }

    // Shared Activity follows the lobby's hand-visibility rule.
    // Hidden Hands always records that a Card was played, but keeps the Card's
    // identity private unless the visible board result naturally gives away
    // what happened. Open Hands names the exact Card every time.
    if (cardVisibility === 'open') {
      if (publicMessage) {
        publicMessage = publicMessage
          .replaceAll('with an Action Card', `with ${card.name}`)
          .replaceAll('with a Card', `with ${card.name}`)
          .replaceAll('used an Action Card', `used ${card.name}`)
          .replaceAll('used a Card', `used ${card.name}`)
          .replaceAll('because of an Action Card', `because of ${card.name}`)
          .replaceAll('because of a Card', `because of ${card.name}`)

        if (!publicMessage.includes(card.name)) {
          publicMessage = `${publicMessage.replace(/\.$/, '')} using ${card.name}.`
        }
      } else {
        publicMessage = targetId
          ? `${playerName} used ${card.name} on ${targetName}.`
          : `${playerName} used ${card.name}.`
      }
    } else if (publicMessage) {
      publicMessage = publicMessage
        .replaceAll('with a Card', 'with an Action Card')
        .replaceAll('used a Card', 'used an Action Card')
        .replaceAll('because of a Card', 'because of an Action Card')
    } else {
      // Do not expose the Card name, effect, or secret target just because the
      // activation itself is logged. Example: Shield simply appears as
      // "Bradley used an Action Card." until it later blocks something.
      publicMessage = `${playerName} used an Action Card.`
    }

    // Most Cards are consumed here. Steal, Swap Hands, and Clean Slate already
    // build their final inventory explicitly because the whole hand changes.
    const inventoryAlreadyRebuilt =
      card.effect === 'clean-slate' ||
      (card.effect === 'steal-card' && !blockedByShield) ||
      (card.effect === 'swap-hands' && !blockedByShield)

    if (!inventoryAlreadyRebuilt) {
      cards.splice(cardIndex, 1)
      setup.cards = cards
    }

    turn.cardUsedThisTurn = true
    turn.lastCardUserId = playerId
    turn.lastPrivateCardMessage = privateMessage
    room.turnState = turn

    if (publicMessage) {
      addPartyActivity(room, playerId, publicMessage, publicType)
    }
    return room
  })

  if (!result.committed) {
    throw new Error(failureReason || 'Could not use that Card. Try again.')
  }
}

export async function choosePartyMechanicChoice(roomCode, playerId, choiceIndex) {
  requireOnlineIdentity(playerId)
  const code = normalizeCode(roomCode)
  const roomRef = ref(db, `securePartyRooms/${code}`)
  let failureReason = ''

  const result = await runTransaction(roomRef, (room) => {
    if (!room) {
      failureReason = 'Party room not found.'
      return
    }

    if (room.status !== 'playing' || room.phase !== 'board') {
      failureReason = 'A Mechanic choice cannot be made right now.'
      return
    }

    const order = orderedPlayerIds(room)
    const activePlayerId = order[room.turnIndex || 0]
    const turn = room.turnState

    if (activePlayerId !== playerId || turn?.playerId !== playerId) {
      failureReason = 'It is not your turn.'
      return
    }

    if (!turn.awaitingMechanicChoice || !Array.isArray(turn.mechanicChoices)) {
      failureReason = 'There is no replacement Mechanic choice waiting.'
      return
    }

    if (!turn.landingEffect || turn.landingEffect.resolved) {
      failureReason = 'The Mechanic challenge is no longer available.'
      return
    }

    const index = Number(choiceIndex)
    const selected = Number.isInteger(index) ? turn.mechanicChoices[index] : null
    if (!selected?.id || !selected?.name) {
      failureReason = 'Choose one of the available Mechanics.'
      return
    }

    turn.landingEffect.challengeId = selected.id
    turn.landingEffect.challengeName = selected.name
    turn.landingEffect.difficulty = selected.difficulty || getPartyMechanicDifficulty(selected)
    turn.landingEffect.pickYourPoisonChoice = true
    turn.awaitingMechanicChoice = false
    delete turn.mechanicChoices

    const playerName = room.players?.[playerId]?.name || 'Player'
    addPartyActivity(
      room,
      playerId,
      `${playerName} chose ${selected.name} from two replacement Mechanics.`,
      'mechanic'
    )

    room.turnState = turn
    return room
  })

  if (!result.committed) {
    throw new Error(failureReason || 'Could not choose that Mechanic.')
  }
}


export async function resolvePartyJackpotDecision(roomCode, playerId, useJackpot) {
  requireOnlineIdentity(playerId)
  const code = normalizeCode(roomCode)
  const roomRef = ref(db, `securePartyRooms/${code}`)
  const landingMechanic = pickPartyMechanic()
  let failureReason = ''

  const result = await runTransaction(roomRef, (room) => {
    if (!room) {
      failureReason = 'Party room not found.'
      return
    }

    if (room.status !== 'playing' || room.phase !== 'board') {
      failureReason = 'The Jackpot decision is not available right now.'
      return
    }

    const order = orderedPlayerIds(room)
    const activePlayerId = order[room.turnIndex || 0]
    const turn = room.turnState

    if (activePlayerId !== playerId || turn?.playerId !== playerId) {
      failureReason = 'It is not your turn.'
      return
    }

    if (!turn?.awaitingJackpotDecision || turn.landedType !== 'Mechanic' || !turn.landedNodeId) {
      failureReason = 'There is no Jackpot decision waiting.'
      return
    }

    const setup = room.playerSetup?.[playerId]
    if (!setup) {
      failureReason = 'Your player data could not be found.'
      return
    }

    if (!landingMechanic) {
      failureReason = 'Could not draw the Mechanic challenge.'
      return
    }

    let jackpotTriggered = false

    if (useJackpot) {
      if (turn.cardUsedThisTurn) {
        failureReason = 'You already used a Card this turn.'
        return
      }

      const cards = normalizePartyCards(setup.cards)
      const jackpotIndex = cards.findIndex((cardId) => cardId === 'jackpot')
      if (jackpotIndex === -1) {
        failureReason = 'Jackpot is no longer in your inventory.'
        return
      }

      const playerName = room.players?.[playerId]?.name || 'Player'
      const cardVisibility = room.settings?.cardVisibility === 'open' ? 'open' : 'hidden'

      cards.splice(jackpotIndex, 1)
      setup.cards = cards
      turn.cardUsedThisTurn = true
      turn.lastCardUserId = playerId

      if (setup.lockoutActive) {
        const lockoutSourcePlayerId = setup.lockoutSourcePlayerId
        setup.lockoutActive = false
        delete setup.lockoutSourcePlayerId

        turn.lastPrivateCardMessage = 'LOCKOUT! Jackpot had no effect and was discarded. Lockout is now gone.'

        setNegativeCardResultNotice(
          room,
          lockoutSourcePlayerId,
          `Your Lockout triggered on ${playerName}. Jackpot was nullified and discarded with no effect.`
        )

        addPartyActivity(
          room,
          playerId,
          cardVisibility === 'open'
            ? `${playerName} tried to use Jackpot, but Lockout nullified it. Jackpot was discarded.`
            : `${playerName} tried to use an Action Card, but Lockout nullified it. The Card was discarded.`,
          'card'
        )
      } else {
        jackpotTriggered = true
        turn.lastPrivateCardMessage = 'Jackpot accepted. The Mechanic is now being revealed: success pays 2× its normal would-be payout; missing all attempts loses that normal would-be payout.'

        addPartyActivity(
          room,
          playerId,
          cardVisibility === 'open'
            ? `${playerName} used Jackpot before revealing their Mechanic.`
            : `${playerName} used an Action Card before revealing their Mechanic.`,
          'card'
        )
      }
    }

    turn.awaitingJackpotDecision = false
    attachLandingEffect(room, turn, playerId, turn.landedNodeId, landingMechanic)

    if (!turn.landingEffect) {
      failureReason = 'Could not reveal the Mechanic challenge.'
      return
    }

    if (jackpotTriggered) {
      turn.landingEffect.jackpotTriggered = true
    }

    room.turnState = turn
    return room
  })

  if (!result.committed) {
    throw new Error(failureReason || 'Could not resolve the Jackpot decision.')
  }
}


export async function resolvePartyMechanicLanding(roomCode, playerId, success) {
  requireOnlineIdentity(playerId)
  const code = normalizeCode(roomCode)
  const roomRef = ref(db, `securePartyRooms/${code}`)
  let failureReason = ''

  const result = await runTransaction(roomRef, (room) => {
    if (!room) {
      failureReason = 'Party room not found.'
      return
    }

    if (room.status !== 'playing' || room.phase !== 'board') {
      failureReason = 'The landing challenge cannot be resolved right now.'
      return
    }

    const order = orderedPlayerIds(room)
    const activePlayerId = order[room.turnIndex || 0]
    const turn = room.turnState

    if (activePlayerId !== playerId || turn?.playerId !== playerId) {
      failureReason = 'It is not your turn.'
      return
    }

    if (turn?.awaitingMechanicChoice) {
      failureReason = 'Choose your replacement Mechanic first.'
      return
    }

    if (!turn?.readyToEnd || !turn?.landingEffect || turn.landingEffect.resolved) {
      failureReason = 'There is no landing challenge waiting.'
      return
    }

    const setup = room.playerSetup?.[playerId]
    if (!setup) {
      failureReason = 'Your player data could not be found.'
      return
    }

    const effect = turn.landingEffect
    const madeIt = Boolean(success)
    const attemptLimit = Math.max(1, Number(effect.attemptLimit) || 2)
    const previousAttempts = Math.max(0, Number(effect.attemptsUsed) || 0)

    if (previousAttempts >= attemptLimit) {
      failureReason = 'All attempts for this Mechanic have already been used.'
      return
    }

    effect.attemptLimit = attemptLimit
    effect.attemptsUsed = previousAttempts + 1

    const playerName = room.players?.[playerId]?.name || 'Player'

    // A normal Mechanic gives two attempts by default. Cards such as Pressure
    // and Hot Streak explicitly reduce the limit to one. A miss only resolves
    // the landing after the final allowed attempt has been used.
    if (!madeIt && effect.attemptsUsed < attemptLimit) {
      const remaining = attemptLimit - effect.attemptsUsed
      effect.resultMessage = `Missed attempt ${effect.attemptsUsed}. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
      effect.publicResultMessage = effect.resultMessage
      effect.lastAttemptSuccess = false
      turn.landingEffect = effect

      addPartyActivity(
        room,
        playerId,
        `${playerName} missed attempt ${effect.attemptsUsed} of ${attemptLimit} on ${effect.challengeName}. ${remaining} attempt${remaining === 1 ? '' : 's'} remain${remaining === 1 ? 's' : ''}.`,
        'mechanic'
      )

      room.turnState = turn
      return room
    }

    let actualTokenChange = 0

    if (effect.type === 'mechanic') {
      if (madeIt) {
        const baseReward = effect.reward || PARTY_MECHANIC_REWARDS.Medium
        const payoutMultiplier = setup.doublePayout ? 2 : 1
        const doubledReward = baseReward * payoutMultiplier
        const hotStreakBonus = effect.hotStreakTriggered ? 2 : 0

        // Jackpot is true risk/reward: first calculate exactly what this
        // Mechanic would pay without Jackpot (including other payout modifiers),
        // then double that amount on success. A failure risks that same amount.
        const payoutWithoutJackpot = doubledReward + hotStreakBonus
        actualTokenChange = effect.jackpotTriggered
          ? payoutWithoutJackpot * 2
          : payoutWithoutJackpot
        setup.tokens = (setup.tokens || 0) + actualTokenChange

        const bonusNotes = []
        if (setup.doublePayout) bonusNotes.push(`Double Payout ${baseReward}→${doubledReward}`)
        if (effect.hotStreakTriggered) bonusNotes.push('Hot Streak +2')
        if (effect.jackpotTriggered) bonusNotes.push(`Jackpot ${payoutWithoutJackpot}→${actualTokenChange}`)
        effect.resultMessage = `Made it on attempt ${effect.attemptsUsed}! +${actualTokenChange} Tokens${bonusNotes.length ? ` (${bonusNotes.join(', ')})` : ''}.`
        effect.publicResultMessage = `Made it on attempt ${effect.attemptsUsed}! +${actualTokenChange} Tokens.`

        if (setup.doublePayout) {
          setup.doublePayout = false
          turn.lastCardUserId = playerId
          turn.lastPrivateCardMessage = `Double Payout triggered: ${baseReward} Tokens became ${doubledReward}.`
        }
      } else if (effect.insuranceActive) {
        actualTokenChange = 1
        setup.tokens = (setup.tokens || 0) + 1
        effect.resultMessage = `Missed both attempts, but Insurance paid +1 Token.`
        effect.publicResultMessage = `Missed both attempts, but a Card effect awarded +1 Token.`
      } else if (effect.jackpotTriggered) {
        const baseReward = effect.reward || PARTY_MECHANIC_REWARDS.Medium
        const payoutMultiplier = setup.doublePayout ? 2 : 1
        const hotStreakBonus = effect.hotStreakTriggered ? 2 : 0
        const payoutWithoutJackpot = (baseReward * payoutMultiplier) + hotStreakBonus
        const before = setup.tokens || 0
        setup.tokens = Math.max(0, before - payoutWithoutJackpot)
        actualTokenChange = setup.tokens - before
        const actuallyLost = Math.abs(actualTokenChange)
        const floorNote = actuallyLost < payoutWithoutJackpot
          ? ` (only ${actuallyLost} could be lost because Tokens cannot go below 0)`
          : ''
        effect.resultMessage = `Missed all ${attemptLimit} attempt${attemptLimit === 1 ? '' : 's'}. Jackpot lost ${payoutWithoutJackpot} Token${payoutWithoutJackpot === 1 ? '' : 's'} — the amount this Mechanic would have paid without Jackpot${floorNote}.`
        effect.publicResultMessage = `Missed all ${attemptLimit} attempt${attemptLimit === 1 ? '' : 's'} and lost ${actuallyLost} Token${actuallyLost === 1 ? '' : 's'} from a Card effect.`
      } else {
        effect.resultMessage = `Missed all ${attemptLimit} attempt${attemptLimit === 1 ? '' : 's'}. No Tokens gained.`
        effect.publicResultMessage = effect.resultMessage
      }

      if (!madeIt && setup.doublePayout) {
        setup.doublePayout = false
        turn.lastCardUserId = playerId
        turn.lastPrivateCardMessage = 'Double Payout was used up on this Mechanic. You missed your final attempt, so the double payout is gone.'
      }
    } else if (effect.type === 'danger-mechanic') {
      if (madeIt) {
        if (effect.hotStreakTriggered) {
          actualTokenChange = 2
          setup.tokens = (setup.tokens || 0) + 2
          effect.resultMessage = `Made it on attempt ${effect.attemptsUsed}! Penalty avoided and Hot Streak awarded +2 Tokens.`
          effect.publicResultMessage = `Made it on attempt ${effect.attemptsUsed}! Penalty avoided and a Card effect awarded +2 Tokens.`
        } else {
          effect.resultMessage = `Made it on attempt ${effect.attemptsUsed}! Penalty avoided.`
          effect.publicResultMessage = effect.resultMessage
        }
      } else {
        const requestedPenalty = effect.penalty || PARTY_DANGER_PENALTY
        const before = setup.tokens || 0
        setup.tokens = Math.max(0, before - requestedPenalty)
        actualTokenChange = setup.tokens - before
        effect.resultMessage = `Missed all ${attemptLimit} attempt${attemptLimit === 1 ? '' : 's'}. Lost ${Math.abs(actualTokenChange)} Token${Math.abs(actualTokenChange) === 1 ? '' : 's'}.`
        effect.publicResultMessage = effect.resultMessage
      }
    } else {
      failureReason = 'That landing challenge is not supported.'
      return
    }

    effect.resolved = true
    effect.success = madeIt
    effect.tokenChange = actualTokenChange
    effect.lastAttemptSuccess = madeIt
    turn.landingEffect = effect

    if (madeIt) {
      room.lastScoredMechanic = {
        playerId,
        challengeId: effect.challengeId,
        challengeName: effect.challengeName,
        difficulty: effect.difficulty || 'Medium',
      }
    }

    let activityMessage = `${playerName} ${madeIt ? 'completed' : 'missed'} ${effect.challengeName}.`
    if (effect.type === 'mechanic' && madeIt) {
      activityMessage = `${playerName} completed ${effect.challengeName} on attempt ${effect.attemptsUsed} and gained +${actualTokenChange} Tokens.`
    } else if (effect.type === 'mechanic' && !madeIt && actualTokenChange > 0) {
      activityMessage = `${playerName} missed ${effect.challengeName} after ${effect.attemptsUsed} attempt${effect.attemptsUsed === 1 ? '' : 's'}, but a Card effect still awarded +${actualTokenChange} Token${actualTokenChange === 1 ? '' : 's'}.`
    } else if (effect.type === 'mechanic' && !madeIt && actualTokenChange < 0) {
      activityMessage = `${playerName} missed ${effect.challengeName} after ${effect.attemptsUsed} attempt${effect.attemptsUsed === 1 ? '' : 's'} and lost ${Math.abs(actualTokenChange)} Token${Math.abs(actualTokenChange) === 1 ? '' : 's'} from a Card effect.`
    } else if (effect.type === 'mechanic' && !madeIt) {
      activityMessage = `${playerName} missed ${effect.challengeName} after ${effect.attemptsUsed} attempt${effect.attemptsUsed === 1 ? '' : 's'} and gained no Tokens.`
    } else if (effect.type === 'danger-mechanic' && madeIt && actualTokenChange > 0) {
      activityMessage = `${playerName} completed ${effect.challengeName} on attempt ${effect.attemptsUsed}, avoided the Danger penalty, and gained +${actualTokenChange} bonus Tokens.`
    } else if (effect.type === 'danger-mechanic' && madeIt) {
      activityMessage = `${playerName} completed ${effect.challengeName} on attempt ${effect.attemptsUsed} and avoided the Danger penalty.`
    } else if (effect.type === 'danger-mechanic' && !madeIt) {
      activityMessage = `${playerName} missed ${effect.challengeName} after ${effect.attemptsUsed} attempt${effect.attemptsUsed === 1 ? '' : 's'} and lost ${Math.abs(actualTokenChange)} Token${Math.abs(actualTokenChange) === 1 ? '' : 's'}.`
    }
    addPartyActivity(room, playerId, activityMessage, 'mechanic')

    room.turnState = turn
    return room
  })

  if (!result.committed) {
    throw new Error(failureReason || 'Could not resolve the landing challenge.')
  }
}

export async function resolvePartyBattle(roomCode, reporterId, winnerId) {
  requireOnlineIdentity(reporterId)
  const code = normalizeCode(roomCode)
  const roomRef = ref(db, `securePartyRooms/${code}`)
  let failureReason = ''

  const result = await runTransaction(roomRef, (room) => {
    if (!room) {
      failureReason = 'Party room not found.'
      return
    }

    if (room.status !== 'playing' || room.phase !== 'board') {
      failureReason = 'There is no active Party Battle right now.'
      return
    }

    const order = orderedPlayerIds(room)
    const activePlayerId = order[room.turnIndex || 0]
    const turn = room.turnState
    const battle = turn?.battle

    if (!battle || battle.status !== 'active') {
      failureReason = 'There is no unresolved Battle.'
      return
    }

    if (reporterId !== activePlayerId || reporterId !== battle.challengerId) {
      failureReason = 'Only the current player can report the Battle winner.'
      return
    }

    if (![battle.challengerId, battle.opponentId].includes(winnerId)) {
      failureReason = 'Choose one of the two Battle players as the winner.'
      return
    }

    const loserId = winnerId === battle.challengerId ? battle.opponentId : battle.challengerId
    const winnerSetup = room.playerSetup?.[winnerId]
    const loserSetup = room.playerSetup?.[loserId]
    if (!winnerSetup || !loserSetup) {
      failureReason = 'Battle player data could not be found.'
      return
    }

    const reward = Number(battle.rewardTokens) || PARTY_BATTLE_WIN_REWARD
    const requestedLoss = Number(battle.lossTokens) || PARTY_BATTLE_LOSS_PENALTY
    const actualLoss = Math.min(requestedLoss, Math.max(0, loserSetup.tokens || 0))

    winnerSetup.tokens = (winnerSetup.tokens || 0) + reward
    loserSetup.tokens = Math.max(0, (loserSetup.tokens || 0) - requestedLoss)

    battle.status = 'resolved'
    battle.winnerId = winnerId
    battle.loserId = loserId
    battle.rewardApplied = reward
    battle.lossApplied = actualLoss
    battle.resolvedAt = Date.now()
    battle.resultMessage = `${room.players?.[winnerId]?.name || 'Winner'} won ${battle.name}: +${reward} Tokens. ${room.players?.[loserId]?.name || 'Loser'} lost ${actualLoss} Token${actualLoss === 1 ? '' : 's'}.`
    turn.battle = battle

    addPartyActivity(room, winnerId, battle.resultMessage, 'battle')
    room.turnState = turn
    return room
  })

  if (!result.committed) {
    throw new Error(failureReason || 'Could not resolve that Battle.')
  }
}

export async function votePartyBattleMutualConcede(roomCode, playerId) {
  requireOnlineIdentity(playerId)
  const code = normalizeCode(roomCode)
  const roomRef = ref(db, `securePartyRooms/${code}`)
  let failureReason = ''

  const result = await runTransaction(roomRef, (room) => {
    if (!room) {
      failureReason = 'Party room not found.'
      return
    }

    const turn = room.turnState
    const battle = turn?.battle
    if (room.status !== 'playing' || room.phase !== 'board' || !battle || battle.status !== 'active') {
      failureReason = 'There is no unresolved Battle to concede.'
      return
    }

    if (!battle.allowMutualConcede) {
      failureReason = 'This Battle does not allow a mutual concede.'
      return
    }

    if (![battle.challengerId, battle.opponentId].includes(playerId)) {
      failureReason = 'Only the two Battle players can vote to concede.'
      return
    }

    const votes = battle.mutualConcedeVotes && typeof battle.mutualConcedeVotes === 'object'
      ? { ...battle.mutualConcedeVotes }
      : {}
    votes[playerId] = true
    battle.mutualConcedeVotes = votes

    const challengerVoted = Boolean(votes[battle.challengerId])
    const opponentVoted = Boolean(votes[battle.opponentId])
    const playerName = room.players?.[playerId]?.name || 'Player'

    if (challengerVoted && opponentVoted) {
      battle.status = 'resolved'
      battle.result = 'mutual-concede'
      battle.resolvedAt = Date.now()
      battle.resultMessage = `${battle.name} ended in a mutual concede. No Tokens changed.`
      addPartyActivity(room, playerId, battle.resultMessage, 'battle')
    } else {
      addPartyActivity(room, playerId, `${playerName} requested a mutual concede in ${battle.name}.`, 'battle')
    }

    turn.battle = battle
    room.turnState = turn
    return room
  })

  if (!result.committed) {
    throw new Error(failureReason || 'Could not submit the mutual-concede vote.')
  }
}

export async function cancelPartyBattleMutualConcede(roomCode, playerId) {
  requireOnlineIdentity(playerId)
  const code = normalizeCode(roomCode)
  const roomRef = ref(db, `securePartyRooms/${code}`)
  let failureReason = ''

  const result = await runTransaction(roomRef, (room) => {
    if (!room) {
      failureReason = 'Party room not found.'
      return
    }

    const turn = room.turnState
    const battle = turn?.battle
    if (room.status !== 'playing' || room.phase !== 'board' || !battle || battle.status !== 'active') {
      failureReason = 'There is no unresolved Battle concede request to cancel.'
      return
    }

    if (!battle.allowMutualConcede) {
      failureReason = 'This Battle does not allow a mutual concede.'
      return
    }

    if (![battle.challengerId, battle.opponentId].includes(playerId)) {
      failureReason = 'Only the two Battle players can cancel a concede request.'
      return
    }

    const votes = battle.mutualConcedeVotes && typeof battle.mutualConcedeVotes === 'object'
      ? { ...battle.mutualConcedeVotes }
      : {}

    if (!votes[playerId]) {
      failureReason = 'You do not currently have a mutual-concede request to cancel.'
      return
    }

    delete votes[playerId]
    battle.mutualConcedeVotes = votes

    const playerName = room.players?.[playerId]?.name || 'Player'
    addPartyActivity(room, playerId, `${playerName} canceled their mutual concede request in ${battle.name}.`, 'battle')

    turn.battle = battle
    room.turnState = turn
    return room
  })

  if (!result.committed) {
    throw new Error(failureReason || 'Could not cancel the mutual-concede request.')
  }
}

export async function preparePartyBattleDevTest(roomCode, requesterId) {
  requireOnlineIdentity(requesterId)
  const code = normalizeCode(roomCode)
  const roomRef = ref(db, `securePartyRooms/${code}`)
  const battleSeed = Math.random()
  const battleMechanic = pickPartyMechanic()
  let failureReason = ''

  const result = await runTransaction(roomRef, (room) => {
    if (!room) {
      failureReason = 'Party room not found.'
      return
    }
    if (room.hostId !== requesterId) {
      failureReason = 'Only the host can prepare a DEV Battle test.'
      return
    }

    const order = orderedPlayerIds(room)
    const testerIndex = order.indexOf(requesterId)
    const opponentId = order.find((id) => id !== requesterId) || ''
    if (testerIndex === -1 || !opponentId) {
      failureReason = 'A DEV Battle test needs the host plus at least one other player.'
      return
    }

    room.status = 'playing'
    room.phase = 'board'
    room.turnIndex = testerIndex
    room.turnDirection = 1
    room.roundTakenPlayerIds = []
    delete room.devCardTest
    delete room.devSpaceTest
    if (room.playerSetup?.[requesterId]) room.playerSetup[requesterId].tokens = 20
    if (room.playerSetup?.[opponentId]) room.playerSetup[opponentId].tokens = 20
    const turn = makeTurnState(requesterId)
    turn.rolled = true
    turn.dieType = 'dev'
    turn.faceLabel = 'DEV'
    turn.baseMovement = 0
    turn.movementRemaining = 0
    turn.movementStarted = true
    turn.readyToEnd = true
    turn.landedType = 'Battle'
    turn.landedNodeId = BOOSTSTONE_RUINS.nodes.find((node) => node.type === 'Battle')?.id || BOOSTSTONE_RUINS.startId

    const battle = startPartyBattle(room, turn, requesterId, 'battle-space', {
      opponentId,
      battleSeed,
      battleMechanic,
    })
    if (!battle) {
      failureReason = 'Could not create a DEV Battle.'
      return
    }

    room.turnState = turn
    room.devBattleTest = {
      battleId: battle.id,
      battleName: battle.name,
      testerId: requesterId,
      opponentId,
      instructions: `Play ${battle.name}, then report either player as winner. Winner should gain +${PARTY_BATTLE_WIN_REWARD} Tokens and loser should lose up to ${PARTY_BATTLE_LOSS_PENALTY}.`,
      preparedAt: Date.now(),
    }
    return room
  })

  if (!result.committed) {
    throw new Error(failureReason || 'Could not prepare the DEV Battle test.')
  }
}

export async function preparePartyLuckDevTest(roomCode, requesterId, spaceType = 'Lucky') {
  requireOnlineIdentity(requesterId)
  const code = normalizeCode(roomCode)
  const roomRef = ref(db, `securePartyRooms/${code}`)
  const normalizedType = spaceType === 'Very Bad Luck'
    ? 'Very Bad Luck'
    : spaceType === 'Bad Luck'
      ? 'Bad Luck'
      : 'Lucky'
  const landingNodeType = normalizedType === 'Very Bad Luck' ? 'Bad Luck' : normalizedType
  const outcomeSeed = Math.random()
  const landingCard = pickPartyCard()
  let failureReason = ''

  const result = await runTransaction(roomRef, (room) => {
    if (!room) {
      failureReason = 'Party room not found.'
      return
    }
    if (room.hostId !== requesterId) {
      failureReason = 'Only the host can prepare a DEV Lucky / Bad Luck test.'
      return
    }

    const order = orderedPlayerIds(room)
    const testerIndex = order.indexOf(requesterId)
    if (testerIndex === -1) {
      failureReason = 'The host is not in the current player order.'
      return
    }

    if (!room.playerSetup?.[requesterId]) {
      failureReason = 'The host player setup is missing.'
      return
    }

    const targetNode = BOOSTSTONE_RUINS.nodes.find((node) => node.type === landingNodeType)
    if (!targetNode) {
      failureReason = `No ${landingNodeType} Space exists on this map.`
      return
    }

    room.status = 'playing'
    room.phase = 'board'
    room.turnIndex = testerIndex
    room.turnDirection = 1
    room.roundTakenPlayerIds = []
    delete room.devCardTest
    delete room.devBattleTest
    delete room.temporaryTrophyPriceMultiplier
    delete room.temporaryTrophyPriceUntil

    const totalRounds = room.settings?.rounds || 10
    room.currentRound = normalizedType === 'Very Bad Luck'
      ? Math.max(1, totalRounds - 4)
      : 1

    order.forEach((id, index) => {
      const playerSetup = room.playerSetup?.[id]
      if (!playerSetup) return
      playerSetup.tokens = id === requesterId
        ? (normalizedType === 'Very Bad Luck' ? 20 : 12)
        : 6 + index * 2
      playerSetup.trophies = id === requesterId
        ? (normalizedType === 'Very Bad Luck' ? 2 : 1)
        : index === order.length - 1 ? 0 : 1
    })

    const setup = room.playerSetup[requesterId]
    setup.boardNodeId = targetNode.id
    setup.cards = normalizedType === 'Lucky'
      ? []
      : ['boost-canister', 'shield', 'precision-die'].filter((id) => Boolean(getPartyCard(id)))

    const turn = makeTurnState(requesterId)
    turn.rolled = true
    turn.dieType = 'dev'
    turn.faceLabel = 'DEV'
    turn.baseMovement = 0
    turn.movementRemaining = 0
    turn.movementStarted = true
    turn.readyToEnd = true
    turn.landedType = landingNodeType
    turn.landedNodeId = targetNode.id
    addLandingActivity(room, requesterId, targetNode.id)
    const effect = applyPartyLuckLanding(
      room,
      turn,
      requesterId,
      normalizedType,
      outcomeSeed,
      landingCard
    )

    room.turnState = turn
    room.devSpaceTest = {
      spaceType: normalizedType,
      outcomeName: effect?.name || 'Unknown outcome',
      testerId: requesterId,
      instructions: effect?.resolved === false
        ? `${normalizedType} Roulette selected ${effect?.name || 'an interactive outcome'}. Finish the player choice in the result panel, including the Randomize Player option.`
        : `${normalizedType} Roulette resolved immediately. Check Tokens/Trophies/Cards, Trophy location or price when relevant, shared activity wording, and the result panel. Click the DEV button again for another random outcome.`,
      preparedAt: Date.now(),
    }
    return room
  })

  if (!result.committed) {
    throw new Error(failureReason || `Could not prepare the DEV ${normalizedType} test.`)
  }
}


export async function preparePartyEventDevTest(roomCode, requesterId, eventId = 'supply-crates') {
  requireOnlineIdentity(requesterId)
  const code = normalizeCode(roomCode)
  const roomRef = ref(db, `securePartyRooms/${code}`)
  const seed = Math.random()
  let failureReason = ''

  const result = await runTransaction(roomRef, (room) => {
    if (!room) {
      failureReason = 'Party room not found.'
      return
    }
    if (room.hostId !== requesterId) {
      failureReason = 'Only the host can prepare a DEV Event test.'
      return
    }

    const order = orderedPlayerIds(room)
    const testerIndex = order.indexOf(requesterId)
    const targetNode = BOOSTSTONE_RUINS.nodes.find((node) => node.special === eventId)
    const event = BOOSTSTONE_RUINS.boardEvents?.[eventId]
    if (testerIndex < 0 || !room.playerSetup?.[requesterId]) {
      failureReason = 'The host player setup is missing.'
      return
    }
    if (!targetNode || !event) {
      failureReason = 'That Booststone Ruins Event is not available.'
      return
    }

    room.status = 'playing'
    room.phase = 'board'
    room.turnIndex = testerIndex
    room.turnDirection = 1
    room.roundTakenPlayerIds = []
    room.currentRound = 1
    delete room.devCardTest
    delete room.devBattleTest
    delete room.devSpaceTest

    room.boardState = {
      closedGarageGateId: BOOSTSTONE_RUINS.gates?.[0]?.id || '',
      usedBoardEvents: {},
    }

    order.forEach((id, index) => {
      const playerSetup = room.playerSetup?.[id]
      if (!playerSetup) return
      playerSetup.tokens = 12 + index
      playerSetup.trophies = index === 0 ? 1 : 0
      playerSetup.cards = []
      playerSetup.boardNodeId = BOOSTSTONE_RUINS.startId
    })

    const testerSetup = room.playerSetup[requesterId]
    testerSetup.boardNodeId = targetNode.id

    if (eventId.startsWith('reactor-trigger-')) {
      const affectedNodes = Array.isArray(event.affectedNodes) ? event.affectedNodes : []
      const otherId = order.find((id) => id !== requesterId && room.playerSetup?.[id])
      if (otherId && affectedNodes.length > 1) {
        room.playerSetup[otherId].boardNodeId = affectedNodes[1]
      }
    }

    const turn = makeTurnState(requesterId)
    turn.rolled = true
    turn.dieType = 'dev'
    turn.faceLabel = 'DEV'
    turn.baseMovement = 0
    turn.movementRemaining = 0
    turn.movementStarted = true
    turn.readyToEnd = true
    turn.landedType = 'Event'
    turn.landedNodeId = targetNode.id
    addLandingActivity(room, requesterId, targetNode.id)
    const effect = applyPartyEventLanding(room, turn, requesterId, targetNode.id, seed)
    room.turnState = turn

    room.devEventTest = {
      eventId,
      eventName: event.name,
      testerId: requesterId,
      instructions: effect?.resolved === false
        ? `${event.name} is waiting for an interactive choice. Complete it in the Event panel and verify the reward and shared activity.`
        : `${event.name} resolved immediately. Check board positions, Tokens, Gate state, and shared activity.`,
      preparedAt: Date.now(),
    }
    return room
  })

  if (!result.committed) throw new Error(failureReason || 'Could not prepare the DEV Event test.')
}

export async function endPartyTurn(roomCode, playerId) {
  requireOnlineIdentity(playerId)
  const code = normalizeCode(roomCode)
  const roomRef = ref(db, `securePartyRooms/${code}`)
  let failureReason = ''

  const result = await runTransaction(roomRef, (room) => {
    if (!room) {
      failureReason = 'Party room not found.'
      return
    }

    if (room.status !== 'playing' || room.phase !== 'board') {
      failureReason = 'The board turn cannot end right now.'
      return
    }

    const order = orderedPlayerIds(room)
    const activeIndex = room.turnIndex || 0
    const activePlayerId = order[activeIndex]

    if (activePlayerId !== playerId || room.turnState?.playerId !== playerId) {
      failureReason = 'It is not your turn.'
      return
    }

    if (room.turnState?.battle && room.turnState.battle.status === 'active') {
      failureReason = 'Resolve the Battle before ending your turn.'
      return
    }

    if (room.turnState?.awaitingTrophy) {
      failureReason = 'Resolve the Trophy decision first.'
      return
    }

    if (room.turnState?.awaitingGate) {
      failureReason = 'Resolve the Garage Gate toll first.'
      return
    }

    if (room.turnState?.awaitingJackpotDecision) {
      failureReason = 'Choose whether to use Jackpot before revealing the Mechanic.'
      return
    }

    if (!room.turnState?.readyToEnd) {
      failureReason = 'Finish your roll and movement first.'
      return
    }

    if (room.turnState?.awaitingMechanicChoice) {
      failureReason = 'Choose your replacement Mechanic first.'
      return
    }

    if (room.turnState?.landingEffect && !room.turnState.landingEffect.resolved) {
      failureReason = 'Resolve the landing challenge first.'
      return
    }

    if (room.turnState?.spaceEffect && !room.turnState.spaceEffect.resolved) {
      failureReason = 'Resolve the Lucky / Bad Luck result first.'
      return
    }

    if (room.turnState?.eventEffect && !room.turnState.eventEffect.resolved) {
      failureReason = 'Resolve the Event Space first.'
      return
    }

    const priorTaken = Array.isArray(room.roundTakenPlayerIds)
      ? room.roundTakenPlayerIds.filter(Boolean)
      : room.roundTakenPlayerIds
        ? Object.values(room.roundTakenPlayerIds).filter(Boolean)
        : []
    const taken = new Set(priorTaken)
    taken.add(playerId)
    room.roundTakenPlayerIds = [...taken]

    if (taken.size < order.length) {
      const direction = room.turnDirection === -1 ? -1 : 1
      let nextIndex = activeIndex
      let foundNext = false

      for (let step = 0; step < order.length; step += 1) {
        nextIndex = (nextIndex + direction + order.length) % order.length
        const candidateId = order[nextIndex]
        if (!taken.has(candidateId)) {
          foundNext = true
          break
        }
      }

      if (foundNext) {
        room.turnIndex = nextIndex
        room.turnState = makeTurnState(order[nextIndex])
        return room
      }
    }

    const currentRound = room.currentRound || 1
    const totalRounds = room.settings?.rounds || 10

    room.turnIndex = 0
    room.roundTakenPlayerIds = []

    if (currentRound >= totalRounds) {
      room.phase = 'party-complete-test'
      room.turnState = {
        playerId: order[0],
        rolled: false,
        movementRemaining: 0,
        awaitingChoice: false,
        readyToEnd: false,
      }
      return room
    }

    room.phase = 'round-complete'
    room.turnState = {
      playerId: order[0],
      rolled: false,
      movementRemaining: 0,
      awaitingChoice: false,
      readyToEnd: false,
    }
    return room
  })

  if (!result.committed) {
    throw new Error(failureReason || 'Could not end the turn. Try again.')
  }
}

export async function beginNextPartyRound(roomCode, requesterId) {
  requireOnlineIdentity(requesterId)
  const code = normalizeCode(roomCode)
  const roomRef = ref(db, `securePartyRooms/${code}`)
  let failureReason = ''

  const result = await runTransaction(roomRef, (room) => {
    if (!room) {
      failureReason = 'Party room not found.'
      return
    }

    if (room.hostId !== requesterId) {
      failureReason = 'Only the host can begin the next round during this test.'
      return
    }

    if (room.status !== 'playing' || room.phase !== 'round-complete') {
      failureReason = 'The round is not ready to advance.'
      return
    }

    const order = orderedPlayerIds(room)
    room.currentRound = (room.currentRound || 1) + 1
    room.turnIndex = 0
    room.roundTakenPlayerIds = []
    room.phase = 'board'
    room.turnState = makeTurnState(order[0])
    return room
  })

  if (!result.committed) {
    throw new Error(failureReason || 'Could not begin the next round.')
  }
}

export async function leavePartyRoom(roomCode, playerId) {
  requireOnlineIdentity(playerId)
  const code = normalizeCode(roomCode)
  const roomRef = ref(db, `securePartyRooms/${code}`)
  const snapshot = await get(roomRef)

  if (!snapshot.exists()) return

  const room = snapshot.val()

  if (room.hostId === playerId) {
    await update(roomRef, {
      status: 'ended',
      endedAt: Date.now(),
      endedBy: playerId,
    })
    return
  }

  await update(roomRef, {
    ...releasedSeatUpdates(room, playerId),
    [`players/${playerId}`]: null,
    [`departedPlayers/${playerId}`]: {
      leftAt: Date.now(),
      reason: 'left',
    },
  })
}
