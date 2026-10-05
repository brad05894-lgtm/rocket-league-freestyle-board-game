import TokenIcon from './TokenIcon'
import './partyImmersive.css'
import PartyChallenge, { ChallengeDev } from './PartyChallenge'
import { onValue, ref as databaseRef } from 'firebase/database'
import { db } from './firebase'
import { useEffect, useMemo, useRef, useState } from 'react'
import RouletteReel from './RouletteReel'
import { BOOSTSTONE_RUINS } from './booststoneRuins'
import BooststoneRuins3D from './BooststoneRuins3D'
import { formatPartyDieFace, getPartyCar, getPartyCarImageUrl, getPartyCarImageFallback } from './partyCars'
import { getEnabledPartyCards, getPartyCard, getPartyCardShopPrice, normalizePartyCards } from './partyCards'
import {
  beginNextPartyRound,
  resolvePartyService,
  PARTY_SERVICE_PRICES,
  choosePartyMechanicChoice,
  continuePartyMovement,
  endPartyTurn,
  preparePartyBattleDevTest,
  preparePartyCardDevTest,
  preparePartyLuckDevTest,
  preparePartyEventDevTest,
  resolvePartyBattle,
  resolvePartyJackpotDecision,
  resolvePartyLuckyTokenSteal,
  resolvePartySupplyCrate,
  resolvePartyGarageGate,
  resolvePartyMechanicLanding,
  resolvePartyPendingLanding,
  resolvePartyTrophyPass,
  rollPartyDie,
  rollPartyTurnOrder,
  confirmPartyTurnOrder,
  startPartyMechanicTimer,
  usePartyCard,
  votePartyBattleMutualConcede,
  cancelPartyBattleMutualConcede,
  PARTY_BATTLES,
} from './partyMultiplayer'

const SPACE_COLORS = {
  Start: '#22c55e',
  Mechanic: '#3b82f6',
  'Danger Mechanic': '#ef4444',
  Card: '#a855f7',
  Battle: '#f59e0b',
  Event: '#22c55e',
  Lucky: '#10b981',
  'Bad Luck': '#7c3aed',
}

const PLAYER_OFFSETS = [
  [-10, -10],
  [10, -10],
  [-10, 10],
  [10, 10],
]

const TURN_ORDER_OFFSETS = [
  [-20, -38],
  [20, -38],
  [-20, 34],
  [20, 34],
]

function nodeNumber(nodeId) {
  return Number(String(nodeId || '').replace('n', '')) || 0
}

function junctionDirection(nodeMap, currentId, nextId, previousId = '') {
  const current = nodeMap[currentId]
  const next = nodeMap[nextId]
  const previous = nodeMap[previousId]
  if (!current || !next) return { label: 'PATH', symbol: '➜' }

  // If we know the direction the car entered the junction from, label each choice
  // relative to the driver's view, like Mario Party's junction arrows.
  if (previous) {
    const incoming = Math.atan2(current.y - previous.y, current.x - previous.x)
    const outgoing = Math.atan2(next.y - current.y, next.x - current.x)
    let delta = outgoing - incoming
    while (delta <= -Math.PI) delta += Math.PI * 2
    while (delta > Math.PI) delta -= Math.PI * 2
    if (Math.abs(delta) < Math.PI / 4) return { label: 'FORWARD', symbol: '↑' }
    if (delta < 0) return { label: 'LEFT', symbol: '↰' }
    return { label: 'RIGHT', symbol: '↱' }
  }

  return { label: 'PATH', symbol: '➜' }
}

function buildEdgePoints(from, to, via = []) {
  const points = [{ x: from.x, y: from.y }, ...via.map(([x, y]) => ({ x, y })), { x: to.x, y: to.y }]
  if (via.length === 0 && from.x !== to.x && from.y !== to.y) {
    return [{ x: from.x, y: from.y }, { x: to.x, y: from.y }, { x: to.x, y: to.y }]
  }
  return points
}

function edgePointString(points) {
  return points.map((point) => `${point.x},${point.y}`).join(' ')
}

function edgeArrowTransform(points) {
  const segments = []
  let total = 0
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index]
    const to = points[index + 1]
    const length = Math.hypot(to.x - from.x, to.y - from.y)
    if (length <= 0) continue
    segments.push({ from, to, length })
    total += length
  }
  if (!segments.length) return 'translate(0 0)'
  let remaining = total * 0.52
  let chosen = segments[segments.length - 1]
  for (const segment of segments) {
    if (remaining <= segment.length) {
      chosen = segment
      break
    }
    remaining -= segment.length
  }
  const ratio = Math.max(0.2, Math.min(0.8, remaining / chosen.length))
  const x = chosen.from.x + (chosen.to.x - chosen.from.x) * ratio
  const y = chosen.from.y + (chosen.to.y - chosen.from.y) * ratio
  const angle = Math.atan2(chosen.to.y - chosen.from.y, chosen.to.x - chosen.from.x) * 180 / Math.PI
  return `translate(${x} ${y}) rotate(${angle})`
}

function rouletteLabels(labels, winner, count = 5) {
  const unique = [...new Set(labels.filter(Boolean).filter((label) => label !== winner))]
  for (let index = unique.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[unique[index], unique[swapIndex]] = [unique[swapIndex], unique[index]]
  }
  const choices = [winner, ...unique.slice(0, Math.max(0, count - 1))]
  return choices.sort(() => Math.random() - 0.5)
}

function getPartyCardUseState(card, turn, isMyTurn, currentSetup, roomPhase, room, clientId) {
  if (!card) return { canUse: false, reason: 'No Card selected.' }
  if (card.enabled === false) return { canUse: false, reason: card.comingSoon || 'Not active yet.' }
  if (roomPhase !== 'board' || !isMyTurn) return { canUse: false, reason: 'Use on your turn.' }
  if (turn.battle?.status === 'active') return { canUse: false, reason: 'Resolve the current Battle first.' }
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

  if (card.timing === 'after-failed-mechanic') {
    if (
      !turn.rolled ||
      !turn.readyToEnd ||
      !turn.landingEffect?.resolved ||
      turn.landingEffect.success !== false
    ) {
      return { canUse: false, reason: 'Use after you miss this Mechanic, before ending your turn.' }
    }
  }

  if (card.timing === 'after-successful-mechanic') {
    if (!turn.landingEffect?.resolved || turn.landingEffect.success !== true) {
      return { canUse: false, reason: 'Use immediately after completing a Mechanic.' }
    }
  }

  if (card.effect === 'double-payout' && currentSetup.doublePayout) {
    return { canUse: false, reason: 'Already armed.' }
  }

  if (card.effect === 'shield' && currentSetup.shieldActive) {
    return { canUse: false, reason: 'Shield already armed.' }
  }

  if (card.effect === 'hot-streak' && currentSetup.hotStreakActive) {
    return { canUse: false, reason: 'Hot Streak already armed.' }
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
    if (currentSetup.doublePayout) {
      return { canUse: false, reason: 'Cannot combine with Double Payout.' }
    }
    if (turn.landingEffect?.jackpotTriggered) {
      return { canUse: false, reason: 'Cannot combine with Jackpot.' }
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

export default function PartyGame({ roomCode, room, clientId, onLeave, isHost }) {
  const [actionBusy, setBusy] = useState(false)
  const [motionBusy, setMotionBusy] = useState(false)
  const [clockOffset, setClockOffset] = useState(0)
  const roomMotion = room.boardMotion
  const roomMoveEnd = Number(roomMotion?.startedAt || 0) + Math.max(0, (roomMotion?.path?.length || 1) - 1) * (roomMotion?.stepMs || 280)
  const carStillMoving = Boolean(roomMotion?.playerId) && Date.now() + clockOffset < roomMoveEnd
  const movementBusy = motionBusy || carStillMoving
  const busy = actionBusy || movementBusy
  useEffect(() => onValue(databaseRef(db, '.info/serverTimeOffset'), (snapshot) => setClockOffset(Number(snapshot.val()) || 0)), [])
  useEffect(() => {
    const motion = room.boardMotion
    const moveEnd = Number(motion?.startedAt || 0) + Math.max(0, (motion?.path?.length || 1) - 1) * (motion?.stepMs || 280)
    const event = room.turnState?.eventEffect
    const ballEnd = event?.id === 'reactor-trigger-c' && Number(event.animationStartedAt)
      ? Math.max(Number(event.animationStartedAt), moveEnd) + 3200 : 0
    const remaining = Math.max(moveEnd, ballEnd) - Date.now() - clockOffset
    setMotionBusy(remaining > 0)
    if (remaining <= 0) return undefined
    const timer = window.setTimeout(() => setMotionBusy(false), Math.min(remaining, 15000))
    return () => window.clearTimeout(timer)
  }, [room.boardMotion, room.turnState?.eventEffect, clockOffset])
  const [error, setError] = useState('')
  const [selectedCardIndex, setSelectedCardIndex] = useState(null)
  const [selectedStealTargetId, setSelectedStealTargetId] = useState('')
  const [boardView, setBoardView] = useState('3d')
  const [overview, setOverview] = useState(false)
  const [hudPanel, setHudPanel] = useState(null)
  const [quality, setQuality] = useState('low')
  const [showNumbers, setShowNumbers] = useState(false)
  const immersiveRef = useRef(null)
  const [fullscreenError, setFullscreenError] = useState('')
  useEffect(() => { localStorage.setItem('party-board-view', boardView) }, [boardView])
  useEffect(() => { const old = document.body.style.overflow; document.body.style.overflow='hidden'; return () => {document.body.style.overflow=old} }, [])
  async function enterFullscreen() {
    try {if (!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();if(screen.orientation?.lock) await screen.orientation.lock('landscape').catch(()=>{});setFullscreenError('')}
    catch {setFullscreenError('Fullscreen is unavailable here. Turn your phone sideways; the board still fills the browser.')}
  }
  const [partyRoulette, setPartyRoulette] = useState(null)
  const [rollingDieType, setRollingDieType] = useState('')
  const seenRouletteKeyRef = useRef('')
  const board = BOOSTSTONE_RUINS
  const devCards = useMemo(() => getEnabledPartyCards(), [])

  const nodeMap = useMemo(
    () => Object.fromEntries(board.nodes.map((node) => [node.id, node])),
    [board]
  )

  const edges = useMemo(() => {
    const result = []
    for (const node of board.nodes) {
      for (const nextId of node.next || []) {
        const next = nodeMap[nextId]
        if (!next) continue
        const routeKey = `${node.id}->${nextId}`
        const points = buildEdgePoints(node, next, board.edgeRoutes?.[routeKey] || [])
        result.push({ id: `${node.id}-${nextId}`, from: node, to: next, points })
      }
    }
    return result
  }, [board, nodeMap])

  const players = useMemo(() => {
    const order = Array.isArray(room.playerOrder)
      ? room.playerOrder
      : room.playerOrder
        ? Object.values(room.playerOrder)
        : Object.values(room.players || {})
            .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0))
            .map((player) => player.id)

    return order
      .map((id) => room.players?.[id])
      .filter(Boolean)
  }, [room])

  const activePlayer = players[room.turnIndex || 0] || null
  const currentPlayer = room.players?.[clientId] || null
  const currentCar = getPartyCar(currentPlayer?.carId)
  const activeCar = getPartyCar(activePlayer?.carId)
  const turn = room.turnState || {}
  const isTurnOrderPhase = room.phase === 'turn-order'
  const turnOrderRolls = room.turnOrderRolls || {}
  const myTurnOrderRoll = Number(turnOrderRolls[clientId]) || 0
  const isMyTurn = room.phase === 'board' && activePlayer?.id === clientId
  const currentSetup = room.playerSetup?.[clientId] || {}
  const activeSetup = activePlayer ? room.playerSetup?.[activePlayer.id] || {} : {}
  const battle = turn.battle || null
  const battleChallenger = battle ? room.players?.[battle.challengerId] || null : null
  const battleOpponent = battle ? room.players?.[battle.opponentId] || null : null
  const battleParticipants = battle
    ? (battle.participantIds || [battle.challengerId, battle.opponentId])
        .map((id) => room.players?.[id])
        .filter(Boolean)
    : []
  const isBattleParticipant = Boolean(
    battle && (battle.participantIds || [battle.challengerId, battle.opponentId]).includes(clientId)
  )
  const battleConcedeVotes = battle?.mutualConcedeVotes || {}
  const activeNode = nodeMap[activeSetup.boardNodeId || board.startId]
  const activeTrophyNode = nodeMap[room.activeTrophyNodeId] || null
  const defaultClosedGarageGateIds = Object.fromEntries(
    (board.garageGatePairs || []).map((pair) => [pair.id, pair.defaultClosedGateId])
  )
  const closedGarageGateState = { ...defaultClosedGarageGateIds, ...(room.boardState?.closedGarageGateIds || {}) }
  if (room.boardState?.closedGarageGateId && !room.boardState?.closedGarageGateIds) {
    const legacyGate = board.gates?.find((gate) => gate.id === room.boardState.closedGarageGateId)
    if (legacyGate?.pairId) closedGarageGateState[legacyGate.pairId] = legacyGate.id
  }
  const closedGarageGateIds = Object.values(closedGarageGateState).filter(Boolean)
  const closedGarageGates = closedGarageGateIds
    .map((id) => board.gates?.find((gate) => gate.id === id))
    .filter(Boolean)
  const totalRounds = room.settings?.rounds || 10
  const currentRound = room.currentRound || 1
  const finalFive = currentRound > Math.max(0, totalRounds - 5)
  const baseTrophyPrice = room.settings?.trophyPrice ?? board.defaultTrophyPrice
  const trophyPrice = Math.max(
    0,
    Math.round(baseTrophyPrice * Math.max(1, Number(room.temporaryTrophyPriceMultiplier) || 1))
  )
  const cardVisibility = (
    room.settings?.cardVisibility === 'open' ||
    room.settings?.handVisibility === 'open' ||
    room.settings?.openHands === true
  ) ? 'open' : 'hidden'
  const openHands = cardVisibility === 'open'

  useEffect(() => {
    // Never start the Battle selection overlay while the car is still visibly moving.
    if (movementBusy || battle?.status !== 'active' || battle.stage) return
    const key = `battle-${room.currentRound}-${room.turnIndex}-${battle.id}-${battle.opponentId}`
    if (seenRouletteKeyRef.current === key) return
    seenRouletteKeyRef.current = key
    setPartyRoulette({
      phase: 'battle',
      title: 'Selecting Battle',
      winner: battle.name,
      options: rouletteLabels(PARTY_BATTLES.map((entry) => entry.name), battle.name),
      opponentName: room.players?.[battle.opponentId]?.name || 'Opponent',
      opponentOptions: battle.allPlayers || battle.source === 'challenge-glove'
        ? []
        : players
            .filter((player) => player.id !== battle.challengerId)
            .map((player) => player.name),
    })
  }, [battle, room.currentRound, room.turnIndex, room.players, players, movementBusy])

  // Event spaces are fixed by their physical board location. There is no Event roulette:
  // Garage-Gate Event spaces always trigger the gate switch, and the back Boost-Boulder
  // lane Event spaces always trigger the rolling-ball event.

  function completePartyRoulette(roulette) {
    if (roulette.phase === 'battle' && roulette.opponentOptions?.length) {
      setPartyRoulette({
        phase: 'opponent',
        title: 'Selecting Opponent',
        winner: roulette.opponentName,
        options: roulette.opponentOptions,
      })
      return
    }
    setPartyRoulette(null)
  }
  const currentCardIds = normalizePartyCards(currentSetup.cards)
  const selectedCardId = Number.isInteger(selectedCardIndex) ? currentCardIds[selectedCardIndex] : null
  const selectedCard = getPartyCard(selectedCardId)
  const cardTargets = players.filter((player) => {
    if (player.id === clientId) return false
    const setup = room.playerSetup?.[player.id] || {}

    if (selectedCard?.effect === 'steal-card') {
      return normalizePartyCards(setup.cards).length > 0
    }
    if (selectedCard?.effect === 'pressure') return !setup.pressureActive
    if (selectedCard?.effect === 'zero-bounce') return !setup.noBounceActive
    if (selectedCard?.effect === '100-kph') return !setup.kph100Active
    if (selectedCard?.effect === 'top-corner') return !setup.topCornerActive
    if (selectedCard?.effect === 'lockout') return !setup.lockoutActive

    return true
  })

  const activityEntries = useMemo(
    () => Object.values(room.activityFeed || {})
      .sort((first, second) => (second.seq || 0) - (first.seq || 0))
      .slice(0, 6),
    [room.activityFeed]
  )

  async function runAction(action) {
    if (busy) return
    try {
      setBusy(true)
      setError('')
      await action()
    } catch (actionError) {
      setError(actionError.message || 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  async function handleTurnOrderRoll() {
    await runAction(() => rollPartyTurnOrder(roomCode, clientId))
  }

  async function handleRoll(dieType) {
    setRollingDieType(dieType)
    window.setTimeout(() => setRollingDieType(''), 720)
    await runAction(() => rollPartyDie(roomCode, clientId, dieType))
  }

  async function handleMove(chosenNextId = '') {
    await runAction(() => continuePartyMovement(roomCode, clientId, chosenNextId))
  }

  async function handleTrophyDecision(buyTrophy) {
    await runAction(() => resolvePartyTrophyPass(roomCode, clientId, buyTrophy))
  }

  async function handleMechanicResult(success) {
    await runAction(() => resolvePartyMechanicLanding(roomCode, clientId, success))
  }

  async function handleJackpotDecision(useJackpot) {
    setSelectedCardIndex(null)
    setSelectedStealTargetId('')
    await runAction(() => resolvePartyJackpotDecision(roomCode, clientId, useJackpot))
  }

  async function handleMechanicChoice(choiceIndex) {
    await runAction(() => choosePartyMechanicChoice(roomCode, clientId, choiceIndex))
  }

  async function handleUseCard(options = {}) {
    if (!Number.isInteger(selectedCardIndex)) return
    await runAction(() => usePartyCard(roomCode, clientId, selectedCardIndex, options))
    if(selectedCard?.effect === 'unlimited-attempts')setHudPanel('turn')
    setSelectedCardIndex(null)
    setSelectedStealTargetId('')
  }

  async function handleUseCardOnRandomTarget() {
    if (!cardTargets.length) return
    const randomTarget = cardTargets[Math.floor(Math.random() * cardTargets.length)]

    if (openHands && selectedCard?.effect === 'steal-card') {
      setSelectedStealTargetId(randomTarget.id)
      return
    }

    await handleUseCard({ targetId: randomTarget.id })
  }

  async function handleStealTarget(playerId) {
    if (openHands) {
      setSelectedStealTargetId(playerId)
      return
    }

    await handleUseCard({ targetId: playerId })
  }

  async function handlePrepareCardTest(cardId) {
    setSelectedCardIndex(null)
    setSelectedStealTargetId('')
    await runAction(() => preparePartyCardDevTest(roomCode, clientId, cardId))
  }

  async function handlePrepareBattleTest() {
    setSelectedCardIndex(null)
    setSelectedStealTargetId('')
    await runAction(() => preparePartyBattleDevTest(roomCode, clientId))
  }

  async function handlePrepareLuckTest(spaceType) {
    setSelectedCardIndex(null)
    setSelectedStealTargetId('')
    await runAction(() => preparePartyLuckDevTest(roomCode, clientId, spaceType))
  }

  async function handleLuckyTokenSteal(targetId = '') {
    await runAction(() => resolvePartyLuckyTokenSteal(roomCode, clientId, targetId))
  }

  async function handleSupplyCrate(crateIndex) {
    await runAction(() => resolvePartySupplyCrate(roomCode, clientId, crateIndex))
  }

  async function handleGarageGate(payToll) {
    await runAction(() => resolvePartyGarageGate(roomCode, clientId, payToll))
  }

  async function handlePrepareEventTest(eventId) {
    setSelectedCardIndex(null)
    setSelectedStealTargetId('')
    await runAction(() => preparePartyEventDevTest(roomCode, clientId, eventId))
  }

  async function handleBattleWinner(winnerId) {
    await runAction(() => resolvePartyBattle(roomCode, clientId, winnerId))
  }

  async function handleBattleConcedeVote() {
    await runAction(() => votePartyBattleMutualConcede(roomCode, clientId))
  }

  async function handleBattleConcedeCancel() {
    await runAction(() => cancelPartyBattleMutualConcede(roomCode, clientId))
  }

  async function handleEndTurn() {
    await runAction(() => endPartyTurn(roomCode, clientId))
  }

  async function handleNextRound() {
    await runAction(() => beginNextPartyRound(roomCode, clientId))
  }

  const [mechanicNow, setMechanicNow] = useState(Date.now())
  const mechanicDeadline = turn.landingEffect?.deadlineAt
  useEffect(()=>{
    if(isMyTurn && turn.landingEffect && !turn.landingEffect.resolved && !mechanicDeadline && !actionBusy && !movementBusy)
      runAction(()=>startPartyMechanicTimer(roomCode,clientId))
  },[isMyTurn,turn.landingEffect?.challengeId,turn.landingEffect?.resolved,mechanicDeadline,movementBusy])
  useEffect(() => {
    if (!mechanicDeadline || turn.landingEffect?.resolved) return
    const tick=()=>setMechanicNow(Date.now()+clockOffset)
    tick();const timer=setInterval(tick,250);return()=>clearInterval(timer)
  },[mechanicDeadline,turn.landingEffect?.resolved,clockOffset])
  useEffect(() => {
    if(isMyTurn && mechanicDeadline && mechanicNow>=mechanicDeadline && !turn.landingEffect?.resolved && !actionBusy) runAction(()=>resolvePartyMechanicLanding(roomCode,clientId,false))
  },[mechanicNow,mechanicDeadline,isMyTurn,turn.landingEffect?.resolved,actionBusy])
  useEffect(() => {
    if (!isMyTurn || movementBusy || actionBusy || !turn.pendingLanding?.nodeId) return
    runAction(() => resolvePartyPendingLanding(roomCode, clientId))
  }, [isMyTurn, movementBusy, actionBusy, turn.pendingLanding?.nodeId, roomCode, clientId])

  const [mapCenter, setMapCenter] = useState({x:activeNode?.x||board.width/2,y:activeNode?.y||board.height/2})
  const promptKey = JSON.stringify([room.phase,turn.playerId,turn.rolled,turn.awaitingChoice,turn.awaitingTrophy,turn.awaitingGate,turn.awaitingService,turn.awaitingJackpotDecision,turn.landingEffect?.resolved,turn.spaceEffect?.resolved,turn.eventEffect?.resolved,turn.pendingLanding?.nodeId,turn.readyToEnd])
  useEffect(() => { if(movementBusy)setHudPanel(null);else if (battle?.status!=='active' && room.phase!=='round-complete') setHudPanel('turn') }, [promptKey,movementBusy,battle?.status])
  useEffect(() => { setOverview(false) }, [turn.playerId,room.currentRound])
  useEffect(() => {
    const update=()=>{const m=room.boardMotion;const path=m?.playerId===activePlayer?.id?m.path||[]:[];const index=Math.max(0,Math.floor((Date.now()+clockOffset-Number(m?.startedAt||0))/(m?.stepMs||280)));const n=path.length?nodeMap[path[Math.min(index,path.length-1)]]:activeNode;if(n)setMapCenter({x:n.x,y:n.y})}
    update();if(!motionBusy)return;const timer=setInterval(update,70);return()=>clearInterval(timer)
  },[room.boardMotion,activePlayer?.id,activeNode,motionBusy,clockOffset,nodeMap])
  const fullBox=board.viewBox||{x:0,y:0,width:board.width,height:board.height}
  const boardBox=overview?`${fullBox.x} ${fullBox.y} ${fullBox.width} ${fullBox.height}`:`${mapCenter.x-230} ${mapCenter.y-140} 460 280`
  const orderResults = isTurnOrderPhase && room.turnOrderComplete
  const battleLocked=battle?.status==='active'||room.phase==='round-complete'||orderResults
  return (
    <div ref={immersiveRef} className="game party-game-screen party-immersive" data-panel={hudPanel||'none'}>
      {partyRoulette && !movementBusy && (
        <div className="party-roulette-overlay">
          <div className="game-modal-card selection-roulette">
            <RouletteReel
              key={`${partyRoulette.phase}-${partyRoulette.winner}`}
              title={partyRoulette.title}
              options={partyRoulette.options}
              winner={partyRoulette.winner}
              onComplete={() => completePartyRoulette(partyRoulette)}
              canContinue={isMyTurn}
              autoContinue={!isMyTurn}
              waitingText={`Waiting for ${activePlayer?.name || 'the current player'} to continue…`}
            />
          </div>
        </div>
      )}
      <div className="party-hud" inert={battleLocked?true:undefined}>
        <header className="party-hud-top">
          <div className="party-hud-round"><strong>{isTurnOrderPhase?'Starting order':`Round ${room.currentRound||1} / ${room.settings?.rounds||10}`}</strong><small>Room {roomCode} · {openHands?'Open':'Hidden'} Hands</small></div>
          <div className="party-hud-standings">{players.map(player=>{const score=room.playerSetup?.[player.id]||{};const car=getPartyCar(player.carId);return <button key={player.id} className={player.id===activePlayer?.id?'active':''} onClick={()=>setHudPanel(hudPanel==='players'?null:'players')}><img src={getPartyCarImageUrl(car)} alt=""/><span><strong>{player.name}</strong><small>🏆 {score.trophies||0} · <TokenIcon/> {score.tokens??5}</small></span></button>})}</div>
        </header>
        <nav className="party-hud-menu" aria-label="Game controls">
          <button aria-pressed={hudPanel==='turn'} onClick={()=>setHudPanel(hudPanel==='turn'?null:'turn')}>🎲 {isMyTurn&&!turn.rolled?'Dice':'Turn'}</button>
          <button aria-pressed={hudPanel==='cards'} onClick={()=>setHudPanel(hudPanel==='cards'?null:'cards')}>▣ Action Cards <small>{currentCardIds.length}/3</small></button>
          <button aria-pressed={overview} onClick={()=>{setOverview(!overview);setHudPanel(null)}}>{overview?'↘ Follow Player':'▦ Board'}</button>
          <button onClick={()=>setHudPanel(hudPanel==='log'?null:'log')}>Activity</button>
          <button onClick={()=>setHudPanel(hudPanel==='settings'?null:'settings')}>Settings</button>
          {isHost&&<button onClick={()=>setHudPanel(hudPanel==='dev'?null:'dev')}>Dev</button>}
        </nav>
        <footer className="party-hud-footer"><strong>{activePlayer?.name||'Players'}{movementBusy?' is moving…':isMyTurn?' · Your turn':' · Current turn'}</strong><span>🏆 Trophy: Space {activeTrophyNode?nodeNumber(activeTrophyNode.id):'…'} · {trophyPrice} Tokens</span></footer>
      </div>
      <div className="party-rotate-hint">Turn your phone sideways for the full board experience.</div>
      {room.phase === 'board' && !movementBusy && turn.awaitingChoice && battle?.status !== 'active' && (() => {
        const currentId = turn.choiceNodeId || activeSetup.boardNodeId
        const motionPath = Array.isArray(room.boardMotion?.path) ? room.boardMotion.path : []
        const previousId = motionPath.at(-1) === currentId ? motionPath.at(-2) : ''
        return (
          <div className="party-junction-overlay" role="dialog" aria-modal="true" aria-label="Choose a path">
            <section className="party-junction-card">
              <p className="home-mode-card__eyebrow">Junction</p>
              <h2>{isMyTurn ? 'Which way do you want to go?' : `${activePlayer?.name || 'The current player'} is choosing a path…`}</h2>
              <p><strong>{turn.movementRemaining}</strong> move{turn.movementRemaining === 1 ? '' : 's'} remaining after this junction.</p>
              <div className="party-junction-arrows">
                {(turn.choices || []).map((nextId) => {
                  const nextNode = nodeMap[nextId]
                  const direction = junctionDirection(nodeMap, currentId, nextId, previousId)
                  const gate = board.gates?.find((candidate) =>
                    Array.isArray(candidate.between) && candidate.between.includes(currentId) && candidate.between.includes(nextId)
                  )
                  const blocked = Boolean(gate && closedGarageGateIds.includes(gate.id))
                  return (
                    <button
                      type="button"
                      key={nextId}
                      className={`party-junction-arrow party-junction-arrow--${direction.label.toLowerCase()}`}
                      onClick={() => isMyTurn && handleMove(nextId)}
                      disabled={busy || !isMyTurn}
                    >
                      <span className="party-junction-arrow__symbol" aria-hidden="true">{direction.symbol}</span>
                      <strong>{direction.label}</strong>
                      <small>
                        Space {nodeNumber(nextId)} · {nextNode?.type === 'Bad Luck' && finalFive ? 'Very Bad Luck' : nextNode?.type || 'Space'}
                      </small>
                      {gate && <small className={blocked ? 'party-junction-gate is-closed' : 'party-junction-gate is-open'}>{blocked ? `🚧 CLOSED · ${gate.toll || 3} Tokens to pass` : '✓ Garage Gate OPEN'}</small>}
                    </button>
                  )
                })}
              </div>
              {!isMyTurn && <small>Only {activePlayer?.name || 'the current player'} can choose.</small>}
            </section>
          </div>
        )
      })()}
      {orderResults&&<div className="bc-backdrop"><section className="bc-dialog party-order-results" role="dialog" aria-modal="true" aria-label="Turn order results"><h1>Turn order is set!</h1><p>Everyone starts on the deck. Your first movement point reaches the first blue Mechanic space.</p><ol>{players.map((player,index)=><li key={player.id}><strong>{player.name}</strong><span>🎲 {turnOrderRolls[player.id]}</span><small>{index===0?'Goes first':'Turn order locked'}</small></li>)}</ol><p>Equal rolls use a random tiebreak. Only the player going first needs to continue.</p>{players[0]?.id===clientId?<button disabled={actionBusy} onClick={()=>runAction(()=>confirmPartyTurnOrder(roomCode,clientId))}>Continue to Board</button>:<p>Waiting for <strong>{players[0]?.name||'the first player'}</strong> to continue…</p>}{error&&<p role="alert">{error}</p>}</section></div>}
      {!movementBusy&&(battle?.status==='active'||room.phase==='round-complete')&&<PartyChallenge room={room} roomCode={roomCode} clientId={clientId} onNextRound={handleNextRound}/>}
      <div className="party-game-layout">
        <section className="party-game-board-card party-game-board-card--ruins">
          {true && (
            <BooststoneRuins3D
              overview={overview||boardView==='2d'} topDown={boardView==='2d'} quality={quality} showNumbers={showNumbers}
              board={board}
              room={room}
              players={players}
              activePlayer={activePlayer}
              finalFive={finalFive}
              closedGarageGateIds={closedGarageGateIds}
              turnOrderPhase={isTurnOrderPhase}
              turnOrderRolls={turnOrderRolls}
            />
          )}

        </section>

        <aside className="party-turn-panel" inert={battleLocked?true:undefined} aria-label="Game overlay">
          <header className="party-panel-header"><strong>{({turn:'Your turn',cards:'Action Cards',players:'Standings',log:'Activity',dev:'Dev Test Lab',settings:'Settings'})[hudPanel]||'Game'}</strong><button aria-label="Close overlay" onClick={()=>setHudPanel(null)}>✕</button></header>
          <section className="party-settings-panel">
            <button onClick={enterFullscreen}>Enter fullscreen</button>{fullscreenError&&<p>{fullscreenError}</p>}
            <label>Board graphics<select value={boardView} onChange={e=>setBoardView(e.target.value)}><option value="3d">3D follow camera</option><option value="2d">Overhead view (same 3D board)</option></select></label>
            <label>3D quality<select value={quality} onChange={e=>setQuality(e.target.value)}><option value="low">Low (less GPU work)</option><option value="performance">Performance</option><option value="detail">Detailed shadows</option></select></label>
            <button onClick={()=>setShowNumbers(!showNumbers)}>{showNumbers?'Hide':'Show'} space numbers</button>
            <p>In Board view, drag to explore and pinch/scroll to zoom. Follow Player returns to the active player.</p>
            <button onClick={onLeave} disabled={busy}>{isHost?'End Party Game':'Leave Party Game'}</button>
          </section>
          {isTurnOrderPhase && (
            <div className="party-turn-panel__section party-turn-order-panel">
              <p className="home-mode-card__eyebrow">Starting Deck</p>
              <h2>Roll for turn order</h2>
              <p>Everyone rolls a normal 1–6 die. Highest goes first; equal rolls use a random tiebreak.</p>
              <div className="party-turn-order-list">
                {players.map((player) => {
                  const roll = Number(turnOrderRolls[player.id]) || 0
                  return (
                    <div key={`turn-order-${player.id}`} className={player.id === clientId ? 'party-turn-order-row party-turn-order-row--me' : 'party-turn-order-row'}>
                      <strong>{player.name}</strong>
                      <span>{roll > 0 ? `🎲 ${roll}` : 'Waiting to roll…'}</span>
                    </div>
                  )
                })}
              </div>
              <button
                type="button"
                className="party-primary-action"
                onClick={handleTurnOrderRoll}
                disabled={busy || myTurnOrderRoll > 0}
              >
                {myTurnOrderRoll > 0 ? `You rolled ${myTurnOrderRoll}` : 'Roll Turn-Order Die'}
              </button>
              <small>After everyone rolls, review the order. The player going first presses Continue to begin.</small>
            </div>
          )}

          {!isTurnOrderPhase && <div className="party-turn-panel__section party-current-summary">
            <p className="home-mode-card__eyebrow">Current Turn</p>
            <h2>{activePlayer ? activePlayer.name : 'Waiting…'}</h2>
            {activePlayer && activeCar && (
              <div className="party-current-car">
                <span className="party-current-car__image-wrap">
                  <img
                    className="party-current-car__image"
                    src={getPartyCarImageUrl(activeCar)}
                    alt={`${activeCar.name} selected car`}
                    onError={(event) => {
                      const fallback = getPartyCarImageFallback(activeCar)
                      if (event.currentTarget.src !== fallback) event.currentTarget.src = fallback
                    }}
                  />
                </span>
                <span>
                  <strong>{activeCar.name}</strong>
                  <small>Special Die: {activeCar.specialDie.map(formatPartyDieFace).join(' • ')}</small>
                </span>
              </div>
            )}
            {activeNode && (
              <p>
                Current space: <strong>{nodeNumber(activeNode.id)}</strong> •{' '}
                {activeNode.type === 'Bad Luck' && finalFive ? 'Very Bad Luck' : activeNode.type}
              </p>
            )}
            <p>Turn direction: <strong>{room.turnDirection === -1 ? 'Reversed' : 'Normal'}</strong></p>
          </div>}

          {!isTurnOrderPhase && <div className="party-trophy-status">
            <div>
              <span>Active Trophy</span>
              <strong>{activeTrophyNode ? `Space ${nodeNumber(activeTrophyNode.id)}` : 'Relocating…'}</strong>
            </div>
            <div>
              <span>Price</span>
              <strong>{trophyPrice} Tokens</strong>
              {(Number(room.temporaryTrophyPriceMultiplier) || 1) > 1 && (
                <small>Temporarily doubled until the next Trophy is purchased.</small>
              )}
            </div>
            <div>
              <span>Closed Garage Gates</span>
              <strong>
                {closedGarageGates.length
                  ? closedGarageGates.map((gate) => `${gate.pairId === 'right' ? 'Right' : 'Left'} ${gate.route === 'forward' ? 'Forward' : 'Side'}`).join(' • ')
                  : 'None'}
              </strong>
              <small>Each pair always has one open route and one closed route.</small>
            </div>
          </div>}

          {isHost && !isTurnOrderPhase && (
            <details className="party-turn-panel__section party-dev-panel" open>
              <summary style={{ cursor: 'pointer', fontWeight: 900 }}>DEV Test Lab</summary>
              <p style={{ marginTop: 12 }}>
                Click any working Card. The room will instantly reset into the exact timing/prerequisite setup needed to test that Card.
              </p>
              <div className="menu">
                {devCards.map((card) => (
                  <button
                    type="button"
                    key={`dev-card-${card.id}`}
                    onClick={() => handlePrepareCardTest(card.id)}
                    disabled={busy}
                    title={card.description}
                  >
                    {card.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handlePrepareBattleTest}
                  disabled={busy}
                  title="Instantly prepare a random Battle Space test."
                >
                  ⚔️ Battle Space Test
                </button>
                <button
                  type="button"
                  onClick={() => handlePrepareLuckTest('Lucky')}
                  disabled={busy}
                  title="Instantly land the host on a Lucky Space and resolve its roulette."
                >
                  🍀 Lucky Space Test
                </button>
                <button
                  type="button"
                  onClick={() => handlePrepareLuckTest('Bad Luck')}
                  disabled={busy}
                  title="Instantly land the host on a normal Bad Luck Space and resolve its roulette."
                >
                  ☠️ Bad Luck Space Test
                </button>
                <button
                  type="button"
                  onClick={() => handlePrepareLuckTest('Very Bad Luck')}
                  disabled={busy}
                  title="Jump to the final five rounds and test the upgraded Very Bad Luck roulette."
                >
                  💀 Very Bad Luck Test
                </button>
                <button
                  type="button"
                  onClick={() => handlePrepareEventTest('reactor-trigger-c')}
                  disabled={busy}
                  title="Instantly test the fixed Boost Boulder event used by the back-lane Event spaces."
                >
                  ⚡ Boost Boulder Event Test
                </button>
                <button
                  type="button"
                  onClick={() => handlePrepareEventTest('gate-switch-bridge-east')}
                  disabled={busy}
                  title="Instantly test the Garage Gate Switch."
                >
                  🚧 Gate Switch Test
                </button>
              </div>
              {room.devCardTest && (
                <div className="party-private-card-message" style={{ marginTop: 12 }}>
                  <strong>DEV Test Ready — {room.devCardTest.cardName}</strong>
                  <span>{room.devCardTest.instructions}</span>
                </div>
              )}
              {isHost && <ChallengeDev room={room} roomCode={roomCode} clientId={clientId} runAction={runAction} busy={busy} />}

              {room.devBattleTest && (
                <div className="party-private-card-message" style={{ marginTop: 12 }}>
                  <strong>DEV Battle Ready — {room.devBattleTest.battleName}</strong>
                  <span>{room.devBattleTest.instructions}</span>
                </div>
              )}
              {room.devSpaceTest && (
                <div className="party-private-card-message" style={{ marginTop: 12 }}>
                  <strong>DEV {room.devSpaceTest.spaceType} Ready — {room.devSpaceTest.outcomeName}</strong>
                  <span>{room.devSpaceTest.instructions}</span>
                </div>
              )}
              {room.devEventTest && (
                <div className="party-private-card-message" style={{ marginTop: 12 }}>
                  <strong>DEV Event Ready — {room.devEventTest.eventName}</strong>
                  <span>{room.devEventTest.instructions}</span>
                </div>
              )}
            </details>
          )}

          <div className="party-turn-player-list">
            {players.map((player, index) => {
              const setup = room.playerSetup?.[player.id] || {}
              const car = getPartyCar(player.carId)
              return (
                <div
                  className={player.id === activePlayer?.id ? 'party-turn-player party-turn-player--active' : 'party-turn-player'}
                  key={player.id}
                >
                  <div>
                    <strong>P{index + 1} {player.name}</strong>
                    <span>{car?.name || 'No car'}</span>
                    {car && <small>Special Die: {car.specialDie.map(formatPartyDieFace).join(' • ')}</small>}
                  </div>
                  <div className="party-turn-player__stats">
                    <span>🏆 {setup.trophies || 0}</span>
                    <span>Token {setup.tokens ?? 5}</span>
                    <span>
                      {player.id === clientId
                        ? `Your Cards ${normalizePartyCards(setup.cards).length}/3`
                        : openHands
                          ? `Open Hand ${normalizePartyCards(setup.cards).length}/3`
                          : `Hidden Hand ${normalizePartyCards(setup.cards).length}/3`}
                    </span>
                    {openHands && player.id !== clientId && (
                      <small>
                        {normalizePartyCards(setup.cards).length
                          ? normalizePartyCards(setup.cards)
                              .map((cardId) => getPartyCard(cardId)?.name || 'Unknown Card')
                              .join(' • ')
                          : 'No Cards'}
                      </small>
                    )}
                    {!openHands && player.id !== clientId && (
                      <small>Card identities hidden</small>
                    )}
                    {openHands && setup.lockoutActive && (
                      <small>🔒 Lockout armed — their next attempted Card will be discarded.</small>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <section className="party-inventory-panel">
            <div className="party-inventory-panel__header">
              <div>
                <p className="home-mode-card__eyebrow">Your Inventory</p>
                <h3>Cards {currentCardIds.length}/3</h3>
              </div>
              <span>{openHands ? 'Open Hands' : 'Private'}</span>
            </div>
            <div className="party-inventory-slots">
              {Array.from({ length: 3 }).map((_, index) => {
                const cardId = currentCardIds[index]
                const card = getPartyCard(cardId)
                const useState = getPartyCardUseState(card, turn, isMyTurn, currentSetup, room.phase, room, clientId)
                return (
                  <div
                    key={`inventory-slot-${index}`}
                    className={card ? 'party-inventory-slot party-inventory-slot--filled' : 'party-inventory-slot'}
                  >
                    {card ? (
                      <>
                        <strong>{card.name}</strong>
                        <span>{card.description}</span>
                        {card.enabled === false ? (
                          <small>{card.comingSoon || 'Not active yet'}</small>
                        ) : isMyTurn ? (
                          <>
                            <button
                              type="button"
                              className="party-inventory-use"
                              onClick={() => setSelectedCardIndex(index)}
                              disabled={busy || !useState.canUse}
                              title={useState.reason || undefined}
                            >
                              {turn.cardUsedThisTurn ? 'Card Used' : 'Use Card'}
                            </button>
                            {!useState.canUse && useState.reason && !turn.cardUsedThisTurn && (
                              <small>{useState.reason}</small>
                            )}
                          </>
                        ) : (
                          <small>Use on your turn</small>
                        )}
                      </>
                    ) : (
                      <span>Empty Slot</span>
                    )}
                  </div>
                )
              })}
            </div>

            {turn.cardUsedThisTurn && isMyTurn && (
              <div className="party-card-turn-limit">One Card may be used per turn.</div>
            )}

            {(currentSetup.shieldActive || currentSetup.doublePayout || currentSetup.hotStreakActive || (openHands && currentSetup.lockoutActive) || (!turn.rolled && turn.pendingMovementBonus)) && (
              <div className="party-card-statuses">
                {currentSetup.shieldActive && <span>Shield armed</span>}
                {currentSetup.doublePayout && <span>Double Payout armed</span>}
                {currentSetup.hotStreakActive && <span>Hot Streak armed</span>}
                {openHands && currentSetup.lockoutActive && <span>Lockout armed: your next attempted Card will be discarded</span>}
                {!turn.rolled && turn.pendingMovementBonus ? <span>Movement boost +{turn.pendingMovementBonus} armed</span> : null}
              </div>
            )}

            {turn.lastCardUserId === clientId && turn.lastPrivateCardMessage && (
              <div className="party-private-card-message">
                <strong>Private Card Result</strong>
                <span>{turn.lastPrivateCardMessage}</span>
              </div>
            )}

            {currentSetup.shieldBlockNotice && (
              <div className="party-private-card-message">
                <strong>Shield Blocked an Attack</strong>
                <span>{currentSetup.shieldBlockNotice}</span>
              </div>
            )}

            {currentSetup.negativeCardResultNotice && (
              <div className="party-private-card-message">
                <strong>Negative Card Result</strong>
                <span>{currentSetup.negativeCardResultNotice}</span>
              </div>
            )}

            {selectedCard && (
              <div className="party-card-use-panel">
                <div>
                  <p className="home-mode-card__eyebrow">Use Card</p>
                  <h3>{selectedCard.name}</h3>
                  <p>{selectedCard.description}</p>
                </div>

                {selectedCard.effect === 'precision-die' ? (
                  <div className="party-card-choice-grid">
                    {[1, 2, 3, 4, 5, 6].map((value) => (
                      <button key={value} type="button" onClick={() => handleUseCard({ value })} disabled={busy}>
                        {value}
                      </button>
                    ))}
                  </div>
                ) : selectedCard.requiresTarget ? (
                  <div className="party-card-target-list">
                    {cardTargets.length > 1 && (
                      <button
                        type="button"
                        className="party-primary-action"
                        onClick={handleUseCardOnRandomTarget}
                        disabled={busy}
                      >
                        🎲 Randomize Player
                      </button>
                    )}

                    {openHands && selectedCard.effect === 'steal-card' && selectedStealTargetId ? (
                      (() => {
                        const targetPlayer = room.players?.[selectedStealTargetId]
                        const targetCards = normalizePartyCards(room.playerSetup?.[selectedStealTargetId]?.cards)
                        return (
                          <>
                            <small>
                              Open Hands: choose exactly which Card to steal from {targetPlayer?.name || 'that player'}.
                            </small>
                            {targetCards.map((targetCardId, targetCardIndex) => {
                              const targetCard = getPartyCard(targetCardId)
                              return (
                                <button
                                  key={`steal-${selectedStealTargetId}-${targetCardIndex}-${targetCardId}`}
                                  type="button"
                                  onClick={() => handleUseCard({
                                    targetId: selectedStealTargetId,
                                    targetCardIndex,
                                  })}
                                  disabled={busy}
                                >
                                  Steal {targetCard?.name || 'Card'}
                                </button>
                              )
                            })}
                            <button
                              type="button"
                              className="party-card-cancel"
                              onClick={() => setSelectedStealTargetId('')}
                              disabled={busy}
                            >
                              Choose Different Player
                            </button>
                          </>
                        )
                      })()
                    ) : cardTargets.length ? cardTargets.map((player) => (
                      <button
                        key={player.id}
                        type="button"
                        onClick={() =>
                          selectedCard.effect === 'steal-card'
                            ? handleStealTarget(player.id)
                            : handleUseCard({ targetId: player.id })
                        }
                        disabled={busy}
                      >
                        {selectedCard.effect === 'steal-card' && openHands
                          ? `View ${player.name}'s Cards`
                          : selectedCard.effect === 'challenge-glove'
                            ? `Challenge ${player.name}`
                            : `Use on ${player.name}`}
                      </button>
                    )) : (
                      <small>No valid target is available for this Card.</small>
                    )}
                  </div>
                ) : (
                  <button type="button" className="party-primary-action" onClick={() => handleUseCard()} disabled={busy}>
                    Confirm Use
                  </button>
                )}

                <button type="button" className="party-card-cancel" onClick={() => { setSelectedCardIndex(null); setSelectedStealTargetId('') }} disabled={busy}>
                  Cancel
                </button>
              </div>
            )}
          </section>

          <section className="party-activity-panel">
            <div className="party-activity-panel__header">
              <div>
                <p className="home-mode-card__eyebrow">Shared Activity</p>
                <h3>{openHands ? 'Open Hands • Card names are public' : 'Hidden Hands • private Card identities stay hidden'}</h3>
              </div>
            </div>
            <div className="party-activity-list">
              {activityEntries.length ? activityEntries.map((entry) => (
                <div className={`party-activity-entry party-activity-entry--${entry.type || 'info'}`} key={entry.seq}>
                  <span>{entry.message}</span>
                </div>
              )) : (
                <div className="party-activity-entry"><span>No actions yet.</span></div>
              )}
            </div>
          </section>

          {room.phase === 'board' && isMyTurn && !turn.rolled && !turn.awaitingTrophy && battle?.status !== 'active' && (
            <div className="party-turn-panel__section party-dice-choice">
              <h3>Choose Your Die</h3>
              {rollingDieType && (
                <div className="party-die-rolling" aria-live="polite">
                  <span className="party-die-rolling__icon" aria-hidden="true">🎲</span>
                  <span>Rolling {rollingDieType === 'special' ? `${currentCar?.name || 'Car'} Special Die` : 'Normal Die'}…</span>
                </div>
              )}
              <button type="button" className="party-die-button" onClick={() => handleRoll('normal')} disabled={busy}>
                <strong>Roll Normal Die</strong>
                <span>1 • 2 • 3 • 4 • 5 • 6</span>
              </button>
              <button type="button" className="party-die-button" onClick={() => handleRoll('special')} disabled={busy || !currentCar}>
                <strong>Roll {currentCar?.name || 'Car'} Special Die</strong>
                <span>{currentCar?.specialDie.map(formatPartyDieFace).join(' • ')}</span>
              </button>
            </div>
          )}

          {room.phase === 'board' && !isMyTurn && !turn.rolled && !turn.awaitingTrophy && battle?.status !== 'active' && (
            <div className="party-waiting-box">
              Waiting for {activePlayer?.name || 'the current player'} to choose and roll a die…
            </div>
          )}

          {room.phase === 'board' && turn.rolled && (
            <div className={`party-turn-panel__section party-roll-result${rollingDieType ? ' party-roll-result--rolling' : ''}`}>
              <p className="home-mode-card__eyebrow">Shared Turn Result</p>
              {rollingDieType && <span className="party-die-rolling__icon" aria-hidden="true">🎲</span>}
              <h3>{activePlayer?.name || 'Player'} rolled {turn.faceLabel}</h3>
              <p>
                Using {turn.dieType === 'special'
                  ? `${activeCar?.name || 'Car'} Special Die`
                  : turn.dieType === 'precision'
                    ? ((isMyTurn || openHands) ? 'Precision Dice' : 'a movement Card')
                    : 'Normal Die'}.
              </p>
              {turn.tokenChange ? (
                <p>{turn.tokenChange > 0 ? '+' : ''}{turn.tokenChange} Tokens applied to {activePlayer?.name || 'the player'}.</p>
              ) : null}
              {turn.movementBonusApplied ? (
                <p>Card boost: <strong>+{turn.movementBonusApplied}</strong> movement.</p>
              ) : null}
              {turn.movementRemaining > 0 && (
                <p><strong>{turn.movementRemaining}</strong> space{turn.movementRemaining === 1 ? '' : 's'} remaining.</p>
              )}
              {turn.trophyMessage && (
                <p className="party-trophy-result">{turn.trophyMessage}</p>
              )}
              {turn.landingEffect?.resolved && turn.landingEffect.resultMessage && (
                <p className={turn.landingEffect.type === 'danger-mechanic' ? 'party-mechanic-result party-mechanic-result--danger' : 'party-mechanic-result'}>
                  {(isMyTurn || openHands)
                    ? turn.landingEffect.resultMessage
                    : (turn.landingEffect.publicResultMessage || turn.landingEffect.resultMessage)}
                </p>
              )}
              {turn.cardDrawStatus === 'drawn' && (
                <p className="party-card-result">
                  {turn.cardDrawCardId && (isMyTurn || openHands)
                    ? `${isMyTurn ? 'You' : (activePlayer?.name || 'The current player')} drew ${getPartyCard(turn.cardDrawCardId)?.name || 'a Card'}.`
                    : `${activePlayer?.name || 'The current player'} drew a Card.`}
                </p>
              )}
              {turn.cardDrawStatus === 'full' && (
                <p className="party-card-result party-card-result--full">
                  {activePlayer?.name || 'The current player'} has a full 3-card inventory.
                </p>
              )}
              {turn.readyToEnd && (
                <p>
                  {turn.landedType === 'Card'
                    ? 'Landed on a Card Space.'
                    : <>Landed on <strong>{turn.landedType === 'Bad Luck' && finalFive ? 'Very Bad Luck' : turn.landedType || 'Space'}</strong>.</>}
                </p>
              )}
            </div>
          )}

          {room.phase === 'board' && turn.spaceEffect && (
            <div
              className={`party-turn-panel__section party-landing-effect ${
                turn.spaceEffect.type === 'bad-luck' || turn.spaceEffect.type === 'very-bad-luck'
                  ? 'party-landing-effect--danger'
                  : ''
              }`}
            >
              <p className="home-mode-card__eyebrow">
                {turn.spaceEffect.type === 'very-bad-luck'
                  ? 'Very Bad Luck Roulette'
                  : turn.spaceEffect.type === 'bad-luck'
                    ? 'Bad Luck Roulette'
                    : 'Lucky Roulette'}
              </p>
              <h2>
                {turn.spaceEffect.type === 'very-bad-luck'
                  ? '💀'
                  : turn.spaceEffect.type === 'bad-luck'
                    ? '☠️'
                    : '🍀'}{' '}
                {turn.spaceEffect.name}
              </h2>
              <p>
                {(isMyTurn || openHands)
                  ? (turn.spaceEffect.privateMessage || turn.spaceEffect.publicMessage)
                  : turn.spaceEffect.publicMessage}
              </p>

              {turn.spaceEffect.id === 'token-swipe' && !turn.spaceEffect.resolved && (
                isMyTurn ? (
                  <div className="party-card-target-list">
                    {(turn.spaceEffect.targetPlayerIds || []).length > 1 && (
                      <button
                        type="button"
                        className="party-primary-action"
                        onClick={() => handleLuckyTokenSteal('')}
                        disabled={busy}
                      >
                        🎲 Randomize Player
                      </button>
                    )}
                    {(turn.spaceEffect.targetPlayerIds || []).map((targetId) => {
                      const target = room.players?.[targetId]
                      return (
                        <button
                          type="button"
                          key={`lucky-token-swipe-${targetId}`}
                          onClick={() => handleLuckyTokenSteal(targetId)}
                          disabled={busy}
                        >
                          Steal from {target?.name || 'Player'}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="party-waiting-box">
                    Waiting for {activePlayer?.name || 'the current player'} to choose who to steal Tokens from…
                  </div>
                )
              )}

              {turn.spaceEffect.cardId && isMyTurn && !openHands && (
                <small>Only you can see the exact Card identity in Hidden Hands.</small>
              )}
            </div>
          )}

          {room.phase === 'board' && !movementBusy && turn.eventEffect && (
            <div className="party-turn-panel__section party-landing-effect">
              <p className="home-mode-card__eyebrow">Booststone Ruins Event</p>
              <h2>⚡ {turn.eventEffect.name}</h2>
              <p>
                {(isMyTurn || openHands)
                  ? (turn.eventEffect.privateMessage || turn.eventEffect.publicMessage)
                  : turn.eventEffect.publicMessage}
              </p>

              {turn.eventEffect.id === 'supply-crates' && !turn.eventEffect.resolved && (
                isMyTurn ? (
                  <div className="party-card-target-list">
                    {Array.from({ length: turn.eventEffect.crateCount || 3 }, (_, index) => (
                      <button
                        type="button"
                        key={`supply-crate-${index}`}
                        onClick={() => handleSupplyCrate(index)}
                        disabled={busy}
                      >
                        📦 Open Crate {index + 1}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="party-waiting-box">
                    Waiting for {activePlayer?.name || 'the current player'} to choose a Supply Crate…
                  </div>
                )
              )}

              {turn.eventEffect.cardId && isMyTurn && !openHands && (
                <small>Only you can see the exact Card found in your Supply Crate.</small>
              )}
            </div>
          )}

          

          {room.phase === 'board' && turn.awaitingJackpotDecision && (
            <div className="party-turn-panel__section party-landing-effect party-landing-effect--mechanic">
              <p className="home-mode-card__eyebrow">Mechanic Space</p>
              {isMyTurn ? (
                <>
                  <h2>Use Jackpot?</h2>
                  <p>
                    You landed on a normal Mechanic, but the challenge is still hidden.
                    Use Jackpot now for a riskier payout, or save it and reveal the Mechanic normally.
                  </p>
                  <div className="party-card-statuses">
                    <span>Win: 2× the payout you would normally earn</span>
                    <span>Lose all attempts: lose that normal would-be payout</span>
                  </div>
                  <div className="party-landing-effect__actions">
                    <button
                      type="button"
                      className="party-primary-action"
                      onClick={() => handleJackpotDecision(true)}
                      disabled={busy}
                    >
                      Use Jackpot
                    </button>
                    <button
                      type="button"
                      className="party-secondary-action"
                      onClick={() => handleJackpotDecision(false)}
                      disabled={busy}
                    >
                      Save Jackpot
                    </button>
                  </div>
                  <small>The Mechanic will not be revealed until you choose.</small>
                </>
              ) : (
                <div className="party-waiting-box">
                  {openHands
                    ? `Waiting for ${activePlayer?.name || 'the current player'} to decide whether to use Jackpot before revealing the Mechanic…`
                    : `Waiting for ${activePlayer?.name || 'the current player'} to make a Card decision before revealing the Mechanic…`}
                </div>
              )}
            </div>
          )}

          {room.phase === 'board' && turn.landingEffect && !turn.landingEffect.resolved && (
            <div className={`party-turn-panel__section party-landing-effect ${turn.landingEffect.type === 'danger-mechanic' ? 'party-landing-effect--danger' : 'party-landing-effect--mechanic'}`}>
              <p className="home-mode-card__eyebrow">
                {turn.landingEffect.type === 'danger-mechanic' ? 'Danger Mechanic Space' : 'Mechanic Space'}
              </p>

              {turn.awaitingMechanicChoice ? (
                <>
                  <h2>Choose Your Mechanic</h2>
                  <p>
                    {isMyTurn || openHands
                      ? 'Pick Your Poison gave the active player two replacement Mechanics. Choose one before attempting the challenge.'
                      : 'An Action Card gave the active player two replacement Mechanics. One must be chosen before the attempt.'}
                  </p>
                  {isMyTurn ? (
                    <div className="party-card-target-list">
                      {(turn.mechanicChoices || []).map((choice, index) => (
                        <button
                          type="button"
                          key={choice.id || index}
                          onClick={() => handleMechanicChoice(index)}
                          disabled={busy}
                        >
                          {choice.name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="party-waiting-box">
                      Waiting for {activePlayer?.name || 'the current player'} to choose a replacement Mechanic…
                    </div>
                  )}
                </>
              ) : (
                <>
                  <h2>{turn.landingEffect.challengeName}</h2>
                  {turn.landingEffect.difficulty && (
                    <p><strong>Difficulty:</strong> {turn.landingEffect.difficulty}</p>
                  )}
                  <p>
                    {turn.landingEffect.type === 'danger-mechanic'
                      ? `Make it to avoid losing ${turn.landingEffect.penalty} Tokens.`
                      : (isMyTurn || openHands) && activeSetup.doublePayout
                        ? `Make it to earn +${(turn.landingEffect.reward || 3) * 2} Tokens. Double Payout is armed.`
                        : `Make it to earn +${turn.landingEffect.reward} Tokens.`}
                  </p>

                  <p>
                    <strong>{turn.landingEffect.unlimitedAttempts?'Unlimited attempts':`Attempt ${(Number(turn.landingEffect.attemptsUsed)||0)+1} of ${Math.max(1,Number(turn.landingEffect.attemptLimit)||2)}`}</strong>{mechanicDeadline&&<span className="party-mechanic-clock" role="timer"> {Math.floor(Math.max(0,Math.ceil((mechanicDeadline-mechanicNow)/1000))/60)}:{String(Math.max(0,Math.ceil((mechanicDeadline-mechanicNow)/1000))%60).padStart(2,'0')} left</span>}
                    {(Number(turn.landingEffect.attemptsUsed) || 0) > 0 && ' — you missed the previous attempt, so this is your next shot.'}
                  </p>

                  {turn.landingEffect.resultMessage && !turn.landingEffect.resolved && (
                    <p className="party-mechanic-result">{turn.landingEffect.resultMessage}</p>
                  )}

                  {(turn.landingEffect.pressureTriggered || turn.landingEffect.noBounceRequired || turn.landingEffect.kph100Required || turn.landingEffect.topCornerRequired || turn.landingEffect.mulliganRetry || turn.landingEffect.insuranceActive || turn.landingEffect.hotStreakTriggered || turn.landingEffect.jackpotTriggered) && (
                    <div className="party-card-statuses">
                      {turn.landingEffect.pressureTriggered && !turn.landingEffect.unlimitedAttempts && (
                        <span>{isMyTurn || openHands ? 'Pressure: 1 attempt only' : 'Special effect: 1 attempt only'}</span>
                      )}
                      {turn.landingEffect.noBounceRequired && (
                        <span>{isMyTurn || openHands ? 'Zero Bounce: no bounce allowed' : 'Special requirement: no bounce allowed'}</span>
                      )}
                      {turn.landingEffect.kph100Required && (
                        <span>{isMyTurn || openHands ? '100+ KPH required' : 'Special requirement: 100+ KPH'}</span>
                      )}
                      {turn.landingEffect.topCornerRequired && (
                        <span>{isMyTurn || openHands ? 'Top Corner required' : 'Special requirement: top corner'}</span>
                      )}
                      {turn.landingEffect.mulliganRetry && (
                        <span>{isMyTurn || openHands ? 'Mulligan retry' : 'Extra retry from an Action Card'}</span>
                      )}
                      {turn.landingEffect.insuranceActive && (
                        <span>{isMyTurn || openHands ? 'Insurance: +1 Token even if missed' : 'Special effect: +1 Token even if missed'}</span>
                      )}
                      {turn.landingEffect.hotStreakTriggered && !turn.landingEffect.unlimitedAttempts && (
                        <span>{isMyTurn || openHands ? 'Hot Streak: 1 attempt, +2 bonus Tokens on success' : 'Special effect: 1 attempt, +2 bonus Tokens on success'}</span>
                      )}
                      {turn.landingEffect.jackpotTriggered && (
                        <span>{isMyTurn || openHands ? 'Jackpot: 2× payout on success / lose normal payout on failure' : 'Special wager: 2× payout on success / lose normal payout on failure'}</span>
                      )}
                    </div>
                  )}

                  {turn.landingEffect.finalFive && (
                    <p className="party-final-five-note">Final 5 rounds: +1 Mechanic reward; Danger Mechanic misses cost 3 Tokens.</p>
                  )}
                  {isMyTurn ? (
                    <div className="party-landing-effect__actions">
                      <button
                        type="button"
                        className="party-primary-action"
                        onClick={() => handleMechanicResult(true)}
                        disabled={busy}
                      >
                        Made It
                      </button>
                      <button
                        type="button"
                        className="party-secondary-action"
                        onClick={() => handleMechanicResult(false)}
                        disabled={busy}
                      >
                        Missed It
                      </button>
                    </div>
                  ) : (
                    <div className="party-waiting-box">
                      Waiting for {activePlayer?.name || 'the current player'} to attempt the mechanic…
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {room.phase === 'board' && !movementBusy && turn.awaitingTrophy && (
            <div className="party-turn-panel__section party-trophy-offer">
              <p className="home-mode-card__eyebrow">Trophy Stop</p>
              <h2>🏆 Trophy Available</h2>
              <p>
                {activePlayer?.name || 'The current player'} reached the active Trophy spot.
                It costs <strong>{turn.trophyPrice ?? trophyPrice} Tokens</strong>.
              </p>
              {isMyTurn ? (
                <div className="party-trophy-offer__actions">
                  <button
                    type="button"
                    className="party-primary-action"
                    onClick={() => handleTrophyDecision(true)}
                    disabled={busy || (currentSetup.tokens || 0) < (turn.trophyPrice ?? trophyPrice)}
                  >
                    Buy Trophy
                    <small>{turn.trophyPrice ?? trophyPrice} Tokens</small>
                  </button>
                  <button
                    type="button"
                    className="party-secondary-action"
                    onClick={() => handleTrophyDecision(false)}
                    disabled={busy}
                  >
                    Pass
                  </button>
                  {(currentSetup.tokens || 0) < (turn.trophyPrice ?? trophyPrice) && (
                    <p className="party-lobby-hint">You do not have enough Tokens to buy it.</p>
                  )}
                </div>
              ) : (
                <div className="party-waiting-box">
                  Waiting for {activePlayer?.name || 'the current player'} to choose…
                </div>
              )}
            </div>
          )}

          {room.phase === 'board' && !movementBusy && turn.awaitingGate && (
            <div className="party-turn-panel__section party-path-choice">
              <p className="home-mode-card__eyebrow">Closed Garage Gate</p>
              <h3>🚧 Pay {turn.gateToll || 3} Tokens to pass?</h3>
              <p>
                The currently closed Garage Gate is blocking your route. Paying lets you keep the rest of your movement.
                If you stop, your turn lands on Space {nodeNumber(turn.gateFromNodeId)}.
              </p>
              {isMyTurn ? (
                <div className="party-path-choice__buttons">
                  <button
                    type="button"
                    className="party-primary-action"
                    onClick={() => handleGarageGate(true)}
                    disabled={busy || (currentSetup.tokens || 0) < (turn.gateToll || 3)}
                  >
                    Pay {turn.gateToll || 3} Tokens & Continue
                  </button>
                  <button
                    type="button"
                    className="party-secondary-action"
                    onClick={() => handleGarageGate(false)}
                    disabled={busy}
                  >
                    Don’t Pay — Stop Here
                  </button>
                  {(currentSetup.tokens || 0) < (turn.gateToll || 3) && (
                    <p className="party-lobby-hint">You do not have enough Tokens to pay this Gate.</p>
                  )}
                </div>
              ) : (
                <div className="party-waiting-box">
                  Waiting for {activePlayer?.name || 'the current player'} to resolve the Garage Gate…
                </div>
              )}
            </div>
          )}

          {room.phase === 'board' && isMyTurn && turn.rolled && (turn.movementRemaining || 0) > 0 && !turn.readyToEnd && !turn.awaitingChoice && !turn.awaitingTrophy && !turn.awaitingGate && !turn.awaitingService && battle?.status !== 'active' && (
            <button className="party-primary-action" type="button" onClick={() => handleMove()} disabled={busy}>
              Move {turn.movementRemaining} Space{turn.movementRemaining === 1 ? '' : 's'}
            </button>
          )}

          {room.phase === 'board' && isMyTurn && turn.readyToEnd && !turn.awaitingJackpotDecision && !turn.awaitingGate && !turn.awaitingService && battle?.status !== 'active' && (!turn.landingEffect || turn.landingEffect.resolved) && (!turn.spaceEffect || turn.spaceEffect.resolved) && (!turn.eventEffect || turn.eventEffect.resolved) && (
            <button className="party-primary-action" type="button" onClick={handleEndTurn} disabled={busy}>
              End Turn
            </button>
          )}

          {room.phase === 'board' && !isMyTurn && !turn.awaitingTrophy && !turn.awaitingGate && !turn.awaitingService && !turn.awaitingJackpotDecision && !turn.pendingLanding && battle?.status !== 'active' && !(turn.landingEffect && !turn.landingEffect.resolved) && !(turn.spaceEffect && !turn.spaceEffect.resolved) && !(turn.eventEffect && !turn.eventEffect.resolved) && (
            <div className="party-waiting-box">
              Waiting for {activePlayer?.name || 'the current player'} to finish their turn…
            </div>
          )}

          {turn.awaitingService && room.phase === 'board' && !movementBusy && (
            <div className="party-turn-panel__section">
              <h2>{turn.awaitingService.type === 'Shop' ? 'Action Shop' : turn.awaitingService.type === 'Paratroopa' ? 'Transportation' : 'Steal Stop'}</h2>
              <p>Your remaining {turn.movementRemaining || 0} moves resume after this stop.</p>
              {isMyTurn ? <>
                {turn.awaitingService.type === 'Shop' && <>
                  <p>Choose from this shop's 3 random Action Cards. Prices vary by Card; maximum hand size is 3.</p>
                  <p><small>If a Card is bought, that slot stays empty for the rest of this turn and refills afterward.</small></p>
                  {(turn.awaitingService.shopCardIds || []).map((cardId) => {
                    const card = getPartyCard(cardId)
                    const price = getPartyCardShopPrice(cardId)
                    if (!card || price === null) return null
                    return <button
                      key={card.id}
                      disabled={busy || (currentSetup.tokens || 0) < price || normalizePartyCards(currentSetup.cards).length >= 3}
                      title={card.description}
                      onClick={() => runAction(() => resolvePartyService(roomCode, clientId, 'buy', card.id))}
                    >
                      {card.name} — {price} Token{price === 1 ? '' : 's'}
                    </button>
                  })}
                  {(turn.awaitingService.shopCardIds || []).length < 3 && (
                    <p className="party-lobby-hint">A bought slot is empty until this turn ends.</p>
                  )}
                </>}
                {turn.awaitingService.type === 'Paratroopa' && <>
                  <p>Fly for {PARTY_SERVICE_PRICES.transport} Tokens. The destination stop does not activate again.</p>
                  {['n11', 'n32', 'n51'].map((id) => <button key={id} disabled={busy || (currentSetup.tokens || 0) < PARTY_SERVICE_PRICES.transport}
                    onClick={() => runAction(() => resolvePartyService(roomCode, clientId, 'transport', id))}>Fly to Space {nodeNumber(id)}</button>)}
                </>}
                {turn.awaitingService.type === 'Lakitu' && <>
                  <p>Pay {PARTY_SERVICE_PRICES.stealTokens} to take up to 5 Tokens, or {PARTY_SERVICE_PRICES.stealTrophy} to take 1 Trophy.</p>
                  {players.filter((p) => p.id !== clientId).map((p) => <div key={p.id}>
                    <strong>{p.name}</strong>
                    <button disabled={busy || (currentSetup.tokens || 0) < PARTY_SERVICE_PRICES.stealTokens || !(room.playerSetup?.[p.id]?.tokens > 0)} onClick={() => runAction(() => resolvePartyService(roomCode, clientId, 'tokens', p.id))}>Steal Tokens</button>
                    <button disabled={busy || (currentSetup.tokens || 0) < PARTY_SERVICE_PRICES.stealTrophy || !(room.playerSetup?.[p.id]?.trophies > 0)} onClick={() => runAction(() => resolvePartyService(roomCode, clientId, 'trophy', p.id))}>Steal Trophy</button>
                  </div>)}
                </>}
                <button disabled={busy} onClick={() => runAction(() => resolvePartyService(roomCode, clientId, 'skip'))}>Skip stop</button>
              </> : <p>Waiting for {activePlayer?.name} to choose…</p>}
            </div>
          )}

          

          {room.phase === 'party-complete-test' && (
            <div className="party-turn-panel__section party-round-complete">
              <h2>Final Results</h2>
              {(Array.isArray(room.bonusResults) ? room.bonusResults : Object.values(room.bonusResults || {})).map((bonus) => <div key={bonus.key}>
                <h3>{bonus.name} · +1 Trophy</h3>
                <p>{bonus.description}</p>
                <p>{(bonus.winners || []).length ? bonus.winners.map((id) => room.players?.[id]?.name || 'Player').join(', ') + ` — ${bonus.score}` : 'No qualifying actions; no bonus awarded.'}</p>
              </div>)}
              <p>Ranked by Trophies, then Tokens. Equal totals share a rank.</p>
              {[...players].sort((a,b) => (room.playerSetup?.[b.id]?.trophies || 0) - (room.playerSetup?.[a.id]?.trophies || 0) || (room.playerSetup?.[b.id]?.tokens || 0) - (room.playerSetup?.[a.id]?.tokens || 0)).map((p) => {
                const score = room.playerSetup?.[p.id] || {}
                const rank = 1 + players.filter((other) => {
                  const v = room.playerSetup?.[other.id] || {}
                  return (v.trophies || 0) > (score.trophies || 0) || ((v.trophies || 0) === (score.trophies || 0) && (v.tokens || 0) > (score.tokens || 0))
                }).length
                return <p key={p.id}><strong>#{rank} {p.name}</strong> — {score.trophies || 0} Trophies · {score.tokens || 0} Tokens</p>
              })}
            </div>
          )}

          {error && <p className="party-form-error"><strong>{error}</strong></p>}

          <div className="party-stage-note party-game-stage-note">
            Explore Booststone Ruins: shops, transport, stealing, Supply Crates, reactors, gates and Trophies. Each round ends with a Challenge break. Bonus Trophies are awarded after the final round.
          </div>
        </aside>
      </div>
    </div>
  )
}
