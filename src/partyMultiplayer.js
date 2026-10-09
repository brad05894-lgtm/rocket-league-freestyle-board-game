import { economySnapshot, attachEconomyPresentation } from './partyPresentation'
import { identityKey, seal, unseal } from './partyChallengeSecrets'
import { ensurePartyClock, partyNow } from './partyClock'
import { createBattle } from './partyChallengeEngine'
import { PARTY_CHALLENGES } from './partyChallengeCatalog'
import { awardPartyBonuses, addPartyStat } from './partyProgress'
import { joinProtectedRoom, requireOnlineIdentity, normalizeRoomCode, cleanPlayerName, randomRoomCode } from './onlineIdentity'
import { ref, set, get, onValue, update, runTransaction as firebaseTransaction, serverTimestamp } from 'firebase/database'
import { db } from './firebase'
import { BOOSTSTONE_RUINS } from './booststoneRuins'
import { getPartyCar, formatPartyDieFace } from './partyCars'
import { PARTY_MECHANICS, pickPartyMechanic } from './partyMechanics'
import { getEnabledPartyCards, getPartyCard, normalizePartyCards, pickPartyCard, getPartyShopCards, getPartyCardShopPrice } from './partyCards'

const PARTY_ROUNDS = [10, 15, 20]
const PARTY_MAP_ID = 'booststone-ruins'
const PARTY_BATTLE_WIN_REWARD = 8
const PARTY_BATTLE_LOSS_PENALTY = 0

// Core Party economy. The final stretch is the LAST 3 rounds. Very Bad Luck
// remains a separate LAST 5 rounds rule.
const PARTY_MECHANIC_REWARDS = Object.freeze({ Easy: 3, Medium: 6, Hard: 9, Insane: 12 })
const PARTY_FINAL_STRETCH_MECHANIC_REWARDS = Object.freeze({ Easy: 4, Medium: 8, Hard: 12, Insane: 16 })
const PARTY_DANGER_PENALTIES = Object.freeze({ Easy: 9, Medium: 6, Hard: 3, Insane: 1 })
const PARTY_FINAL_STRETCH_DANGER_PENALTIES = Object.freeze({ Easy: 12, Medium: 8, Hard: 4, Insane: 2 })

// Lucky / Bad Luck roulette pools. During the LAST FIVE rounds, every Bad
// Luck Space upgrades to the Very Bad Luck pool.
export const PARTY_LUCKY_OUTCOMES = [
  { id: 'small-cache', name: 'Small Token Cache', kind: 'tokens', amount: 2 },
  { id: 'token-cache', name: 'Token Cache', kind: 'tokens', amount: 4 },
  { id: 'big-cache', name: 'Big Token Cache', kind: 'tokens', amount: 6 },
  { id: 'jackpot-cache', name: 'Jackpot Cache', kind: 'tokens', amount: 8 },
  { id: 'free-card', name: 'Free Action Card', kind: 'draw-card' },
  { id: 'underdog-boost', name: 'Underdog Boost', kind: 'underdog' },
  { id: 'token-swipe', name: 'Token Swipe', kind: 'steal-tokens', minAmount: 4, maxAmount: 8 },
]

export const PARTY_BAD_LUCK_OUTCOMES = [
  { id: 'flat-tire', name: 'Flat Tire', kind: 'tokens', amount: -1 },
  { id: 'boost-leak', name: 'Boost Leak', kind: 'tokens', amount: -2 },
  { id: 'repair-bill', name: 'Repair Bill', kind: 'tokens', amount: -4 },
  { id: 'missed-toll', name: 'Missed Toll', kind: 'tokens', amount: -6 },
  { id: 'cracked-wheel', name: 'Cracked Wheel', kind: 'tokens', amount: -8 },
  { id: 'card-spill', name: 'Card Spill', kind: 'discard-card', count: 1, missingCardPenalty: 4 },
  { id: 'pay-everyone', name: 'Everyone Gets Paid', kind: 'give-tokens-all', amount: 4 },
  { id: 'pay-random-rival', name: 'Random Rival Payday', kind: 'give-tokens-random', minAmount: 4, maxAmount: 8 },
  { id: 'pay-last-place', name: 'Last Place Payday', kind: 'give-tokens-last', amount: 6 },
  { id: 'move-trophy', name: 'Trophy Relocation', kind: 'move-trophy' },
  { id: 'double-trophy-price', name: 'Double Trophy Price', kind: 'double-trophy-price' },
]

export const PARTY_VERY_BAD_LUCK_OUTCOMES = [
  { id: 'severe-flat-tire', name: 'Severe Flat Tire', kind: 'tokens', amount: -4 },
  { id: 'major-repair-bill', name: 'Major Repair Bill', kind: 'tokens', amount: -8 },
  { id: 'wrecked-wheel', name: 'Wrecked Wheel', kind: 'tokens', amount: -12 },
  { id: 'major-card-spill', name: 'Major Card Spill', kind: 'discard-card', count: 2, missingCardPenalty: 4 },
  { id: 'pay-everyone-big', name: 'Everyone Gets a Bigger Payday', kind: 'give-tokens-all', amount: 6 },
  { id: 'pay-random-rival-big', name: 'Random Rival Jackpot', kind: 'give-tokens-random', minAmount: 8, maxAmount: 12 },
  { id: 'pay-last-place-big', name: 'Last Place Mega Payday', kind: 'give-tokens-last', amount: 10 },
  { id: 'move-trophy-very-bad', name: 'Trophy Relocation', kind: 'move-trophy' },
  { id: 'double-trophy-price-very-bad', name: 'Double Trophy Price', kind: 'double-trophy-price' },
  { id: 'half-tokens', name: 'Token Wipeout', kind: 'half-tokens' },
  { id: 'lose-trophy', name: 'Lose a Trophy', kind: 'lose-trophy' },
  { id: 'give-trophy-random', name: 'Give Away a Trophy', kind: 'give-trophy-random' },
]

// Trophy-specific roulette outcomes can be omitted by maps with their own
// Trophy-location / Trophy-price rules.
const PARTY_TROPHY_CHAOS_OMIT_MAP_IDS = new Set([
  'kameks-tantalizing-tower',
  'kameks-tantalizing-tower-remake',
])
const PARTY_VERY_BAD_TROPHY_FALLBACK_TOKENS = 15

const PARTY_SUPPLY_CRATE_REWARDS = [
  { id: 'crate-3-tokens', name: '3 Tokens', kind: 'tokens', amount: 3 },
  { id: 'crate-5-tokens', name: '5 Tokens', kind: 'tokens', amount: 5 },
  { id: 'crate-precision-dice', name: 'Precision Dice', kind: 'card', cardId: 'precision-dice' },
  { id: 'crate-golden-teleporter', name: 'Golden Teleporter', kind: 'card', cardId: 'golden-teleporter' },
  { id: 'crate-shield', name: 'Shield', kind: 'card', cardId: 'shield' },
]

export const PARTY_BATTLES = PARTY_CHALLENGES

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

function getPartyBattleBySeed(seed = 0, allowAllPlayers = true) {
  const pool = allowAllPlayers
    ? PARTY_BATTLES
    : PARTY_BATTLES.filter((battle) => !battle.allPlayers)
  if (!pool.length) return null
  const normalized = Math.max(0, Math.min(0.999999999, Number(seed) || 0))
  return pool[Math.floor(normalized * pool.length)] || pool[0]
}

function getPartyBattleOpponent(room, challengerId, seed = 0) {
  const candidates = orderedPlayerIds(room).filter((id) => id && id !== challengerId && room.playerSetup?.[id])
  if (!candidates.length) return ''
  const normalized = Math.max(0, Math.min(0.999999999, Number(seed) || 0))
  return candidates[Math.floor(normalized * candidates.length)] || candidates[0]
}

function makePartyBattle(room, challengerId, opponentId, source, battleSeed = 0) {
  const ids = orderedPlayerIds(room).filter(id => room.players?.[id] && room.playerSetup?.[id] && !room.departedPlayers?.[id])
  if (ids.length < 2) return null
  return createBattle({ ids, hostId: room.hostId, challengerId, opponentId, source, seed: Math.floor(battleSeed * 4294967295), now: Date.now() })
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
      battle.allPlayers
        ? `${challengerName} landed on a Battle Space and drew ${battle.name} for everyone.`
        : `${challengerName} landed on a Battle Space and drew ${battle.name} against ${opponentName}.`,
      'battle'
    )
  }
  return battle
}

function eligibleTrophySpots(room = {}, excludeNodeId = '') {
  const occupied = new Set(Object.values(room.playerSetup || {})
    .filter((setup) => setup && setup.onStartDeck !== true)
    .map((setup) => setup.boardNodeId || BOOSTSTONE_RUINS.startId))
  return (BOOSTSTONE_RUINS.trophySpots || []).filter((id) =>
    id !== excludeNodeId && !occupied.has(id) && BOARD_NODE_BY_ID[id] && !['Junction','Event','Start','Shop','Paratroopa','Lakitu'].includes(BOARD_NODE_BY_ID[id].type)
  )
}

function pickTrophySpot(excludeNodeId = '', room = {}) {
  const pool = eligibleTrophySpots(room, excludeNodeId)
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : ''
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


function mechanicDeadline(room){
  const now=partyNow(),motion=room.boardMotion
  const start=typeof motion?.startedAt==='number'?motion.startedAt:now
  const end=start+Math.max(0,(motion?.path?.length||1)-1)*(motion?.stepMs||280)
  return now+90000+Math.max(0,end-now)
}

function makeLandingEffect(room, nodeId, mechanic) {
  const node = BOARD_NODE_BY_ID[nodeId]
  if (!node || !mechanic) return null
  const finalStretch = isPartyFinalThree(room)
  const difficulty = getPartyMechanicDifficulty(mechanic)
  const rewardTable = finalStretch ? PARTY_FINAL_STRETCH_MECHANIC_REWARDS : PARTY_MECHANIC_REWARDS
  const dangerTable = finalStretch ? PARTY_FINAL_STRETCH_DANGER_PENALTIES : PARTY_DANGER_PENALTIES

  if (node.type === 'Mechanic') {
    return {
      type: 'mechanic', challengeId: mechanic.id, challengeName: mechanic.name, difficulty,
      resolved: false, attemptLimit: 2, attemptsUsed: 0, deadlineAt: mechanicDeadline(room),
      reward: rewardTable[difficulty] ?? rewardTable.Medium,
      baseReward: PARTY_MECHANIC_REWARDS[difficulty] ?? PARTY_MECHANIC_REWARDS.Medium,
      finalStretch,
    }
  }
  if (node.type === 'Danger Mechanic') {
    return {
      type: 'danger-mechanic', challengeId: mechanic.id, challengeName: mechanic.name, difficulty,
      resolved: false, attemptLimit: 2, attemptsUsed: 0, deadlineAt: mechanicDeadline(room),
      penalty: dangerTable[difficulty] ?? dangerTable.Medium,
      finalStretch,
    }
  }
  return null
}

function refreshPartyLandingEconomy(room, effect) {
  if (!effect) return effect
  const finalStretch = isPartyFinalThree(room)
  const difficulty = effect.difficulty || 'Medium'
  effect.finalStretch = finalStretch
  if (effect.type === 'mechanic') {
    const table = finalStretch ? PARTY_FINAL_STRETCH_MECHANIC_REWARDS : PARTY_MECHANIC_REWARDS
    effect.reward = table[difficulty] ?? table.Medium
    effect.baseReward = PARTY_MECHANIC_REWARDS[difficulty] ?? PARTY_MECHANIC_REWARDS.Medium
  } else if (effect.type === 'danger-mechanic') {
    const table = finalStretch ? PARTY_FINAL_STRETCH_DANGER_PENALTIES : PARTY_DANGER_PENALTIES
    effect.penalty = table[difficulty] ?? table.Medium
  }
  return effect
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

    if (setup.hotStreakActive && effect.type === 'mechanic') {
      effect.hotStreakTriggered = true
      effect.attemptLimit = 1
      setup.hotStreakActive = false
    }

  }

  if(turn.hiddenGiftCheck || turn.trophyCinematic) delete effect.deadlineAt
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
  addPartyActivity(
    room,
    playerId,
    `${playerName} landed on a ${node.type} Space.`,
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
    setup.tokens = Math.max(0, Number(setup.tokens) || 0) + 2
    addPartyStat(room, playerId, 'tokensCollected', 2)
    addPartyActivity(room, playerId, `${playerName} landed on a Card Space with a full inventory and received +2 Tokens instead.`, 'card')
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
  return currentRound > Math.max(0, totalRounds - 3)
}

function isPartyFinalThree(room) {
  const totalRounds = room?.settings?.rounds || 10
  const currentRound = room?.currentRound || 1
  return currentRound > Math.max(0, totalRounds - 3)
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

function randomPartyInt(seed = 0, min = 0, max = 0, shift = 0) {
  const low = Math.ceil(Math.min(Number(min) || 0, Number(max) || 0))
  const high = Math.floor(Math.max(Number(min) || 0, Number(max) || 0))
  if (high <= low) return low
  return low + Math.floor(shiftedPartySeed(seed, shift) * (high - low + 1))
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
  if (amount > 0) addPartyStat(room, toPlayerId, 'tokensCollected', amount)
  return amount
}

function transferPartyTokensToAll(room, fromPlayerId, requestedEach, seed = 0) {
  const recipients = getPartyOpponentIds(room, fromPlayerId)
  const changes = {}
  const fromSetup = room.playerSetup?.[fromPlayerId]
  if (!recipients.length || !fromSetup) return { changes, payerLoss: 0 }
  const each = Math.max(0, Number(requestedEach) || 0)
  const totalRequired = each * recipients.length
  const available = Math.max(0, Number(fromSetup.tokens) || 0)
  const payerLoss = Math.min(available, totalRequired)
  fromSetup.tokens = available - payerLoss
  for (const recipientId of recipients) {
    const target = room.playerSetup?.[recipientId]
    if (!target) continue
    target.tokens = Math.max(0, Number(target.tokens) || 0) + each
    if (each > 0) addPartyStat(room, recipientId, 'tokensCollected', each)
    changes[recipientId] = each
  }
  return { changes, payerLoss }
}

function relocatePartyTrophy(room, seed = 0) {
  const from = room.activeTrophyNodeId || ''
  const candidates = eligibleTrophySpots(room, from)
  const to = choosePartySeeded(candidates, seed, 19) || ''
  room.activeTrophyNodeId = to
  return { from, to }
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
    const amount = playerTrophies === fewestTrophies ? 6 : 3
    setup.tokens = Math.max(0, (Number(setup.tokens) || 0) + amount)
    tokenChange = amount
    publicMessage = playerTrophies === fewestTrophies
      ? `${playerName}'s Lucky Roulette landed on Underdog Boost: +6 Tokens for being tied for the fewest Trophies.`
      : `${playerName}'s Lucky Roulette landed on Underdog Boost: +3 Tokens.`
    privateMessage = publicMessage
  } else if (outcome.kind === 'steal-tokens') {
    targetPlayerIds = getPartyOpponentIds(room, playerId)
    const swipeAmount = randomPartyInt(seed, outcome.minAmount ?? 4, outcome.maxAmount ?? 8, 17)
    publicMessage = `${playerName}'s Lucky Roulette landed on Token Swipe. ${playerName} must choose a player to steal up to ${swipeAmount} Tokens from.`
    privateMessage = publicMessage

    turn.spaceEffect = {
      rouletteSeed: seed, rouletteId: Date.now(),
      type: 'lucky', spaceType: effectiveSpaceType, id: outcome.id, kind: outcome.kind, name: outcome.name,
      resolved: false, awaitingTarget: true, amount: swipeAmount,
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
    const requestedCount = Math.max(1, Number(outcome.count) || 1)
    const discardCount = Math.min(cards.length, requestedCount)
    for (let index = 0; index < discardCount; index += 1) {
      const scaled = shiftedPartySeed(seed, 23 + index)
      const discardIndex = Math.min(cards.length - 1, Math.floor(scaled * cards.length))
      const [discardedId] = cards.splice(discardIndex, 1)
      if (discardedId) cardIds.push(discardedId)
    }
    setup.cards = cards
    cardId = cardIds[0] || ''
    const missingCards = Math.max(0, requestedCount - cardIds.length)
    const requestedTokenPenalty = missingCards * Math.max(0, Number(outcome.missingCardPenalty) || 0)
    if (requestedTokenPenalty > 0) {
      const before = Math.max(0, Number(setup.tokens) || 0)
      setup.tokens = Math.max(0, before - requestedTokenPenalty)
      tokenChange = setup.tokens - before
    }
    const discardedNames = cardIds.map((id) => getPartyCard(id)?.name || 'a Card')
    const cardText = cardIds.length
      ? (openHands ? `discarded ${discardedNames.join(' and ')}` : `discarded ${cardIds.length} random Action Card${cardIds.length === 1 ? '' : 's'}`)
      : 'had no Action Cards to discard'
    const tokenText = tokenChange < 0 ? ` and lost ${Math.abs(tokenChange)} Token${Math.abs(tokenChange) === 1 ? '' : 's'}` : ''
    publicMessage = `${playerName}'s ${rouletteLabel} landed on ${outcome.name}, ${cardText}${tokenText}.`
    privateMessage = `${playerName}'s ${rouletteLabel} landed on ${outcome.name}, ${cardIds.length ? `discarded ${discardedNames.join(' and ')}` : 'had no Action Cards to discard'}${tokenText}.`
  } else if (outcome.kind === 'give-tokens-all') {
    const payday = transferPartyTokensToAll(room, playerId, outcome.amount, seed)
    recipientTokenChanges = payday.changes
    const totalAwarded = Object.values(recipientTokenChanges).reduce((sum, amount) => sum + amount, 0)
    tokenChange = -payday.payerLoss
    targetPlayerIds = Object.keys(recipientTokenChanges)
    publicMessage = `${playerName}'s ${rouletteLabel} landed on ${outcome.name}. Every opponent received ${outcome.amount} Tokens; ${playerName} paid ${payday.payerLoss} of the ${totalAwarded}-Token total from their available balance.`
    privateMessage = publicMessage
  } else if (outcome.kind === 'give-tokens-random') {
    const opponents = getPartyOpponentIds(room, playerId)
    targetPlayerId = choosePartySeeded(opponents, seed, 29) || ''
    const requestedAmount = randomPartyInt(seed, outcome.minAmount ?? outcome.amount, outcome.maxAmount ?? outcome.amount, 31)
    const amount = targetPlayerId ? transferPartyTokens(room, playerId, targetPlayerId, requestedAmount) : 0
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
      ? `${playerName}'s ${rouletteLabel} relocated the active Trophy to a new spot on the board.`
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

  if (tokenChange > 0) addPartyStat(room, playerId, 'tokensCollected', tokenChange)

  turn.spaceEffect = {
    rouletteSeed: seed, rouletteId: Date.now(),
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
    addPartyStat(room, playerId, 'tokensCollected', amount)

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


function defaultClosedGarageGateIds() {
  return Object.fromEntries(
    (BOOSTSTONE_RUINS.garageGatePairs || []).map((pair) => [pair.id, pair.defaultClosedGateId])
  )
}

function partyShopArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (value && typeof value === 'object') return Object.values(value).filter(Boolean)
  return []
}

function partyShopSeed(text = '') {
  let hash = 2166136261
  for (const char of String(text)) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967296
}

function pickPartyActionShopStock(existing = [], count = 3, seed = 0) {
  const validIds = new Set(getPartyShopCards().map((card) => card.id))
  const stock = [...new Set(partyShopArray(existing).filter((id) => validIds.has(id)))].slice(0, count)
  const pool = [...validIds].filter((id) => !stock.includes(id))
  let pick = 0

  while (stock.length < count && pool.length) {
    const value = shiftedPartySeed(seed, 170 + pick)
    const index = Math.min(pool.length - 1, Math.floor(value * pool.length))
    stock.push(pool.splice(index, 1)[0])
    pick += 1
  }

  return stock
}

function ensurePartyActionShopState(room, boardState) {
  if (!boardState.actionShopStocks || typeof boardState.actionShopStocks !== 'object') {
    boardState.actionShopStocks = {}
  }
  if (!boardState.pendingActionShopRefills || typeof boardState.pendingActionShopRefills !== 'object') {
    boardState.pendingActionShopRefills = {}
  }

  const validIds = new Set(getPartyShopCards().map((card) => card.id))
  for (const node of BOOSTSTONE_RUINS.nodes.filter((entry) => entry.type === 'Shop')) {
    const existing = [...new Set(partyShopArray(boardState.actionShopStocks[node.id]).filter((id) => validIds.has(id)))].slice(0, 3)
    // Once somebody buys a Card, that slot intentionally stays empty until the turn ends.
    boardState.actionShopStocks[node.id] = boardState.pendingActionShopRefills[node.id]
      ? existing
      : pickPartyActionShopStock(
          existing,
          3,
          partyShopSeed(`${room.createdAt || room.startedAt || 0}:${node.id}:initial-shop-stock`)
        )
  }
}

function makePartyServiceStop(room, nodeId, type) {
  const stop = { nodeId, type }
  if (type === 'Shop') {
    const boardState = ensurePartyBoardState(room)
    stop.shopCardIds = partyShopArray(boardState.actionShopStocks?.[nodeId]).slice(0, 3)
  }
  return stop
}

function refillPendingPartyActionShops(room, seed = 0) {
  const boardState = ensurePartyBoardState(room)
  const pending = boardState.pendingActionShopRefills || {}
  let refillIndex = 0

  for (const [nodeId, shouldRefill] of Object.entries(pending)) {
    if (!shouldRefill) continue
    boardState.actionShopStocks[nodeId] = pickPartyActionShopStock(
      boardState.actionShopStocks[nodeId],
      3,
      shiftedPartySeed(seed, 300 + refillIndex)
    )
    delete pending[nodeId]
    refillIndex += 1
  }
}

function ensurePartyBoardState(room) {
  if (!room.boardState || typeof room.boardState !== 'object') room.boardState = {}
  if (!room.boardState.usedBoardEvents || typeof room.boardState.usedBoardEvents !== 'object') {
    room.boardState.usedBoardEvents = {}
  }

  const defaults = defaultClosedGarageGateIds()
  if (!room.boardState.closedGarageGateIds || typeof room.boardState.closedGarageGateIds !== 'object') {
    room.boardState.closedGarageGateIds = { ...defaults }

    // Migrate older in-progress rooms that stored only one closed gate.
    const legacyGate = (BOOSTSTONE_RUINS.gates || []).find(
      (gate) => gate.id === room.boardState.closedGarageGateId
    )
    if (legacyGate?.pairId) room.boardState.closedGarageGateIds[legacyGate.pairId] = legacyGate.id
  }

  for (const [pairId, gateId] of Object.entries(defaults)) {
    if (!room.boardState.closedGarageGateIds[pairId]) {
      room.boardState.closedGarageGateIds[pairId] = gateId
    }
  }

  // Keep the legacy value populated for compatibility with any stale client.
  room.boardState.closedGarageGateId = room.boardState.closedGarageGateIds.right || Object.values(room.boardState.closedGarageGateIds)[0] || ''
  ensurePartyActionShopState(room, room.boardState)
  return room.boardState
}

function getPartyClosedGarageGates(room) {
  const boardState = ensurePartyBoardState(room)
  const gates = BOOSTSTONE_RUINS.gates || []
  return Object.values(boardState.closedGarageGateIds || {})
    .map((id) => gates.find((gate) => gate.id === id))
    .filter(Boolean)
}

function partyGateEdgeKey(fromId, toId) {
  return `${fromId}->${toId}`
}

function getPartyClosedGateForEdge(room, fromId, toId) {
  return getPartyClosedGarageGates(room).find((gate) => {
    if (!Array.isArray(gate.between) || gate.between.length < 2) return false
    const [first, second] = gate.between
    return (first === fromId && second === toId) || (first === toId && second === fromId)
  }) || null
}

function togglePartyGarageGatePairs(room) {
  const boardState = ensurePartyBoardState(room)
  const gates = BOOSTSTONE_RUINS.gates || []

  for (const pair of BOOSTSTONE_RUINS.garageGatePairs || []) {
    const pairGateIds = [pair.forwardGateId, pair.branchGateId].filter(Boolean)
    const current = boardState.closedGarageGateIds[pair.id] || pair.defaultClosedGateId
    boardState.closedGarageGateIds[pair.id] = pairGateIds.find((id) => id !== current) || pair.defaultClosedGateId
  }

  boardState.closedGarageGateId = boardState.closedGarageGateIds.right || Object.values(boardState.closedGarageGateIds)[0] || ''
  return Object.entries(boardState.closedGarageGateIds).map(([pairId, id]) => ({
    pairId,
    gate: gates.find((gate) => gate.id === id) || null,
  }))
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
      name: 'Choose a Treasure Chest!',
      resolved: false,
      awaitingCrateChoice: true,
      crateCount: choices.length,
      crateRewardIds: choices.map((choice) => choice.id),
      animationStartedAt: serverTimestamp(),
      publicMessage: `${playerName} climbed up to the 3 Treasure Chests and must choose one without seeing the rewards.`,
      privateMessage: 'Choose Chest 1, 2, or 3. Every chest is helpful, and the reward stays hidden until it opens.',
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
      effect.animationStartedAt = serverTimestamp()
      effect.fromPositions = {}
      for (const id of orderedPlayerIds(room)) {
        const playerSetup = room.playerSetup?.[id]
        if (!playerSetup || !affectedNodes.includes(playerSetup.boardNodeId)) continue
        effect.fromPositions[id] = playerSetup.boardNodeId
        playerSetup.boardNodeId = resetTo
        affectedIds.push(id)
      }
      effect.affectedPlayerIds = affectedIds
      effect.resetTo = resetTo
      effect.tokenChanges = {}
      for (const id of affectedIds) {
        const affectedSetup = room.playerSetup?.[id]
        const before = Math.max(0, Number(affectedSetup?.tokens) || 0)
        const loss = Math.min(6, before)
        if (affectedSetup) affectedSetup.tokens = before - loss
        effect.tokenChanges[id] = -loss
      }
      const names = affectedIds.map((id) => room.players?.[id]?.name || 'Player')
      effect.publicMessage = names.length
        ? `${event.name} fired! ${names.join(', ')} ${names.length === 1 ? 'was' : 'were'} hit by the Boost Boulder, lost up to 6 Tokens, and got knocked back to the safe space before the back lane.`
        : `${event.name} fired, but nobody was caught in that reactor lane.`
      effect.privateMessage = effect.publicMessage
    }
  } else if (eventId.startsWith('gate-switch-')) {
    // Keep the pre-switch state with the event so every client can animate the
    // two gate pairs one after the other instead of both changing at once.
    const previousClosedGarageGateIds = { ...boardState.closedGarageGateIds }
    const switchedPairs = togglePartyGarageGatePairs(room)
    effect.animationStartedAt = serverTimestamp()
    effect.cameraSequence = ['right', 'left']
    effect.previousClosedGarageGateIds = previousClosedGarageGateIds
    effect.closedGarageGateIds = { ...boardState.closedGarageGateIds }
    const closed = switchedPairs
      .filter((entry) => entry.gate)
      .map((entry) => `${entry.pairId === 'right' ? 'Right' : 'Left'}: ${entry.gate.route === 'forward' ? 'forward route' : 'side route'}`)
    effect.publicMessage = switchedPairs.length
      ? `${playerName} hit a Garage Gate Event Space. Both gate pairs switched positions — ${closed.join(' • ')} now closed. Each pair still has exactly one open route and one closed route.`
      : `${playerName} hit the Garage Gate Event Space, but no Garage Gates were available.`
    effect.privateMessage = effect.publicMessage
  } else {
    setup.tokens = Math.max(0, Number(setup.tokens) || 0) + 2
    addPartyStat(room, playerId, 'tokensCollected', 2)
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
      failureReason = 'The Treasure Chest cannot be opened right now.'
      return
    }
    if (!effect || effect.id !== 'supply-crates' || effect.resolved || !effect.awaitingCrateChoice) {
      failureReason = 'There is no Treasure Chest choice waiting.'
      return
    }

    const index = Number(crateIndex)
    const rewardId = effect.crateRewardIds?.[index]
    const reward = PARTY_SUPPLY_CRATE_REWARDS.find((item) => item.id === rewardId)
    if (!reward) {
      failureReason = 'Choose one of the three Treasure Chests.'
      return
    }

    const setup = room.playerSetup?.[playerId]
    const playerName = room.players?.[playerId]?.name || 'Player'
    const openHands = room.settings?.cardVisibility === 'open'
    let message = ''
    let privateMessage = ''

    if (reward.kind === 'tokens') {
      setup.tokens = Math.max(0, Number(setup.tokens) || 0) + reward.amount
      addPartyStat(room, playerId, 'tokensCollected', reward.amount)
      effect.tokenChange = reward.amount
      message = `${playerName} opened Chest ${index + 1} and found +${reward.amount} Tokens.`
      privateMessage = message
    } else if (reward.kind === 'card') {
      const card = getPartyCard(reward.cardId)
      const cards = normalizePartyCards(setup.cards)
      if (card && cards.length < 3) {
        cards.push(card.id)
        setup.cards = cards
        effect.cardId = card.id
        message = openHands
          ? `${playerName} opened Chest ${index + 1} and found ${card.name}.`
          : `${playerName} opened Chest ${index + 1} and found an Action Card.`
        privateMessage = `${playerName} opened Chest ${index + 1} and found ${card.name}.`
      } else {
        setup.tokens = Math.max(0, Number(setup.tokens) || 0) + 2
        addPartyStat(room, playerId, 'tokensCollected', 2)
        effect.tokenChange = 2
        message = `${playerName}'s Card inventory was full, so Chest ${index + 1} converted into +2 Tokens.`
        privateMessage = card
          ? `${card.name} could not fit in your inventory, so it converted into +2 Tokens.`
          : message
      }
    }

    effect.resolved = true
    effect.awaitingCrateChoice = false
    effect.openedAt = serverTimestamp()
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
  if(landedNode?.type==='Mechanic' && room.hiddenGift) turn.hiddenGiftCheck={nodeId,landingId:`${room.currentRound}-${room.turnIndex}-${room.motionSequence||0}-${nodeId}`}
  if (landedNode?.type === 'Danger Mechanic') addPartyStat(room, playerId, 'unluckySpaces')

  if (landedNode?.type === 'Event') {
    addPartyStat(room, playerId, 'eventSpaces')
    delete turn.awaitingJackpotDecision
    delete turn.landingEffect
    addLandingActivity(room, playerId, nodeId)
    applyPartyEventLanding(room, turn, playerId, nodeId, battleOptions.eventSeed ?? battleOptions.spaceOutcomeSeed)
    return
  }

  if (landedNode?.type === 'Lucky' || landedNode?.type === 'Bad Luck') {
    if (landedNode.type === 'Bad Luck') addPartyStat(room, playerId, 'unluckySpaces')
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
      if (effect.hotStreakTriggered) modifiers.push('Hot Streak: 1 attempt, 2× Token payout on success')
      if (effect.jackpotTriggered) modifiers.push('Jackpot: 2× payout on success / lose the normal payout on failure')
    } else {
      if (effect.pressureTriggered) modifiers.push('1 attempt only')
      if (effect.noBounceRequired) modifiers.push('no bounce')
      if (effect.kph100Required) modifiers.push('100+ KPH')
      if (effect.topCornerRequired) modifiers.push('top corner')
      if (effect.hotStreakTriggered) modifiers.push('1 attempt, 2× Token payout on success')
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
  if (Array.isArray(room.playerOrder)) return room.playerOrder.filter((id) => room.players?.[id] && !room.departedPlayers?.[id])
  if (room.playerOrder) return Object.values(room.playerOrder).filter((id) => room.players?.[id] && !room.departedPlayers?.[id])

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

export function listenToPartyRoom(roomCode, callback, onError = () => {}) {
  const code = normalizeCode(roomCode)

  return onValue(ref(db, `securePartyRooms/${code}`), (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() : null)
  }, onError)
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
  await ensurePartyClock()
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
        tokens: 5,
        trophies: 0,
        boardNodeId: BOOSTSTONE_RUINS.startId,
        onStartDeck: true,
        cards: [],
      },
    ])
  )

  const activeTrophyNodeId = pickTrophySpot('', { playerSetup })
  const giftKeys=await identityKey(requesterId)
  const hiddenGift={hostId:requesterId,version:1,packet:await seal(giftKeys.publicKey,{nodeId:pickHiddenGiftSpot({playerSetup})})}

  await update(roomRef, {
    status: 'playing',
    partyStats: null,
    bonusResults: null,
    finaleStartedAt: null,
    showcaseCamera: null,
    boardMotion: null,
    motionSequence: 0,
    startedAt: Date.now(),
    currentRound: 1,
    turnIndex: 0,
    turnDirection: 1,
    roundTakenPlayerIds: [],
    phase: 'board-select',
    devBonusPreview: null,
    playerOrder,
    turnOrderRolls: {},
    turnOrderComplete: false,
    turnOrderReady: {},
    playerSetup,
    activeTrophyNodeId,
    hiddenGift,
    presentation: null,
    boardState: {
      closedGarageGateIds: Object.fromEntries(
        (BOOSTSTONE_RUINS.garageGatePairs || []).map((pair) => [pair.id, pair.defaultClosedGateId])
      ),
      closedGarageGateId: (BOOSTSTONE_RUINS.garageGatePairs || [])[0]?.defaultClosedGateId || '',
      usedBoardEvents: {},
    },
    temporaryTrophyPriceMultiplier: null,
    temporaryTrophyPriceUntil: null,
    activitySeq: 1,
    activityFeed: {
      a0001: {
        seq: 1,
        playerId: '',
        message: 'Cars selected. Choose the board before rolling for turn order.',
        type: 'system',
        createdAt: Date.now(),
      },
    },
    turnState: null,
  })
}

export async function confirmPartyBoardSelection(roomCode, playerId, mapId) {
  requireOnlineIdentity(playerId)
  if(mapId !== 'booststone-ruins') throw new Error('That board is not available yet.')
  const result=await runTransaction(ref(db, `securePartyRooms/${normalizeCode(roomCode)}`),room=>{
    if(!room || room.hostId!==playerId || room.status!=='playing' || room.phase!=='board-select')return
    room.phase='showcase'
    room.settings.mapId=mapId
    return room
  })
  if(!result.committed)throw new Error('Only the host can select the board before play.')
}

export async function rollPartyTurnOrder(roomCode, playerId) {
  requireOnlineIdentity(playerId)
  const code = normalizeCode(roomCode)
  const roomRef = ref(db, `securePartyRooms/${code}`)
  const rollSeed = Math.random()
  const tieSeed = Math.random()
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

    const roll = Math.floor(rollSeed * 6) + 1
    room.turnOrderTieBreak ||= {}
    room.turnOrderTieBreak[playerId] = tieSeed
    room.turnOrderRolls[playerId] = roll

    const playerName = room.players[playerId]?.name || 'Player'
    addPartyActivity(room, playerId, `${playerName} rolled a ${roll} for turn order.`, 'roll')

    const playerIds = Object.keys(room.players || {})
    const everyoneRolled = playerIds.every((id) => Number(room.turnOrderRolls[id]) > 0)

    if (everyoneRolled) {
      const finalOrder = [...playerIds].sort((firstId, secondId) => {
        const rollDifference = Number(room.turnOrderRolls[secondId]) - Number(room.turnOrderRolls[firstId])
        if (rollDifference !== 0) return rollDifference
        return (room.turnOrderTieBreak[firstId] || 0) - (room.turnOrderTieBreak[secondId] || 0)
      })

      room.playerOrder = finalOrder
      room.turnIndex = 0
      room.turnDirection = 1
      room.roundTakenPlayerIds = []
      room.turnOrderComplete = true
      room.turnOrderReady = {}
      room.turnState = null

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

export async function confirmPartyTurnOrder(roomCode, playerId) {
  requireOnlineIdentity(playerId)
  let failureReason = ''
  const result = await runTransaction(ref(db, `securePartyRooms/${normalizeCode(roomCode)}`), room => {
    if (!room || room.phase !== 'turn-order' || !room.turnOrderComplete || !room.players?.[playerId]) return
    const ids = orderedPlayerIds(room).filter(id => room.players?.[id])
    if (!ids.length || ids[0] !== playerId) {
      failureReason = 'Only the player going first needs to continue to the board.'
      return
    }
    room.phase = 'board'
    room.turnIndex = 0
    room.turnOrderReady = { [playerId]: true }
    room.turnState = makeTurnState(ids[0])
    return room
  })
  if (!result.committed) throw new Error(failureReason || 'Turn-order results are not available.')
}

export async function rollPartyDie(roomCode, playerId, dieType) {
  requireOnlineIdentity(playerId)
  await ensurePartyClock()
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

    const faceIndex=room.devDiceTest?.playerId===playerId&&Number.isInteger(room.devDiceTest.faceIndex)?room.devDiceTest.faceIndex:randomFaceIndex
    let face = faceIndex+1
    let movement = faceIndex+1
    let tokenChange = 0
    let selectedCar = null

    if (dieType === 'special') {
      selectedCar = getPartyCar((room.devDiceTest?.playerId===playerId&&room.devDiceTest.carId)||room.players?.[playerId]?.carId)

      const car = selectedCar

      if (!car) {
        failureReason = 'Your selected car could not be found.'
        return
      }

      face = car.specialDie[faceIndex]

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
      if (tokenChange > 0) addPartyStat(room, playerId, 'tokensCollected', tokenChange)
    }

    const previousTurn = room.turnState || makeTurnState(playerId)
    const movementBonus = Math.max(0, Number(previousTurn.pendingMovementBonus) || 0)
    const totalMovement = Math.max(0, movement + movementBonus)

    room.turnState = {
      ...previousTurn,
      playerId,
      rolled: true,
      movementStartNodeId: setup.onStartDeck ? 'start-deck' : setup.boardNodeId,
      movementSpacesTaken: 0,
      dieType,
      faceLabel: formatPartyDieFace(face),
      faceIndex,
      diceAnimation: previousTurn.diceAnimation ? {...previousTurn.diceAnimation,stoppedAt:partyNow(),faceIndex} : null,
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
    delete room.turnState.eventEffect
    delete room.turnState.awaitingService
    delete room.turnState.pendingLanding

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

    if (totalMovement === 0) { room.turnState.readyToEnd = true; room.turnState.noMovement = true }

    return room
  })

  if (!result.committed) {
    throw new Error(failureReason || 'Could not roll the die. Try again.')
  }
}

export async function continuePartyMovement(roomCode, playerId, chosenNextId = '') {
  requireOnlineIdentity(playerId)
  await ensurePartyClock()
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

    if (turn.awaitingService) { failureReason = 'Resolve this stop first.'; return }
    turn.movementStarted = true

    let currentNodeId = setup.boardNodeId || BOOSTSTONE_RUINS.startId
    let remaining = turn.movementRemaining || 0
    if (!['Junction','Shop','Paratroopa','Lakitu'].includes(BOARD_NODE_BY_ID[currentNodeId]?.type)) turn.lastLandableNodeId = currentNodeId
    let choiceUsed = false
    const path = [setup.onStartDeck ? 'start-deck' : currentNodeId]
    let openGateId = ''

    let hops = 0
    while (remaining > 0) {
      if (++hops > 256) { failureReason = 'This route could not be completed. Choose another route.'; return }
      const currentNode = BOARD_NODE_BY_ID[currentNodeId]
      const options = setup.onStartDeck ? [BOOSTSTONE_RUINS.startId] : currentNode?.next || []

      if (options.length === 0) {
        remaining = 0
        break
      }

      let nextId

      if (options.length > 1) {
        chosenNextId = chosenNextId || turn.selectedRoute || ''
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
        delete turn.selectedRoute
        choiceUsed = true
        turn.awaitingChoice = false
        delete turn.choiceNodeId
        delete turn.choices
      } else {
        nextId = options[0]
      }

      const closedGate = getPartyClosedGateForEdge(room, currentNodeId, nextId)
      const gateEdgeKey = partyGateEdgeKey(currentNodeId, nextId)
      if (closedGate && turn.gatePassApproved !== gateEdgeKey) {
        turn.awaitingGate = true
        turn.awaitingChoice = false
        turn.selectedRoute = nextId
        turn.gateId = closedGate.id
        turn.gateFromNodeId = currentNodeId
        turn.gateToNodeId = nextId
        turn.gateToll = Number(closedGate.toll) || 3
        break
      }
      if (turn.gatePassApproved === gateEdgeKey) {
        openGateId = closedGate?.id || ''
        delete turn.gatePassApproved
      }

      setup.onStartDeck = false
      currentNodeId = nextId
      path.push(nextId)
      if (!['Junction', 'Shop', 'Paratroopa', 'Lakitu'].includes(BOARD_NODE_BY_ID[nextId]?.type)) {
        remaining -= 1
        turn.lastLandableNodeId = nextId
        addPartyStat(room, playerId, 'spacesTraveled')
        turn.movementSpacesTaken = (turn.movementSpacesTaken || 0) + 1
      }
      const serviceType = BOARD_NODE_BY_ID[nextId]?.type
      if (['Shop', 'Paratroopa', 'Lakitu'].includes(serviceType)) {
        turn.awaitingService = makePartyServiceStop(room, nextId, serviceType)
        turn.awaitingChoice = false
        delete turn.choices
        break
      }

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
    if (path.length > 1) {
      room.motionSequence = (room.motionSequence || 0) + 1
      room.boardMotion = { id: room.motionSequence, playerId, path, openGateId, startedAt: serverTimestamp(), stepMs: 280 }
    }
    turn.movementRemaining = remaining

    if (remaining === 0 && !turn.awaitingTrophy && !turn.awaitingService) {
      turn.awaitingChoice = false
      delete turn.choiceNodeId
      delete turn.choices

      // Do not activate the landing while the car is still animating toward the space.
      // Store the already-generated result, then the active player's browser resolves it
      // immediately after the shared movement animation finishes. This keeps every client
      // deterministic without letting Battles, Events, roulettes, gates, or rewards jump early.
      turn.readyToEnd = false
      turn.landedNodeId = currentNodeId
      turn.landedType = BOARD_NODE_BY_ID[currentNodeId]?.type || 'Space'
      turn.pendingLanding = {
        nodeId: currentNodeId,
        mechanicId: landingMechanic?.id || '',
        cardId: landingCard?.id || '',
        battleMechanicId: landingBattleMechanic?.id || '',
        battleSeed: landingBattleSeed,
        opponentSeed: landingOpponentSeed,
        spaceOutcomeSeed: landingSpaceOutcomeSeed,
      }
    }

    room.turnState = turn
    return room
  })

  if (!result.committed) {
    throw new Error(failureReason || 'Could not move your car. Try again.')
  }
}


export async function resolvePartyPendingLanding(roomCode, playerId) {
  requireOnlineIdentity(playerId)
  const code = normalizeCode(roomCode)
  const roomRef = ref(db, `securePartyRooms/${code}`)
  let failureReason = ''

  const result = await runTransaction(roomRef, (room) => {
    if (!room || room.status !== 'playing' || room.phase !== 'board') {
      failureReason = 'The landing is not ready right now.'
      return
    }

    const order = orderedPlayerIds(room)
    const activePlayerId = order[room.turnIndex || 0]
    const turn = room.turnState
    const pending = turn?.pendingLanding

    if (activePlayerId !== playerId || turn?.playerId !== playerId) {
      failureReason = 'Only the current player can activate their landing.'
      return
    }
    if (!pending?.nodeId) {
      failureReason = 'There is no landing waiting to activate.'
      return
    }

    const mechanic = PARTY_MECHANICS.find((entry) => entry.id === pending.mechanicId) || PARTY_MECHANICS[0]
    const card = getPartyCard(pending.cardId) || null
    const battleMechanic = PARTY_MECHANICS.find((entry) => entry.id === pending.battleMechanicId) || PARTY_MECHANICS[0]
    const nodeId = pending.nodeId

    delete turn.pendingLanding
    finishLanding(room, turn, playerId, nodeId, mechanic, card, {
      battleSeed: pending.battleSeed,
      opponentSeed: pending.opponentSeed,
      battleMechanic,
      spaceOutcomeSeed: pending.spaceOutcomeSeed,
      eventSeed: pending.spaceOutcomeSeed,
    })
    room.turnState = turn
    return room
  })

  if (!result.committed) throw new Error(failureReason || 'Could not activate the landed space.')
}

export async function resolvePartyGarageGate(roomCode, playerId, payToll) {
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

    const toll = Math.max(0, Number(turn.gateToll) || 5)
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
      const fromId = turn.gateFromNodeId
      turn.awaitingChoice = true
      turn.choiceNodeId = fromId
      turn.choices = BOARD_NODE_BY_ID[fromId]?.next || []
      turn.readyToEnd = false
      for (const key of ['awaitingGate','gateId','gateFromNodeId','gateToNodeId','gateToll','gatePassApproved','selectedRoute']) delete turn[key]

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
  const nextTrophySeed = Math.random()
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

      // Select inside the transaction against the latest player positions.
      // The seed is captured outside, so retries make a consistent choice.
      const movedTrophy = relocatePartyTrophy(room, nextTrophySeed)
      turn.trophyResult = 'bought'
      turn.trophyMessage = `Bought a Trophy for ${trophyPrice} Tokens.`
      turn.trophyCinematic = { playerId, fromNodeId: movedTrophy.from, toNodeId: movedTrophy.to, startedAt: serverTimestamp() }
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
    testerSetup.onStartDeck = false
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
      instructions = `Use Token Tornado on ${targetName}. They start with 12 Tokens; the Card should roll a 4–8 Token steal and transfer that amount.`
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
    } else if (card.effect === 'hot-streak') {
      testerSetup.lastMechanicSuccess = true
      instructions = 'DEV setup marks your most recent real Mechanic as successful. Use Hot Streak before rolling. Your next normal Mechanic should have exactly 1 attempt and pay 2× on success; a miss adds no extra penalty.'
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
    } else if (card.effect === 'challenge-glove') {
      instructions = 'Use Challenge Glove, choose the Battle format, then confirm the browser privately/randomly locks the other participants and team/solo assignment before revealing the random game. Resolve it, then confirm you can still roll normally afterward.'
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
        instructions = 'A normal Mechanic is waiting before any attempt. Use Insurance: the Mechanic should immediately guarantee +3 Tokens whether you later make or miss it.'
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
    } else if (card.timing === 'after-first-miss') {
      const mechanic = pickDevMechanic('Medium')
      if (!mechanic) {
        failureReason = 'Could not prepare a DEV Mechanic first-miss state.'
        return
      }

      testerSetup.boardNodeId = dangerNodeId
      const effect = makeLandingEffect(room, dangerNodeId, mechanic)
      effect.resolved = false
      effect.success = false
      effect.attemptLimit = Math.max(2, Number(effect.attemptLimit) || 2)
      effect.attemptsUsed = 1
      effect.lastAttemptSuccess = false
      effect.resultMessage = 'DEV setup: Attempt 1 missed; Attempt 2 has not happened yet.'

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
      instructions = 'A Danger Mechanic has missed Attempt 1. Use Mulligan before Attempt 2: the same Danger Mechanic must stay active and the total attempt limit should increase from 2 to 3. No Danger penalty should be skipped or refunded.'
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
  await ensurePartyClock()
  const actionNow = partyNow()
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

    if (card.timing === 'after-first-miss') {
      const effect = turn.landingEffect
      if (!turn.rolled || !turn.readyToEnd || !effect || effect.resolved || Number(effect.attemptsUsed) !== 1 || effect.lastAttemptSuccess !== false || Number(effect.attemptLimit || 2) < 2) {
        failureReason = `${card.name} can only be used after missing Attempt 1 and before Attempt 2.`
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

      privateMessage = 'Choose the Battle format. The browser will then randomly lock the other participants and team/solo assignment before the game is revealed. You still get your normal roll afterward.'
      publicMessage = `${playerName} used Challenge Glove and is choosing the Battle format.`
      publicType = 'battle'
    } else if (card.effect === 'precision-die') {
      const value = Number(options.value)
      if (!Number.isInteger(value) || value < 1 || value > 6) {
        failureReason = 'Choose a Precision Dice result from 1 to 6.'
        return
      }

      turn.rolled = true
      turn.dieType = 'precision'
      turn.movementStartNodeId=setup.onStartDeck?'start-deck':setup.boardNodeId
      turn.movementSpacesTaken=0
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

      if(turn.diceAnimation)turn.diceAnimation={...turn.diceAnimation,stoppedAt:partyNow(),faceIndex:value-1}
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
        const requested = randomPartyInt(randomSeed, card.minAmount ?? 4, card.maxAmount ?? 8, 53)
        const stolen = Math.min(requested, Math.max(0, targetSetup.tokens || 0))
        targetSetup.tokens = Math.max(0, (targetSetup.tokens || 0) - stolen)
        setup.tokens = (setup.tokens || 0) + stolen
        if (stolen > 0) addPartyStat(room, playerId, 'tokensCollected', stolen)
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
        const wasOnDeck = setup.onStartDeck === true
        setup.onStartDeck = targetSetup.onStartDeck === true
        targetSetup.onStartDeck = wasOnDeck
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

      setup.onStartDeck = false
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
      if (!effect || effect.resolved || Number(effect.attemptsUsed) !== 1 || effect.lastAttemptSuccess !== false || Number(effect.attemptLimit || 2) < 2) {
        failureReason = 'Mulligan can only be used after missing Attempt 1 and before Attempt 2.'
        return
      }
      effect.attemptLimit = Math.max(2, Number(effect.attemptLimit) || 2) + 1
      effect.mulliganRetry = true
      turn.landingEffect = effect
      turn.mulliganUsed = true
      privateMessage = `Mulligan added one extra attempt. You now have ${effect.attemptLimit} total attempts on the same ${effect.type === 'danger-mechanic' ? 'Danger ' : ''}Mechanic.`
      publicMessage = `${playerName} used a Card to add one extra attempt to the current Mechanic.`
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
      refreshPartyLandingEconomy(room, effect)
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
      refreshPartyLandingEconomy(room, effect)
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
      if (effect.insuranceActive) {
        failureReason = 'This Mechanic is already insured.'
        return
      }

      effect.insuranceActive = true
      turn.landingEffect = effect
      privateMessage = 'Insurance is active. You gain +3 Tokens after this normal Mechanic whether you make it or miss it.'
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
      if (effect.hotStreakTriggered) {
        setup.hotStreakActive = true
        delete effect.hotStreakTriggered
        effect.attemptLimit = Math.max(2, Number(effect.attemptLimit) || 2)
      }
      const automaticReward = baseReward
      setup.tokens = (setup.tokens || 0) + automaticReward
      if (automaticReward > 0) addPartyStat(room, playerId, 'tokensCollected', automaticReward)

      effect.resolved = true
      effect.success = true
      effect.tokenChange = automaticReward
      effect.automaticCompletion = true
      // Free Pass is an automatic clear, not a mechanic the player actually made.
      // It therefore does not qualify the player to arm Hot Streak next turn.
      setup.lastMechanicSuccess = false
      effect.resultMessage = `Free Pass automatically completed ${effect.challengeName} without an attempt. +${automaticReward} Tokens.`
      effect.publicResultMessage = `An Action Card automatically completed ${effect.challengeName} without an attempt. +${automaticReward} Tokens.`
      turn.landingEffect = effect


      privateMessage = effect.resultMessage
      publicMessage = `${playerName} automatically completed ${effect.challengeName} without taking the shot and gained +${automaticReward} Tokens with a Card.`
    } else if (card.effect === 'hot-streak') {
      if (setup.hotStreakActive) {
        failureReason = 'Hot Streak is already armed for your next normal Mechanic.'
        return
      }
      if (setup.lastMechanicSuccess !== true) {
        failureReason = 'Hot Streak can only be used before rolling if you made your most recent Mechanic.'
        return
      }
      setup.hotStreakActive = true
      setup.lastMechanicSuccess = false
      privateMessage = 'Hot Streak armed. Your next normal Mechanic has 1 attempt; make it for 2× its Token payout. A miss adds no extra Hot Streak penalty.'
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
      refreshPartyLandingEconomy(room, effect)
      effect.difficultyChanged = card.effect === 'difficulty-spike' ? 'up' : 'down'
      turn.landingEffect = effect
      privateMessage = `${card.name} replaced ${oldName} with ${replacement.name} (${targetDifficulty}).`
      publicMessage = `${playerName} changed their Mechanic to a ${targetDifficulty} challenge with a Card.`
    } else if (card.effect === 'unlimited-attempts') {
      const effect = turn.landingEffect
      if (!effect || effect.resolved || !['mechanic','danger-mechanic'].includes(effect.type)) {
        failureReason = 'Use Unlimited Tries on a revealed, unresolved Mechanic.'; return
      }
      if (effect.deadlineAt && effect.deadlineAt <= actionNow) {
        failureReason = 'This Mechanic has already timed out.'; return
      }
      effect.unlimitedAttempts = true
      effect.deadlineAt ||= actionNow + 90000
      privateMessage = 'Unlimited Tries: keep attempting this Mechanic until time expires. The clock does not reset.'
      publicMessage = `${playerName} used Unlimited Tries. Complete the Mechanic before the timer ends.`
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

    if (!blockedByShield) { addPartyStat(room, playerId, 'cardsPlayed'); addPartyStat(room, playerId, 'itemsUsed') }

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
  await ensurePartyClock()
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
    refreshPartyLandingEconomy(room, turn.landingEffect)
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
  await ensurePartyClock()
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
        addPartyStat(room, playerId, 'cardsPlayed')
        addPartyStat(room, playerId, 'itemsUsed')
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


export async function startPartyMechanicTimer(roomCode,playerId){
  requireOnlineIdentity(playerId);await ensurePartyClock();const now=partyNow()
  await runTransaction(ref(db,`securePartyRooms/${normalizeCode(roomCode)}`),room=>{
    const effect=room?.turnState?.landingEffect
    if(room?.phase!=='board'||room.turnState?.playerId!==playerId||!effect||effect.resolved||effect.deadlineAt||room.turnState.hiddenGiftCheck||(room.turnState.hiddenGiftResult&&!room.turnState.hiddenGiftResult.dismissed)||partyNow()<Number(room.presentation?.endsAt||0))return
    if(!['mechanic','danger-mechanic'].includes(effect.type))return
    effect.deadlineAt=now+90000
    return room
  })
}

export async function resolvePartyMechanicLanding(roomCode, playerId, success) {
  requireOnlineIdentity(playerId)
  await ensurePartyClock()
  const actionNow = partyNow()
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
    const expired = Boolean(effect.deadlineAt && actionNow >= effect.deadlineAt)
    const madeIt = !expired && Boolean(success)
    if (effect.unlimitedAttempts && !expired) {
      effect.attemptsUsed = (Number(effect.attemptsUsed) || 0) + 1
      if (!madeIt) {
        effect.resultMessage = 'Missed — try again before time runs out.'
        effect.publicResultMessage = effect.resultMessage
        return room
      }
      effect.attemptsUsed -= 1
    }
    const attemptLimit = effect.unlimitedAttempts ? Math.max(1, (Number(effect.attemptsUsed) || 0) + 1) : Math.max(1, Number(effect.attemptLimit) || 2)
    const previousAttempts = Math.max(0, Number(effect.attemptsUsed) || 0)

    if (!effect.unlimitedAttempts && previousAttempts >= attemptLimit) {
      failureReason = 'All attempts for this Mechanic have already been used.'
      return
    }

    effect.attemptLimit = attemptLimit
    effect.attemptsUsed = previousAttempts + 1

    const playerName = room.players?.[playerId]?.name || 'Player'

    // A normal Mechanic gives two attempts by default. Cards such as Pressure
    // and Hot Streak explicitly reduce the limit to one. A miss only resolves
    // the landing after the final allowed attempt has been used.
    if (!madeIt && !expired && effect.attemptsUsed < attemptLimit) {
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
      const baseReward = effect.reward || PARTY_MECHANIC_REWARDS.Medium
      const doubleMultiplier = setup.doublePayout ? 2 : 1
      const hotMultiplier = effect.hotStreakTriggered ? 2 : 1
      const payoutWithoutJackpot = baseReward * doubleMultiplier * hotMultiplier
      const insuranceBonus = effect.insuranceActive ? 3 : 0

      if (madeIt) {
        const mechanicPayout = effect.jackpotTriggered
          ? payoutWithoutJackpot * 2
          : payoutWithoutJackpot
        actualTokenChange = mechanicPayout + insuranceBonus
        setup.tokens = (setup.tokens || 0) + actualTokenChange

        const bonusNotes = []
        if (setup.doublePayout) bonusNotes.push(`Double Payout ×2 (${baseReward}→${baseReward * 2})`)
        if (effect.hotStreakTriggered) bonusNotes.push('Hot Streak ×2')
        if (effect.jackpotTriggered) bonusNotes.push(`Jackpot ×2 (${payoutWithoutJackpot}→${mechanicPayout})`)
        if (effect.insuranceActive) bonusNotes.push('Insurance +3')
        effect.resultMessage = `Made it on attempt ${effect.attemptsUsed}! +${actualTokenChange} Tokens${bonusNotes.length ? ` (${bonusNotes.join(', ')})` : ''}.`
        effect.publicResultMessage = `Made it on attempt ${effect.attemptsUsed}! +${actualTokenChange} Tokens.`

        if (setup.doublePayout) {
          setup.doublePayout = false
          turn.lastCardUserId = playerId
          turn.lastPrivateCardMessage = `Double Payout triggered on ${effect.challengeName}.`
        }
      } else {
        let jackpotLoss = 0
        if (effect.jackpotTriggered) {
          const beforeLoss = Math.max(0, Number(setup.tokens) || 0)
          setup.tokens = Math.max(0, beforeLoss - payoutWithoutJackpot)
          jackpotLoss = beforeLoss - setup.tokens
        }

        if (insuranceBonus) setup.tokens = (setup.tokens || 0) + insuranceBonus
        actualTokenChange = insuranceBonus - jackpotLoss

        const notes = []
        if (effect.jackpotTriggered) notes.push(`Jackpot lost ${jackpotLoss} Token${jackpotLoss === 1 ? '' : 's'}`)
        if (effect.insuranceActive) notes.push('Insurance awarded +3 Tokens')
        effect.resultMessage = `Missed all ${attemptLimit} attempt${attemptLimit === 1 ? '' : 's'}.${notes.length ? ` ${notes.join('; ')}.` : ' No Tokens gained.'}`
        effect.publicResultMessage = effect.resultMessage

        if (setup.doublePayout) {
          setup.doublePayout = false
          turn.lastCardUserId = playerId
          turn.lastPrivateCardMessage = 'Double Payout was consumed by the missed Mechanic.'
        }
      }
    } else if (effect.type === 'danger-mechanic') {
      if (madeIt) {
        effect.resultMessage = `Made it on attempt ${effect.attemptsUsed}! Penalty avoided.`
        effect.publicResultMessage = effect.resultMessage
      } else {
        const requestedPenalty = effect.penalty || PARTY_DANGER_PENALTIES.Medium
        const before = Math.max(0, Number(setup.tokens) || 0)
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
    if(expired){effect.timedOut=true;effect.resultMessage='Time expired. '+effect.resultMessage;effect.publicResultMessage='Time expired. '+effect.publicResultMessage}
    effect.tokenChange = actualTokenChange
    if (actualTokenChange > 0) addPartyStat(room, playerId, 'tokensCollected', actualTokenChange)
    effect.lastAttemptSuccess = madeIt
    turn.landingEffect = effect
    setup.lastMechanicSuccess = madeIt

    if (madeIt) {
      addPartyStat(room, playerId, 'mechanicsCompleted')
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

    if (!battle || battle.stage || battle.status !== 'active') {
      failureReason = 'There is no unresolved Battle.'
      return
    }

    if (reporterId !== activePlayerId || reporterId !== battle.challengerId) {
      failureReason = 'Only the current player can report the Battle winner.'
      return
    }

    const participantIds = Array.isArray(battle.participantIds) && battle.participantIds.length
      ? battle.participantIds.filter((id) => room.playerSetup?.[id])
      : [battle.challengerId, battle.opponentId].filter((id) => room.playerSetup?.[id])

    if (!participantIds.includes(winnerId)) {
      failureReason = 'Choose a participating Battle player as the winner.'
      return
    }

    const winnerSetup = room.playerSetup?.[winnerId]
    if (!winnerSetup) {
      failureReason = 'Battle winner data could not be found.'
      return
    }

    const reward = Number(battle.rewardTokens) || PARTY_BATTLE_WIN_REWARD
    const requestedLoss = Number(battle.lossTokens) || PARTY_BATTLE_LOSS_PENALTY
    winnerSetup.tokens = (winnerSetup.tokens || 0) + reward
    addPartyStat(room, winnerId, 'tokensCollected', reward)
    addPartyStat(room, winnerId, 'minigameTokens', reward)

    const loserIds = battle.allPlayers
      ? participantIds.filter((id) => id !== winnerId)
      : [winnerId === battle.challengerId ? battle.opponentId : battle.challengerId]

    const losses = {}
    for (const loserId of loserIds) {
      const loserSetup = room.playerSetup?.[loserId]
      if (!loserSetup) continue
      const actualLoss = Math.min(requestedLoss, Math.max(0, loserSetup.tokens || 0))
      loserSetup.tokens = Math.max(0, (loserSetup.tokens || 0) - requestedLoss)
      losses[loserId] = actualLoss
    }

    battle.status = 'resolved'
    battle.winnerId = winnerId
    battle.loserId = battle.allPlayers ? '' : loserIds[0] || ''
    battle.loserIds = loserIds
    battle.rewardApplied = reward
    battle.lossApplied = battle.allPlayers ? losses : (losses[loserIds[0]] || 0)
    battle.resolvedAt = Date.now()

    if (battle.allPlayers) {
      battle.resultMessage = `${room.players?.[winnerId]?.name || 'Winner'} won ${battle.name}: +${reward} Tokens. Every other participant lost up to ${requestedLoss} Token${requestedLoss === 1 ? '' : 's'}.`
    } else {
      const loserId = loserIds[0]
      const actualLoss = losses[loserId] || 0
      battle.resultMessage = `${room.players?.[winnerId]?.name || 'Winner'} won ${battle.name}: +${reward} Tokens. ${room.players?.[loserId]?.name || 'Loser'} lost ${actualLoss} Token${actualLoss === 1 ? '' : 's'}.`
    }

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
      instructions: 'Use the Challenge controls, then confirm rewards once. The Test Lab below can select a specific game and format.',
      preparedAt: Date.now(),
    }
    return room
  })

  if (!result.committed) {
    throw new Error(failureReason || 'Could not prepare the DEV Battle test.')
  }
}

export async function preparePartyLuckDevTest(roomCode, requesterId, spaceType = 'Lucky', outcomeId = '') {
  requireOnlineIdentity(requesterId)
  const code = normalizeCode(roomCode)
  const roomRef = ref(db, `securePartyRooms/${code}`)
  const normalizedType = spaceType === 'Very Bad Luck'
    ? 'Very Bad Luck'
    : spaceType === 'Bad Luck'
      ? 'Bad Luck'
      : 'Lucky'
  const landingNodeType = normalizedType === 'Very Bad Luck' ? 'Bad Luck' : normalizedType
  const outcomePool=normalizedType==='Lucky'?PARTY_LUCKY_OUTCOMES:normalizedType==='Very Bad Luck'?PARTY_VERY_BAD_LUCK_OUTCOMES:PARTY_BAD_LUCK_OUTCOMES
  const forcedIndex=outcomePool.findIndex(o=>o.id===outcomeId)
  const outcomeSeed = forcedIndex>=0?(forcedIndex+.5)/(outcomePool.length*9973):Math.random()
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
      ? Math.max(1, totalRounds - 2)
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
    setup.onStartDeck = false
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
    const devBefore=economySnapshot(room)
    const effect = applyPartyLuckLanding(
      room,
      turn,
      requesterId,
      normalizedType,
      outcomeSeed,
      landingCard
    )

    room.turnState = turn
    attachEconomyPresentation(room,devBefore,partyNow())
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


export async function preparePartyEventDevTest(roomCode, requesterId, eventId = 'reactor-trigger-c') {
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

    ensurePartyBoardState(room)
    delete room.boardMotion

    order.forEach((id, index) => {
      const playerSetup = room.playerSetup?.[id]
      if (!playerSetup) return
      playerSetup.tokens = 12 + index
      playerSetup.trophies = index === 0 ? 1 : 0
      playerSetup.cards = []
      playerSetup.boardNodeId = BOOSTSTONE_RUINS.startId
    })

    const testerSetup = room.playerSetup[requesterId]
    testerSetup.onStartDeck = false
    testerSetup.boardNodeId = targetNode.id

    if (eventId.startsWith('reactor-trigger-')) {
      const affectedNodes = Array.isArray(event.affectedNodes) ? event.affectedNodes : []
      const otherId = order.find((id) => id !== requesterId && room.playerSetup?.[id])
      if (otherId && affectedNodes.length > 1) {
        room.playerSetup[otherId].boardNodeId = affectedNodes[1]
        room.playerSetup[otherId].onStartDeck = false
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
    const devBefore=economySnapshot(room)
    const effect = applyPartyEventLanding(room, turn, requesterId, targetNode.id, seed)
    room.turnState = turn
    attachEconomyPresentation(room,devBefore,partyNow())

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


export async function skipPartyEvent(roomCode, requesterId) {
  requireOnlineIdentity(requesterId)
  const code = normalizeCode(roomCode)
  const roomRef = ref(db, `securePartyRooms/${code}`)
  let failureReason = ''

  const result = await runTransaction(roomRef, (room) => {
    if (!room) { failureReason = 'Party room not found.'; return }
    if (room.hostId !== requesterId) { failureReason = 'Only the host can skip a stuck Event.'; return }
    const turn = room.turnState
    const effect = turn?.eventEffect
    if (room.status !== 'playing' || room.phase !== 'board' || !turn || !effect) {
      failureReason = 'There is no Event to skip right now.'
      return
    }

    effect.resolved = true
    effect.skippedByHost = true
    effect.awaitingCrateChoice = false
    delete effect.crateRewardIds
    const playerName = room.players?.[turn.playerId]?.name || 'Player'
    effect.publicMessage = `${effect.name || 'Event'} was closed by the host recovery control. Any effect that already happened stays in place.`
    effect.privateMessage = effect.publicMessage
    turn.eventEffect = effect
    if (!(turn.movementRemaining > 0) && !turn.awaitingService && !turn.awaitingGate && !turn.awaitingTrophy) turn.readyToEnd = true
    addPartyActivity(room, requesterId, `${playerName}'s Event was closed with Host Recovery.`, 'system')
    room.turnState = turn
    return room
  })

  if (!result.committed) throw new Error(failureReason || 'Could not skip that Event.')
}

export async function preparePartyServiceDevTest(roomCode, requesterId, serviceType = 'Shop') {
  requireOnlineIdentity(requesterId)
  const stockSeed=Math.random()
  const code = normalizeCode(roomCode)
  const roomRef = ref(db, `securePartyRooms/${code}`)
  const normalizedType = serviceType === 'Paratroopa' ? 'Paratroopa' : serviceType === 'Lakitu' ? 'Lakitu' : 'Shop'
  let failureReason = ''

  const result = await runTransaction(roomRef, (room) => {
    if (!room) { failureReason = 'Party room not found.'; return }
    if (room.hostId !== requesterId) { failureReason = 'Only the host can prepare a DEV service test.'; return }
    const order = orderedPlayerIds(room)
    const testerIndex = order.indexOf(requesterId)
    const node = BOOSTSTONE_RUINS.nodes.find((entry) => entry.type === normalizedType)
    if (testerIndex < 0 || !room.playerSetup?.[requesterId] || !node) {
      failureReason = `A ${normalizedType} test could not be prepared on this board.`
      return
    }

    room.status = 'playing'
    room.phase = 'board'
    room.turnIndex = testerIndex
    room.turnDirection = 1
    room.roundTakenPlayerIds = []
    delete room.devBattleTest
    delete room.devCardTest
    delete room.devSpaceTest
    delete room.devEventTest

    const boardState = ensurePartyBoardState(room)
    if (normalizedType === 'Shop') {
      delete boardState.pendingActionShopRefills?.[node.id]
      boardState.actionShopStocks[node.id] = pickPartyActionShopStock([], 3, stockSeed)
    }

    const testerSetup = room.playerSetup[requesterId]
    testerSetup.onStartDeck = false
    testerSetup.boardNodeId = node.id
    testerSetup.tokens = 50
    testerSetup.cards = []

    if (normalizedType === 'Lakitu') {
      for (const id of order) {
        if (id === requesterId || !room.playerSetup?.[id]) continue
        room.playerSetup[id].tokens = Math.max(12, Number(room.playerSetup[id].tokens) || 0)
        room.playerSetup[id].trophies = Math.max(1, Number(room.playerSetup[id].trophies) || 0)
      }
    }

    const turn = makeTurnState(requesterId)
    turn.rolled = true
    turn.dieType = 'dev'
    turn.faceLabel = 'DEV'
    turn.movementRemaining = 2
    turn.movementStarted = true
    turn.readyToEnd = false
    turn.landedNodeId = node.id
    turn.landedType = normalizedType
    turn.awaitingService = makePartyServiceStop(room, node.id, normalizedType)
    room.turnState = turn
    room.devServiceTest = {
      type: normalizedType,
      testerId: requesterId,
      instructions: normalizedType === 'Shop'
        ? 'Buy or skip one of the three stocked Cards. Verify the purchased slot stays empty until the turn ends.'
        : normalizedType === 'Paratroopa'
          ? 'Choose a Transportation destination or skip, then verify movement can continue.'
          : 'Test Token/Trophy stealing or skip, then verify costs and remaining movement.',
      preparedAt: Date.now(),
    }
    return room
  })

  if (!result.committed) throw new Error(failureReason || `Could not prepare the DEV ${normalizedType} test.`)
}

export async function endPartyTurn(roomCode, playerId) {
  requireOnlineIdentity(playerId)
  const code = normalizeCode(roomCode)
  const roomRef = ref(db, `securePartyRooms/${code}`)
  const shopRefillSeed = Math.random()
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

    if (room.turnState?.hiddenGiftCheck || (room.turnState?.hiddenGiftResult && !room.turnState.hiddenGiftResult.dismissed)) { failureReason = 'Finish the Hidden Gift first.'; return }
    if (room.turnState?.awaitingService) { failureReason = 'Resolve this stop first.'; return }

    if (room.turnState?.pendingLanding) {
      failureReason = 'Wait for your landing space to activate first.'
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

    // Reverse is retired in Party Mode. Normalize any stale room created by an
    // older build so turn progression always moves forward.
    room.turnDirection = 1

    // A bought Action Shop card leaves its slot visibly empty for the rest of
    // this turn. Refill only now, so nobody sees the replacement early.
    refillPendingPartyActionShops(room, shopRefillSeed)

    const priorTaken = Array.isArray(room.roundTakenPlayerIds)
      ? room.roundTakenPlayerIds.filter(Boolean)
      : room.roundTakenPlayerIds
        ? Object.values(room.roundTakenPlayerIds).filter(Boolean)
        : []
    const taken = new Set(priorTaken)
    taken.add(playerId)
    room.roundTakenPlayerIds = [...taken]

    if (order.some((id) => !taken.has(id))) {
      room.turnDirection = 1
      const direction = 1
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

    room.turnIndex = 0
    room.roundTakenPlayerIds = []

    room.phase = 'round-complete'
    delete room.roundBattle
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
  const categorySeed = Math.random(), bonusTieSeed = Math.random()
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
      failureReason = 'Only the host can continue after the Challenge break.'
      return
    }

    if (room.status !== 'playing' || room.phase !== 'round-complete') {
      failureReason = 'The round is not ready to advance.'
      return
    }

    if (!room.roundBattle || room.roundBattle.status !== 'resolved') { failureReason = 'Finish the round Challenge first.'; return }
    delete room.roundBattle
    const order = orderedPlayerIds(room)
    if ((room.currentRound || 1) >= (room.settings?.rounds || 10)) {
      awardPartyBonuses(room, order, categorySeed, bonusTieSeed)
      room.finaleStartedAt = serverTimestamp()
      room.phase = 'party-complete-test'
      return room
    }
    room.currentRound = (room.currentRound || 1) + 1
    room.turnDirection = 1
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
  const roomRef = ref(db, `securePartyRooms/${normalizeCode(roomCode)}`)
  const result = await runTransaction(roomRef, (room) => {
    if (!room || !room.players?.[playerId]) return
    if (room.hostId === playerId) {
      room.status = 'ended'
      room.endedAt = Date.now()
      room.endedBy = playerId
      return room
    }
    const before = orderedPlayerIds(room)
    const activeId = room.turnState?.playerId
    const name = room.players[playerId].name
    if (room.status === 'lobby') {
      for (const [seat, occupant] of Object.entries(room.seats || {})) {
        if (occupant === playerId) delete room.seats[seat]
      }
    }
    delete room.players[playerId]
    room.departedPlayers ||= {}
    room.departedPlayers[playerId] = { leftAt: Date.now(), reason: 'left' }
    const order = before.filter((id) => id !== playerId)
    room.playerOrder = order
    if (room.phase === 'turn-order') {
      if (room.turnOrderRolls) delete room.turnOrderRolls[playerId]
      if (order.every((id) => Number(room.turnOrderRolls?.[id]) > 0)) {
        order.sort((a,b) => room.turnOrderRolls[b] - room.turnOrderRolls[a])
        room.phase = 'board'
        room.turnIndex = 0
        room.turnState = makeTurnState(order[0])
      }
    } else if (room.phase === 'board') {
      if (activeId === playerId) {
        const taken = new Set(Object.values(room.roundTakenPlayerIds || {}))
        room.turnDirection = 1
        const direction = 1
        const start = before.indexOf(playerId)
        let nextId
        for (let step=1; step<=before.length; step++) {
          const candidate = before[(start + direction*step + before.length*2) % before.length]
          if (order.includes(candidate) && !taken.has(candidate)) { nextId=candidate; break }
        }
        if (!nextId) {
          room.phase = 'round-complete'
    delete room.roundBattle
          room.roundTakenPlayerIds = []
          nextId = order[0]
        }
        room.turnIndex = order.indexOf(nextId)
        room.turnState = makeTurnState(nextId)
      } else {
        room.turnIndex = Math.max(0, order.indexOf(activeId))
        const battle = room.turnState?.battle
        if (battle?.status === 'active' && (Object.values(battle.participantIds || {}).includes(playerId) || battle.opponentId === playerId)) {
          battle.status = 'resolved'
          battle.resultMessage = 'Battle cancelled because a participant left. No Tokens changed.'
          battle.resolvedAt = Date.now()
          if (battle.source !== 'challenge-glove') room.turnState.readyToEnd = true
        }
      }
    }
    if (room.phase === 'round-complete' && room.roundBattle?.status === 'active' && room.roundBattle.participantIds?.includes(playerId)) {
      room.roundBattle.status = 'resolved'
      room.roundBattle.cancelled = true
      room.roundBattle.resultMessage = 'Challenge cancelled because a participant left. No Tokens changed.'
    }
    addPartyActivity(room, playerId, `${name} left the Party game.`, 'system')
    return room
  })
  if (!result.committed) throw new Error('This Party room is no longer available.')
}


// Services pause movement; prices are centralized here for future balancing.
export const PARTY_SERVICE_PRICES = { transport: 5, stealTokens: 5, stealTrophy: 30 }
export async function resolvePartyService(roomCode, playerId, action = 'skip', targetId = '') {
  requireOnlineIdentity(playerId)
  // Keep this value stable if Firebase retries the transaction.
  const tokenStealSeed = Math.random()
  let failure = ''
  const result = await runTransaction(ref(db, `securePartyRooms/${normalizeCode(roomCode)}`), (room) => {
    const turn = room?.turnState
    const stop = turn?.awaitingService
    const setup = room?.playerSetup?.[playerId]
    if (!room || room.status !== 'playing' || room.phase !== 'board' || turn?.playerId !== playerId || !stop || !setup) return
    let cost = 0
    let message = `${room.players[playerId].name} passed the stop.`

    if (action === 'buy' && stop.type === 'Shop') {
      const boardState = ensurePartyBoardState(room)
      const stock = partyShopArray(boardState.actionShopStocks?.[stop.nodeId]).slice(0, 3)
      const card = getPartyCard(targetId)
      const cards = normalizePartyCards(setup.cards)
      const price = getPartyCardShopPrice(targetId)

      if (!card || price === null || !stock.includes(targetId) || cards.length >= 3) {
        failure = 'Choose one of the 3 Cards currently stocked here; your hand must have room.'
        return
      }

      cost = price
      if ((setup.tokens || 0) < cost) { failure = 'Not enough Tokens.'; return }

      setup.cards = [...cards, card.id]
      boardState.actionShopStocks[stop.nodeId] = stock.filter((id) => id !== targetId)
      boardState.pendingActionShopRefills[stop.nodeId] = true
      message = `${room.players[playerId].name} bought ${room.settings?.cardVisibility === 'open' ? card.name : 'an Action Card'} for ${cost} Tokens.`
    } else if (action === 'transport' && stop.type === 'Paratroopa') {
      const targetSetup = room.playerSetup?.[targetId]
      if (targetId === playerId || !room.players?.[targetId] || !targetSetup?.boardNodeId) {
        failure = 'Choose another active player to teleport to.'
        return
      }
      cost = PARTY_SERVICE_PRICES.transport
      if ((setup.tokens || 0) < cost) { failure = 'Not enough Tokens.'; return }
      setup.boardNodeId = targetSetup.boardNodeId
      setup.onStartDeck = Boolean(targetSetup.onStartDeck)
      turn.transportTargetPlayerId = targetId
      turn.transportDestinationNodeId = targetSetup.boardNodeId
      message = `${room.players[playerId].name} used Transportation for ${cost} Tokens and teleported to ${room.players[targetId].name}. The destination space does not activate.`
    } else if (['tokens', 'trophy'].includes(action) && stop.type === 'Lakitu') {
      const target = room.playerSetup?.[targetId]
      if (targetId === playerId || !room.players?.[targetId] || !target) return
      cost = action === 'tokens' ? PARTY_SERVICE_PRICES.stealTokens : PARTY_SERVICE_PRICES.stealTrophy
      if ((setup.tokens || 0) < cost) { failure = 'Not enough Tokens.'; return }
      if (action === 'trophy') {
        if (!(target.trophies > 0)) { failure = 'That player has no Trophy.'; return }
        room.rewardBeats=[{playerId:targetId,kind:'trophies',amount:-1},{playerId,kind:'tokens',amount:-cost},{playerId,kind:'trophies',amount:1}]
        target.trophies -= 1
        setup.trophies = (setup.trophies || 0) + 1
        message = `${room.players[playerId].name} paid ${cost} Tokens to steal 1 Trophy from ${room.players[targetId].name}.`
      } else {
        const requested = randomPartyInt(tokenStealSeed, 5, 15)
        const amount = Math.min(requested, Math.max(0, Number(target.tokens) || 0))
        if (!amount) { failure = 'That player has no Tokens.'; return }
        room.rewardBeats=[{playerId:targetId,kind:'tokens',amount:-amount},{playerId,kind:'tokens',amount:-cost},{playerId,kind:'tokens',amount}]
        target.tokens -= amount
        setup.tokens = (setup.tokens || 0) + amount
        addPartyStat(room, playerId, 'tokensCollected', amount)
        message = `${room.players[playerId].name} paid ${cost} Tokens and stole ${amount} Token${amount === 1 ? '' : 's'} from ${room.players[targetId].name}${amount < requested ? ` (rolled ${requested}, limited by their balance)` : ''}.`
      }
    } else if (action !== 'skip') return

    setup.tokens = Math.max(0, (setup.tokens || 0) - cost)
    delete turn.awaitingService
    if (!(turn.movementRemaining > 0)) {
      // Service teleports never activate the destination space. If movement is
      // already over, simply end the turn on the shared destination node.
      turn.readyToEnd = true
      turn.landedNodeId = setup.boardNodeId
      turn.landedType = BOARD_NODE_BY_ID[setup.boardNodeId]?.type || 'Space'
    }
    addPartyActivity(room, playerId, message, 'event')
    return room
  })
  if (!result.committed) throw new Error(failure || 'This stop is no longer available.')
}


export async function updatePartyShowcaseCamera(roomCode, playerId, camera) {
  requireOnlineIdentity(playerId)
  if (!camera || !['position', 'target'].every(key => Array.isArray(camera[key]) && camera[key].length === 3 && camera[key].every(v => Number.isFinite(v) && Math.abs(v) < 1000)) || !Number.isFinite(camera.viewHeight) || camera.viewHeight < .1 || camera.viewHeight > 200) return
  await runTransaction(ref(db, `securePartyRooms/${normalizeCode(roomCode)}`), room => {
    if (!room || room.hostId !== playerId || room.phase !== 'showcase') return
    room.showcaseCamera = camera
    return room
  }, { applyLocally: false })
}
export async function finishPartyShowcase(roomCode, playerId) {
  requireOnlineIdentity(playerId)
  const result = await runTransaction(ref(db, `securePartyRooms/${normalizeCode(roomCode)}`), room => {
    if (!room || room.hostId !== playerId || room.phase !== 'showcase') return
    room.phase = 'turn-order'
    delete room.showcaseCamera
    return room
  })
  if (!result.committed) throw new Error('Only the host can start the turn-order rolls.')
}

export async function stopPartyAtPreviousSpace(roomCode, playerId) {
  requireOnlineIdentity(playerId)
  const mechanic=pickPartyMechanic(),card=pickPartyCard(),battleMechanic=pickPartyMechanic()
  const battleSeed=Math.random(),opponentSeed=Math.random(),spaceOutcomeSeed=Math.random()
  const result=await runTransaction(ref(db,`securePartyRooms/${normalizeCode(roomCode)}`),room=>{
    const turn=room?.turnState,setup=room?.playerSetup?.[playerId]
    if(room?.status!=='playing'||room.phase!=='board'||turn?.playerId!==playerId||orderedPlayerIds(room)[room.turnIndex||0]!==playerId||!turn.awaitingChoice||turn.awaitingGate||!setup)return
    const id=turn.lastLandableNodeId,node=BOARD_NODE_BY_ID[id]
    if(!node||['Junction','Shop','Paratroopa','Lakitu'].includes(node.type))return
    setup.boardNodeId=id
    turn.movementRemaining=0
    for(const key of ['awaitingChoice','choiceNodeId','choices','selectedRoute','gatePassApproved'])delete turn[key]
    delete room.boardMotion
    if(!turn.movementSpacesTaken&&id===turn.movementStartNodeId){turn.readyToEnd=true;turn.noMovement=true}
    else finishLanding(room,turn,playerId,id,mechanic,card,{battleSeed,opponentSeed,battleMechanic,spaceOutcomeSeed,eventSeed:spaceOutcomeSeed})
    return room
  })
  if(!result.committed)throw new Error('There is no regular space to stop at from this decision.')
}

export async function preparePartyBonusDevTest(roomCode, playerId, categoryIndex=-1) {
  requireOnlineIdentity(playerId)
  if(!Number.isInteger(categoryIndex)||categoryIndex< -1||categoryIndex>6)throw new Error('Choose a valid bonus category.')
  const categorySeed=categoryIndex<0?Math.random():(categoryIndex+.5)/7,tieSeed=Math.random()
  const result=await runTransaction(ref(db,`securePartyRooms/${normalizeCode(roomCode)}`),room=>{
    if(room?.hostId!==playerId||room.status!=='playing'||room.phase!=='board'||room.turnState?.battle?.status==='active'||(room.turnState?.landingEffect?.deadlineAt&&!room.turnState.landingEffect.resolved))return
    const ids=orderedPlayerIds(room)
    const preview={players:JSON.parse(JSON.stringify(room.players)),playerSetup:JSON.parse(JSON.stringify(room.playerSetup)),partyStats:JSON.parse(JSON.stringify(room.partyStats||{})),departedPlayers:JSON.parse(JSON.stringify(room.departedPlayers||{})),finaleStartedAt:serverTimestamp()}
    awardPartyBonuses(preview,ids,categorySeed,tieSeed)
    room.devBonusPreview=preview
    return room
  })
  if(!result.committed)throw new Error('Only the host can preview bonuses during the board phase, outside an active Battle or timed Mechanic.')
}
export async function closePartyBonusDevTest(roomCode, playerId) {
  requireOnlineIdentity(playerId)
  const result=await runTransaction(ref(db,`securePartyRooms/${normalizeCode(roomCode)}`),room=>{
    if(room?.hostId!==playerId||!room.devBonusPreview)return
    delete room.devBonusPreview
    return room
  })
  if(!result.committed)throw new Error('Only the host can close the bonus preview.')
}

function runTransaction(reference, reduce, options) {
 const now=partyNow()
 return firebaseTransaction(reference,room=>{
  const before=economySnapshot(room),priorTrophy=JSON.stringify(room?.turnState?.trophyCinematic||null),priorPresentationSequence=room?.presentationSequence,phase=room?.phase,battle=JSON.stringify(room?.turnState?.battle||null)
  const dev=JSON.stringify([room?.devVisualTest,room?.devBoardCheckpoint,room?.devCardTest,room?.devEventTest,room?.devSpaceTest,room?.devServiceTest,room?.devBattleTest])
  const precisionIndex=room?.turnState?.diceAnimation?.cardIndex,oldCards=JSON.stringify(room?.playerSetup?.[room?.turnState?.playerId]?.cards)
  const next=reduce(room)
  if(next&&Number.isInteger(precisionIndex)&&next.turnState?.diceAnimation&&!next.turnState.rolled&&oldCards!==JSON.stringify(next.playerSetup?.[next.turnState.playerId]?.cards))delete next.turnState.diceAnimation
  if(next&&next.presentationSequence===priorPresentationSequence&&phase==='board'&&next.phase==='board'&&battle===JSON.stringify(next.turnState?.battle||null)&&dev===JSON.stringify([next.devVisualTest,next.devBoardCheckpoint,next.devCardTest,next.devEventTest,next.devSpaceTest,next.devServiceTest,next.devBattleTest])) attachEconomyPresentation(next,before,now,priorTrophy!==JSON.stringify(next.turnState?.trophyCinematic||null))
  return next
 },options)
}

export function hiddenGiftRank(room,playerId) {
 const a=room.playerSetup[playerId]
 return 1+orderedPlayerIds(room).filter(id=>id!==playerId).filter(id=>{
  const b=room.playerSetup[id];return (b.trophies||0)>(a.trophies||0)||((b.trophies||0)===(a.trophies||0)&&(b.tokens||0)>(a.tokens||0))
 }).length
}
export function hiddenGiftOutcome(rank,seed,amountSeed,finalStretch) {
 const trophy=seed<([.05,.10,.30,.50][Math.min(3,Math.max(0,rank-1))])
 return {kind:trophy?'trophies':'tokens',amount:trophy?1:(finalStretch?15:10)+Math.min(5,Math.floor(amountSeed*6))}
}
function pickHiddenGiftSpot(room,exclude='') {
 const occupied=new Set(Object.values(room.playerSetup||{}).filter(s=>!s.onStartDeck).map(s=>s.boardNodeId))
 const pool=BOOSTSTONE_RUINS.nodes.filter(n=>n.type==='Mechanic'&&n.id!==exclude&&n.id!==room.activeTrophyNodeId&&!occupied.has(n.id))
 return pool[Math.floor(Math.random()*pool.length)]?.id||''
}
export async function checkPartyHiddenGift(code,uid) {
 requireOnlineIdentity(uid)
 const roomRef=ref(db,`securePartyRooms/${normalizeCode(code)}`),initial=(await get(roomRef)).val()
 if(!initial||initial.hostId!==uid||!initial.turnState?.hiddenGiftCheck)return
 const check=initial.turnState.hiddenGiftCheck,playerId=initial.turnState.playerId
 let secret
 try{secret=await unseal(uid,initial.hiddenGift?.packet)}catch{secret=null}
 const found=secret?.nodeId===check.nodeId
 const keys=await identityKey(uid)
 const nextPacket=(found||!secret)?await seal(keys.publicKey,{nodeId:pickHiddenGiftSpot(initial,check.nodeId)}):null
 const reward=hiddenGiftOutcome(hiddenGiftRank(initial,playerId),Math.random(),Math.random(),isPartyFinalThree(initial))
 const now=partyNow()
 await runTransaction(roomRef,room=>{
  if(!room||room.hostId!==uid||room.hiddenGift?.version!==initial.hiddenGift?.version||room.turnState?.hiddenGiftCheck?.landingId!==check.landingId)return
  delete room.turnState.hiddenGiftCheck
  if(nextPacket)room.hiddenGift={hostId:uid,version:(room.hiddenGift?.version||0)+1,packet:nextPacket}
  if(found){
   room.turnState.hiddenGiftResult={id:check.landingId,playerId,kind:reward.kind,amount:reward.amount,startedAt:now,dismissed:false}
  }
  return room
 })
}
export async function collectPartyHiddenGift(code,uid) {
 requireOnlineIdentity(uid)
 await runTransaction(ref(db,`securePartyRooms/${normalizeCode(code)}`),room=>{
  const g=room?.turnState?.hiddenGiftResult
  if(!g||g.dismissed||g.playerId!==uid||partyNow()<g.startedAt+5200)return
  room.playerSetup[uid][g.kind]=(Number(room.playerSetup[uid][g.kind])||0)+g.amount
  if(g.kind==='tokens')addPartyStat(room,uid,'tokensCollected',g.amount)
  g.dismissed=true
  addPartyActivity(room,uid,`${room.players[uid].name} found a Hidden Gift: +${g.amount} ${g.kind==='tokens'?'Tokens':'Trophy'}!`,'event')
  return room
 })
}
export async function skipPartyHiddenGift(code,uid) {
 requireOnlineIdentity(uid)
 await runTransaction(ref(db,`securePartyRooms/${normalizeCode(code)}`),room=>{
  if(!room||room.hostId!==uid)return
  delete room.turnState.hiddenGiftCheck
  if(room.turnState.hiddenGiftResult)room.turnState.hiddenGiftResult.dismissed=true
  return room
 })
}
export async function preparePartyTrophyDevTest(code,uid) {
 requireOnlineIdentity(uid)
 const seed=Math.random()
 await runTransaction(ref(db,`securePartyRooms/${normalizeCode(code)}`),room=>{
  if(!room||room.hostId!==uid||room.phase!=='board'||room.turnState?.battle?.status==='active')return
  const before=economySnapshot(room)
  const moved=relocatePartyTrophy(room,seed)
  room.playerSetup[uid].trophies=(room.playerSetup[uid].trophies||0)+1
  room.turnState.trophyCinematic={playerId:uid,fromNodeId:moved.from,toNodeId:moved.to,startedAt:partyNow()}
  return room
 })
}

export async function beginPartyDie(code,uid,kind,cardIndex=null) {
 requireOnlineIdentity(uid)
 await ensurePartyClock()
 const now=partyNow()
 const result=await runTransaction(ref(db,`securePartyRooms/${normalizeCode(code)}`),room=>{
  const t=room?.turnState
  if(room?.phase!=='board'||t?.playerId!==uid||t.rolled||t.awaitingTrophy||t.battle?.status==='active')return
  if(!['normal','special','precision'].includes(kind))return
  if(kind==='precision'&&normalizePartyCards(room.playerSetup[uid].cards)[cardIndex]!=='precision-dice')return
  if(t.diceAnimation&&!t.diceAnimation.stoppedAt)return
  t.diceAnimation={kind,playerId:uid,startedAt:now,...(room.devDiceTest?.carId?{carId:room.devDiceTest.carId}:{}),...(kind==='precision'?{cardIndex}:{})}
  return room
 })
 if(!result.committed)throw Error('The dice cannot be opened right now.')
}

const DEV_BOARD_FIELDS=['phase','status','turnIndex','currentRound','turnDirection','roundTakenPlayerIds','playerSetup','partyStats','turnState','boardState','activeTrophyNodeId','boardMotion','presentation','presentationSequence','devDiceTest','roundBattle','temporaryTrophyPriceMultiplier','temporaryTrophyPriceUntil','hiddenGift','devBonusPreview','turnOrderComplete','turnOrderRolls','turnOrderReady','showcaseCamera']
function devCheckpoint(room){if(!room.devBoardCheckpoint)room.devBoardCheckpoint=Object.fromEntries(DEV_BOARD_FIELDS.map(k=>[k,room[k]===undefined?null:JSON.parse(JSON.stringify(room[k]))]))}
export async function savePartyDevCheckpoint(code,uid){requireOnlineIdentity(uid);await runTransaction(ref(db,`securePartyRooms/${normalizeCode(code)}`),room=>{if(!room||room.hostId!==uid)return;devCheckpoint(room);return room})}
export async function restorePartyDevCheckpoint(code,uid){requireOnlineIdentity(uid);await runTransaction(ref(db,`securePartyRooms/${normalizeCode(code)}`),room=>{
 if(!room||room.hostId!==uid||!room.devBoardCheckpoint)return
 const checkpoint=room.devBoardCheckpoint
 for(const key of DEV_BOARD_FIELDS){if(checkpoint[key]===null)delete room[key];else room[key]=checkpoint[key]}
 // Don't replay elapsed presentation or a timer that expired during a test.
 delete room.presentation;delete room.boardMotion;delete room.turnState?.diceAnimation;delete room.turnState?.trophyCinematic
 if(room.turnState?.landingEffect&&!room.turnState.landingEffect.resolved)room.turnState.landingEffect.deadlineAt=partyNow()+90000
 for(const key of ['devBoardCheckpoint','devCardTest','devSpaceTest','devEventTest','devServiceTest','devBattleTest','devVisualTest'])delete room[key]
 return room
})}
export async function recoverPartyPresentation(code,uid){requireOnlineIdentity(uid);await runTransaction(ref(db,`securePartyRooms/${normalizeCode(code)}`),room=>{
 if(!room||room.hostId!==uid)return
 delete room.presentation;delete room.turnState?.trophyCinematic;delete room.turnState?.diceAnimation
 if(room.turnState?.eventEffect){room.turnState.eventEffect.animationStartedAt=0;if(room.turnState.eventEffect.openedAt)room.turnState.eventEffect.openedAt=1}
 return room
})}
export async function preparePartyVisualDevTest(code,uid,scenario,options={}) {
 requireOnlineIdentity(uid)
 const now=partyNow(),seed=Math.random(),mechanic=PARTY_MECHANICS.find(m=>m.difficulty===(options.difficulty||'Easy'))||PARTY_MECHANICS[0]
 const allowed=['dice','precision','gain','loss','trophy-loss','gift-tokens','gift-trophy','mechanic','danger','trophy-offer','gate-choice','showcase','turn-order','bonus-tie','position']
 if(!allowed.includes(scenario))throw Error('Choose a supported Dev test.')
 const result=await runTransaction(ref(db,`securePartyRooms/${normalizeCode(code)}`),room=>{
  if(!room||room.hostId!==uid||!room.playerSetup?.[uid])return
  devCheckpoint(room)
  room.phase='board';room.status='playing';room.turnIndex=orderedPlayerIds(room).indexOf(uid)
  room.turnState=makeTurnState(uid)
  for(const key of ['presentation','boardMotion','devDiceTest','devBonusPreview','devCardTest','devSpaceTest','devEventTest','devServiceTest','devBattleTest'])delete room[key]
  const setup=room.playerSetup[uid]
  setup.boardNodeId='n01';setup.onStartDeck=false
  setup.tokens=Math.max(0,Math.min(999,Number(options.balance??20)||0))
  if(scenario==='dice'){
   if(options.carId){if(!getPartyCar(options.carId))return;room.devDiceTest={playerId:uid,carId:options.carId}}
   else room.devDiceTest={playerId:uid}
   if(Number.isInteger(options.faceIndex)&&options.faceIndex>=0&&options.faceIndex<6)room.devDiceTest.faceIndex=options.faceIndex
  }else if(scenario==='precision'){setup.cards=['precision-dice'];delete setup.lockoutActive;room.turnState.diceAnimation={kind:'precision',playerId:uid,cardIndex:0,startedAt:now}}
  else if(scenario==='gain'||scenario==='loss'||scenario==='trophy-loss'){
   if(scenario==='trophy-loss')setup.trophies=Math.max(1,setup.trophies||0)
   const before=economySnapshot(room),amount=Math.max(1,Math.min(100,Number(options.amount)||6))
   if(scenario==='trophy-loss')setup.trophies--
   else setup.tokens=scenario==='gain'?setup.tokens+amount:Math.max(0,setup.tokens-amount)
   room.turnState.rolled=true;room.turnState.readyToEnd=true
   attachEconomyPresentation(room,before,now)
  }else if(scenario.startsWith('gift-')){
   if(options.finalStretch)room.currentRound=Math.max(1,(room.settings?.rounds||10)-2)
   room.turnState.rolled=true;room.turnState.readyToEnd=true
   room.turnState.hiddenGiftResult={id:`dev-gift-${now}`,playerId:uid,kind:scenario==='gift-trophy'?'trophies':'tokens',amount:scenario==='gift-trophy'?1:randomPartyInt(seed,options.finalStretch?15:10,options.finalStretch?20:15),startedAt:now,dismissed:false}
  }else if(scenario==='mechanic'||scenario==='danger'){
   if(options.finalStretch)room.currentRound=Math.max(1,(room.settings?.rounds||10)-2);else room.currentRound=1
   const node=BOOSTSTONE_RUINS.nodes.find(n=>n.type===(scenario==='danger'?'Danger Mechanic':'Mechanic'))
   setup.boardNodeId=node.id;room.turnState.rolled=true;room.turnState.readyToEnd=true;room.turnState.landedNodeId=node.id
   attachLandingEffect(room,room.turnState,uid,node.id,mechanic)
  }else if(scenario==='trophy-offer'){
   const node=room.activeTrophyNodeId||'n01';setup.boardNodeId=node
   room.turnState.rolled=true;room.turnState.awaitingTrophy=true;room.turnState.trophyNodeId=node;room.turnState.trophyPrice=getPartyEffectiveTrophyPrice(room)
  }else if(scenario==='gate-choice'){
   setup.boardNodeId='n05';room.turnState.rolled=true;room.turnState.movementRemaining=3;room.turnState.movementStartNodeId='n04';room.turnState.movementSpacesTaken=1
   room.turnState.awaitingChoice=true;room.turnState.lastLandableNodeId='n04';room.turnState.choiceNodeId='n05';room.turnState.choices=BOARD_NODE_BY_ID.n05.next
  }else if(scenario==='position'){
   const node=BOARD_NODE_BY_ID[options.nodeId];if(!node)return
   setup.boardNodeId=node.id;setup.onStartDeck=Boolean(options.onDeck)
   room.turnState.rolled=true;room.turnState.baseMovement=Math.max(1,Math.min(20,Number(options.moves)||1));room.turnState.movementRemaining=room.turnState.baseMovement;room.turnState.movementStartNodeId=setup.onStartDeck?'start-deck':node.id
  }else if(scenario==='showcase'){room.phase='showcase';delete room.showcaseCamera}
  else if(scenario==='turn-order'){
   room.phase='turn-order';room.turnOrderComplete=false;room.turnOrderRolls={};room.turnOrderReady={}
   for(const player of Object.values(room.playerSetup))player.onStartDeck=true
  }else if(scenario==='bonus-tie'){
   const ids=orderedPlayerIds(room),preview={players:JSON.parse(JSON.stringify(room.players)),playerSetup:JSON.parse(JSON.stringify(room.playerSetup)),partyStats:{},finaleStartedAt:now}
   const category=Math.max(0,Math.min(6,Number(options.category)||0));awardPartyBonuses(preview,ids,(category+.5)/7,seed);room.devBonusPreview=preview
  }
  room.devVisualTest={scenario,preparedAt:now}
  return room
 })
 if(!result.committed)throw Error('Only the host can prepare this test in an active room.')
}
export async function configurePartyChestDev(code,uid,rewardId){
 requireOnlineIdentity(uid)
 if(!PARTY_SUPPLY_CRATE_REWARDS.some(r=>r.id===rewardId))throw Error('Choose an available chest reward.')
 await runTransaction(ref(db,`securePartyRooms/${normalizeCode(code)}`),room=>{
  if(room?.hostId!==uid||room.turnState?.eventEffect?.id!=='supply-crates'||!room.turnState.eventEffect.awaitingCrateChoice)return
  room.turnState.eventEffect.crateRewardIds=[rewardId,rewardId,rewardId];return room
 })
}

export async function configurePartyShopDev(code,uid,cardId,fullHand=false){
 requireOnlineIdentity(uid)
 const price=getPartyCardShopPrice(cardId)
 if(price===null||!getPartyCard(cardId))throw Error('This Card is not stocked by the shop.')
 await runTransaction(ref(db,`securePartyRooms/${normalizeCode(code)}`),room=>{
  const stop=room?.turnState?.awaitingService
  if(room?.hostId!==uid||stop?.type!=='Shop')return
  const boardState=ensurePartyBoardState(room);boardState.actionShopStocks[stop.nodeId]=[cardId]
  room.playerSetup[uid].tokens=Math.max(room.playerSetup[uid].tokens||0,price)
  room.playerSetup[uid].cards=fullHand?['shield','shield','shield']:[]
  return room
 })
}
