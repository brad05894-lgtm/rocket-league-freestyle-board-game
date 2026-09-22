import { useEffect, useMemo, useRef, useState } from 'react'
import RouletteReel from './RouletteReel'
import { BOOSTSTONE_RUINS } from './booststoneRuins'
import BooststoneRuins3D from './BooststoneRuins3D'
import { formatPartyDieFace, getPartyCar, getPartyCarImageUrl, getPartyCarImageFallback } from './partyCars'
import { getEnabledPartyCards, getPartyCard, normalizePartyCards } from './partyCards'
import {
  beginNextPartyRound,
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
  resolvePartyTrophyPass,
  rollPartyDie,
  rollPartyTurnOrder,
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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [selectedCardIndex, setSelectedCardIndex] = useState(null)
  const [selectedStealTargetId, setSelectedStealTargetId] = useState('')
  const [boardView, setBoardView] = useState('2d')
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
  const closedGarageGateId = room.boardState?.closedGarageGateId || board.gates?.[0]?.id || ''
  const closedGarageGate = board.gates?.find((gate) => gate.id === closedGarageGateId) || null
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
    if (battle?.status !== 'active') return
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
  }, [battle, room.currentRound, room.turnIndex, room.players, players])

  useEffect(() => {
    const event = turn.eventEffect
    if (!event?.name) return
    const key = `event-${room.currentRound}-${room.turnIndex}-${event.id}-${event.name}`
    if (seenRouletteKeyRef.current === key) return
    seenRouletteKeyRef.current = key
    const eventNames = Object.values(BOOSTSTONE_RUINS.boardEvents || {}).map((entry) => entry.name)
    setPartyRoulette({
      phase: 'event',
      title: 'Selecting Event',
      winner: event.name,
      options: rouletteLabels(eventNames, event.name),
    })
  }, [turn.eventEffect, room.currentRound, room.turnIndex])

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

  return (
    <div className="game party-game-screen">
      {partyRoulette && (
        <div className="party-roulette-overlay">
          <div className="game-modal-card selection-roulette">
            <RouletteReel
              key={`${partyRoulette.phase}-${partyRoulette.winner}`}
              title={partyRoulette.title}
              options={partyRoulette.options}
              winner={partyRoulette.winner}
              onComplete={() => completePartyRoulette(partyRoulette)}
            />
          </div>
        </div>
      )}
      <div className="party-game-topbar">
        {currentCar && <img className="hud-car-image" src={getPartyCarImageUrl(currentCar)} alt={`Your car: ${currentCar.name}`} />}
        <span className="hand-mode-badge">Party · {openHands ? 'Open Hands' : 'Hidden Hands'}</span>
        <div>
          <p className="home-mode-card__eyebrow">Party Mode • Booststone Ruins</p>
          <h1>{isTurnOrderPhase ? 'Roll for Turn Order' : `Round ${room.currentRound || 1} / ${room.settings?.rounds || 10}`}</h1>
          <p>Room <strong>{roomCode}</strong></p>
          {finalFive && (
            <p><strong>FINAL 5:</strong> Bad Luck Spaces are now Very Bad Luck Spaces.</p>
          )}
        </div>
        <button type="button" onClick={onLeave} disabled={busy}>
          {isHost ? 'End Party Test' : 'Leave Party Test'}
        </button>
      </div>

      <div className="party-game-layout">
        <section className="party-game-board-card party-game-board-card--ruins">
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '4px 8px 8px',
          }}>
            <button
              type="button"
              onClick={() => setBoardView('2d')}
              aria-pressed={boardView === '2d'}
              style={{
                border: boardView === '2d' ? '1px solid #86efac' : '1px solid rgba(255,255,255,.16)',
                background: boardView === '2d' ? 'rgba(22,101,52,.55)' : 'rgba(15,23,42,.72)',
                color: '#f8fafc',
                borderRadius: 10,
                padding: '7px 11px',
                fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              2D Board
            </button>
            <button
              type="button"
              onClick={() => setBoardView('3d')}
              aria-pressed={boardView === '3d'}
              style={{
                border: boardView === '3d' ? '1px solid #fde68a' : '1px solid rgba(255,255,255,.16)',
                background: boardView === '3d' ? 'rgba(146,64,14,.58)' : 'rgba(15,23,42,.72)',
                color: '#f8fafc',
                borderRadius: 10,
                padding: '7px 11px',
                fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              3D Preview
            </button>
          </div>

          {boardView === '3d' && (
            <BooststoneRuins3D
              board={board}
              room={room}
              players={players}
              activePlayer={activePlayer}
              finalFive={finalFive}
              closedGarageGateId={closedGarageGateId}
              turnOrderPhase={isTurnOrderPhase}
              turnOrderRolls={turnOrderRolls}
            />
          )}

          <div className="party-board-legend" aria-label="Board space legend" style={{ display: boardView === '2d' ? 'flex' : 'none' }}>
            <span><i className="party-board-legend__dot party-board-legend__dot--mechanic" />Mechanic</span>
            <span><i className="party-board-legend__dot party-board-legend__dot--danger" />Danger Mechanic</span>
            <span><i className="party-board-legend__dot party-board-legend__dot--card">A</i>Action Card</span>
            <span><i className="party-board-legend__dot party-board-legend__dot--event">!</i>Board Event</span>
            <span><i className="party-board-legend__dot party-board-legend__dot--lucky">🍀</i>Lucky</span>
            <span><i className={`party-board-legend__dot ${finalFive ? 'party-board-legend__dot--very-bad' : 'party-board-legend__dot--bad'}`}>!</i>{finalFive ? 'Very Bad Luck' : 'Bad Luck'}</span>
            <span><i className="party-board-legend__dot party-board-legend__dot--battle"><b>VS</b></i>Battle</span>
            <span><i className="party-board-legend__junction" />Choice Junction</span>
          </div>

          <div className="v2-board-scroll party-ruins-scroll" style={{ display: boardView === '2d' ? 'block' : 'none' }}>
            <svg
              className="v2-board-svg party-live-board-svg party-ruins-board-svg"
              viewBox={board.viewBox ? `${board.viewBox.x} ${board.viewBox.y} ${board.viewBox.width} ${board.viewBox.height}` : `0 0 ${board.width} ${board.height}`}
              role="img"
              aria-label="Booststone Ruins live Party Mode board"
            >
              <defs>
                <linearGradient id="ruins-sky" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#101c22" />
                  <stop offset="60%" stopColor="#071116" />
                  <stop offset="100%" stopColor="#030809" />
                </linearGradient>
                <linearGradient id="ruins-stone" x1="0" y1="0" x2="0.85" y2="1">
                  <stop offset="0%" stopColor="#7a8d82" />
                  <stop offset="50%" stopColor="#53685e" />
                  <stop offset="100%" stopColor="#35483f" />
                </linearGradient>
                <linearGradient id="ruins-stone-top" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#a7b8aa" />
                  <stop offset="100%" stopColor="#65796c" />
                </linearGradient>
                <linearGradient id="ruins-stone-side" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#52665a" />
                  <stop offset="58%" stopColor="#31463b" />
                  <stop offset="100%" stopColor="#17271f" />
                </linearGradient>
                <linearGradient id="ruins-edge-light" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#dce9df" stopOpacity=".82" />
                  <stop offset="100%" stopColor="#9eb0a4" stopOpacity=".1" />
                </linearGradient>
                <pattern id="ruins-tile-pattern" width="64" height="64" patternUnits="userSpaceOnUse">
                  <rect width="64" height="64" fill="transparent" />
                  <path d="M64 0H0V64" fill="none" stroke="#d8e3db" strokeOpacity=".14" strokeWidth="2" />
                  <path d="M6 58 L17 48 M47 10 L58 21 M30 35 L37 28" fill="none" stroke="#263b31" strokeOpacity=".22" strokeWidth="2" />
                </pattern>
                <filter id="ruins-block-shadow" x="-40%" y="-40%" width="180%" height="220%">
                  <feDropShadow dx="0" dy="7" stdDeviation="4" floodColor="#000" floodOpacity=".52" />
                </filter>
                <radialGradient id="ruins-moss" cx="50%" cy="50%" r="55%">
                  <stop offset="0%" stopColor="#68d36f" />
                  <stop offset="100%" stopColor="#1d6b35" />
                </radialGradient>
                <filter id="ruins-shadow" x="-30%" y="-30%" width="160%" height="180%">
                  <feDropShadow dx="0" dy="10" stdDeviation="8" floodColor="#000" floodOpacity=".55" />
                </filter>
                <filter id="space-glow" x="-80%" y="-80%" width="260%" height="260%">
                  <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#dffcff" floodOpacity=".45" />
                </filter>
                <filter id="trophy-glow" x="-120%" y="-120%" width="340%" height="340%">
                  <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#fde047" floodOpacity=".95" />
                </filter>
              </defs>

              <rect x="0" y="0" width={board.width} height={board.height} rx="34" fill="url(#ruins-sky)" />
              <ellipse cx="560" cy="770" rx="520" ry="72" className="party-ruins-abyss-glow" />

              <g className="party-ruins-backdrop" aria-hidden="true">
                <path d="M40 154 L88 84 L146 116 L194 52 L246 112 L314 68 L382 120 L448 44 L514 110 L590 68 L654 118 L726 54 L790 112 L860 70 L930 120 L1000 68 L1080 150 L1080 202 L40 202 Z" />
                <rect x="66" y="120" width="44" height="164" rx="7" />
                <rect x="1012" y="132" width="38" height="182" rx="7" />
                <rect x="488" y="78" width="38" height="126" rx="7" />
                <rect x="746" y="90" width="42" height="116" rx="7" />
              </g>

              <g className="party-ruins-terrain" filter="url(#ruins-shadow)">
                {(board.terrain || []).map((slab) => (
                  <g key={slab.id}>
                    <polygon points={slab.points} transform={`translate(0 ${16 + (slab.elevation || 1) * 5})`} className="party-ruins-slab-deep" />
                    <polygon points={slab.points} transform={`translate(0 ${8 + (slab.elevation || 1) * 3})`} className="party-ruins-slab-side" />
                    <polygon points={slab.points} className={`party-ruins-slab party-ruins-slab--${slab.elevation || 1}`} />
                    <polygon points={slab.points} className="party-ruins-slab-tiles" />
                    <polyline points={slab.points} className="party-ruins-slab-rim" />
                  </g>
                ))}
              </g>

              <g className="party-ruins-blocks" aria-hidden="true">
                {(board.ruinBlocks || []).map(([x, y, width, height, depth], index) => (
                  <g key={`ruin-block-${index}`} transform={`translate(${x} ${y})`} filter="url(#ruins-block-shadow)">
                    <rect x="0" y={depth} width={width} height={height} rx="4" className="party-ruins-block-side" />
                    <rect x="0" y="0" width={width} height={height} rx="4" className="party-ruins-block-top" />
                    <path d={`M8 ${height * .62} H${Math.max(10, width - 8)}`} className="party-ruins-block-crack" />
                  </g>
                ))}
              </g>

              {board.grid && (
                <g className="party-ruins-grid" aria-hidden="true">
                  {Array.from({ length: Math.ceil(board.width / board.grid.step) + 1 }, (_, index) => board.grid.offsetX + index * board.grid.step)
                    .filter((x) => x >= 0 && x <= board.width)
                    .map((x) => <line key={`grid-x-${x}`} x1={x} y1="0" x2={x} y2={board.height} />)}
                  {Array.from({ length: Math.ceil(board.height / board.grid.step) + 1 }, (_, index) => board.grid.offsetY + index * board.grid.step)
                    .filter((y) => y >= 0 && y <= board.height)
                    .map((y) => <line key={`grid-y-${y}`} x1="0" y1={y} x2={board.width} y2={y} />)}
                </g>
              )}

              <g className="party-ruins-stone-details" aria-hidden="true">
                <path d="M118 596 H224 M170 526 H284 M190 438 H306 M278 262 H470 M520 210 H784 M730 592 H920 M486 518 H664" />
                <path d="M236 646 V590 M424 642 V566 M746 654 V590 M944 622 V548 M924 262 V348 M322 204 V282" />
              </g>

              <g className="party-ruins-foliage" aria-hidden="true">
                {(board.foliage || []).map(([x, y, r], index) => (
                  <g key={`foliage-${index}`} transform={`translate(${x} ${y})`}>
                    <circle cx="-12" cy="3" r={r * .58} />
                    <circle cx="9" cy="-6" r={r * .68} />
                    <circle cx="14" cy="12" r={r * .52} />
                    <circle cx="-3" cy="-14" r={r * .48} />
                  </g>
                ))}
              </g>

              <g className="party-ruins-paths">
                {edges.map(({ id, points }) => (
                  <g key={id}>
                    <polyline className="party-ruins-path-shadow" points={edgePointString(points)} />
                    <polyline className="party-ruins-path" points={edgePointString(points)} />
                    <path className="party-ruins-direction-arrow" d="M-5 -3.5 L5 0 L-5 3.5 Z" transform={edgeArrowTransform(points)} />
                  </g>
                ))}
              </g>

              <g className="party-ruins-lane-exit-hints" aria-hidden="true">
                {(board.laneExitHints || []).map((hint) => (
                  <polyline key={hint.id} points={edgePointString(hint.points.map(([x, y]) => ({ x, y })))} />
                ))}
              </g>

              {board.startZone && (
                <g className="party-ruins-start-zone" aria-hidden="true">
                  <line
                    x1={board.startZone.x}
                    y1={board.startZone.y - board.startZone.height / 2}
                    x2={board.startZone.bridgeTo?.[0] ?? board.startZone.x}
                    y2={board.startZone.bridgeTo?.[1] ?? board.startZone.y - board.startZone.height / 2 - 40}
                    className="party-ruins-start-connector"
                  />
                  <rect
                    x={board.startZone.x - board.startZone.width / 2}
                    y={board.startZone.y - board.startZone.height / 2}
                    width={board.startZone.width}
                    height={board.startZone.height}
                    rx="10"
                    className="party-ruins-start-pad"
                  />
                  {Array.from({ length: 5 }, (_, index) => (
                    <line
                      key={`start-plank-${index}`}
                      x1={board.startZone.x - board.startZone.width / 2 + 10}
                      x2={board.startZone.x + board.startZone.width / 2 - 10}
                      y1={board.startZone.y - board.startZone.height / 2 + 24 + index * 23}
                      y2={board.startZone.y - board.startZone.height / 2 + 24 + index * 23}
                      className="party-ruins-start-plank"
                    />
                  ))}
                  <text textAnchor="middle" className="party-ruins-start-label" x={board.startZone.x} y={board.startZone.y + 4}>START</text>
                  <text textAnchor="middle" className="party-ruins-start-sub" x={board.startZone.x} y={board.startZone.y + 23}>Turn-order deck</text>
                </g>
              )}

              <g className="party-ruins-landmarks">
                {(board.landmarks || []).map((landmark) => {
                  const used = landmark.kind === 'reactor' && Object.keys(room.boardState?.usedBoardEvents || {}).length > 0
                  const crateWidth = Number(landmark.width) || 104
                  const crateHeight = Number(landmark.height) || 72
                  const chestSpacing = Math.min(86, Math.max(70, crateWidth * 0.27))
                  const entranceNode = landmark.entranceNodeId ? nodeMap[landmark.entranceNodeId] : null
                  return (
                    <g key={landmark.id} transform={`translate(${landmark.x} ${landmark.y})`} className={`party-ruins-landmark party-ruins-landmark--${landmark.kind}`}>
                      {landmark.kind === 'crates' && (
                        <>
                          {entranceNode && (
                            <g transform={`translate(${-landmark.x} ${-landmark.y})`} className="party-ruins-crate-entrance">
                              <polygon points={`${landmark.x + crateWidth / 2 - 2},${landmark.y - 20} ${entranceNode.x},${entranceNode.y - 20} ${entranceNode.x},${entranceNode.y + 20} ${landmark.x + crateWidth / 2 - 2},${landmark.y + 20}`} />
                              <path d={`M${landmark.x + crateWidth / 2 + 4} ${landmark.y} H${entranceNode.x - 7}`} />
                            </g>
                          )}
                          <rect x={-crateWidth / 2} y={-crateHeight / 2} width={crateWidth} height={crateHeight} rx="14" className="party-ruins-object-pad party-ruins-crate-platform" />
                          <g className="party-ruins-crates">
                            {[-chestSpacing, 0, chestSpacing].map((offset, index) => (
                              <g key={`crate-chest-${index}`} transform={`translate(${offset} 2)`} className="party-ruins-chest">
                                <ellipse cx="0" cy="35" rx="36" ry="9" className="party-ruins-chest-shadow" />
                                <rect x="-31" y="-4" width="62" height="39" rx="5" className="party-ruins-chest-body" />
                                <path d="M-31 -4 Q-29 -28 0 -31 Q29 -28 31 -4 Z" className="party-ruins-chest-lid" />
                                <path d="M-31 4 H31 M-23 18 H23" className="party-ruins-chest-plank" />
                                <rect x="-4" y="-29" width="8" height="54" rx="2" className="party-ruins-chest-band" />
                                <rect x="-9" y="4" width="18" height="17" rx="3" className="party-ruins-chest-lock" />
                                <path d="M-5 4 V-1 A5 5 0 0 1 5 -1 V4" className="party-ruins-chest-lock-loop" />
                              </g>
                            ))}
                          </g>
                        </>
                      )}
                      {landmark.kind === 'lakitu' && <><circle r="28" className="party-ruins-object-pad" /><text y="7">☁</text></>}
                      {landmark.kind === 'paratroopa' && <><circle r="28" className="party-ruins-object-pad" /><text y="7">✈</text></>}
                      {landmark.kind === 'reactor' && <><circle r="31" className={`party-ruins-reactor ${used ? 'party-ruins-reactor--used' : ''}`} /><path d="M-12 -4 L-2 -18 L2 -7 L13 -13 L7 2 L17 7 L2 10 L-2 23 L-7 10 L-19 6 Z" /></>}
                      <text className="party-ruins-landmark-label" y={landmark.kind === 'crates' ? crateHeight / 2 + 20 : 48}>{landmark.label}</text>
                      {landmark.note && <title>{landmark.note}</title>}
                    </g>
                  )
                })}
              </g>

              <g className="v2-board-specials party-ruins-specials">
                {board.shops.map((shop) => {
                  const shopNode = shop.nodeId ? nodeMap[shop.nodeId] : null
                  return (
                    <g key={shop.id} className="party-ruins-shop-wrap">
                      {shopNode && (
                        <>
                          {shop.linkDirection === 'left' ? (
                            <line
                              x1={shopNode.x - 9}
                              y1={shopNode.y}
                              x2={shop.x + 24}
                              y2={shop.y}
                              className="party-ruins-shop-link"
                            />
                          ) : (
                            <line x1={shopNode.x} y1={shopNode.y + 8} x2={shop.x} y2={shop.y - 18} className="party-ruins-shop-link" />
                          )}
                          <text x={shopNode.x} y={shopNode.y - 13} textAnchor="middle" className="party-ruins-shop-stop-label">SHOP STOP</text>
                        </>
                      )}
                      <g transform={`translate(${shop.x} ${shop.y})`} className={`party-ruins-shop-sign ${shop.elevated ? 'party-ruins-shop-sign--elevated' : ''}`}>
                        {shop.elevated && (
                          <>
                            <ellipse cx="0" cy="14" rx="44" ry="18" className="party-ruins-shop-mound-shadow" />
                            <ellipse cx="0" cy="9" rx="39" ry="15" className="party-ruins-shop-mound" />
                          </>
                        )}
                        <rect x="-18" y="-18" width="36" height="36" rx="7" />
                        <text textAnchor="middle" y="6">A</text>
                        <text className="party-ruins-small-label" textAnchor="middle" y="50">ACTION SHOP</text>
                      </g>
                    </g>
                  )
                })}
                {board.gates.map((gate) => {
                  const isClosed = gate.id === closedGarageGateId
                  return (
                    <g key={gate.id} transform={`translate(${gate.x} ${gate.y})`} className={`party-ruins-gate ${isClosed ? 'party-ruins-gate--closed' : 'party-ruins-gate--open'}`}>
                      <rect x="-23" y="-18" width="46" height="36" rx="5" />
                      <path d="M-15 -10 V11 M-5 -10 V11 M5 -10 V11 M15 -10 V11" />
                      <text className="party-ruins-small-label" textAnchor="middle" y="43">{isClosed ? `GATE • ${gate.toll || 3}T` : 'GATE • OPEN'}</text>
                    </g>
                  )
                })}
              </g>

              <g className="v2-board-nodes party-ruins-nodes">
                {board.nodes.map((node) => {
                  const isVeryBad = node.type === 'Bad Luck' && finalFive
                  const isBad = node.type === 'Bad Luck'
                  const symbol = node.type === 'Card'
                    ? 'A'
                    : node.type === 'Event'
                      ? '!'
                      : node.type === 'Battle'
                        ? 'VS'
                        : node.type === 'Lucky'
                          ? '🍀'
                          : ''
                  return (
                    <g key={node.id} transform={`translate(${node.x} ${node.y})`} className={node.id === activeNode?.id ? 'party-ruins-space party-ruins-space--current' : 'party-ruins-space'}>
                      {node.trophySpot && node.id !== room.activeTrophyNodeId && (
                        <circle r="25" className="v2-board-trophy-ring v2-board-trophy-ring--inactive" />
                      )}
                      {node.id === room.activeTrophyNodeId && (
                        <>
                          <circle r="34" className="v2-board-trophy-ring v2-board-trophy-ring--active" filter="url(#trophy-glow)" />
                          <text className="party-active-trophy-label" textAnchor="middle" y="-34">🏆</text>
                          <text className="party-ruins-trophy-price" textAnchor="middle" y="-51">{trophyPrice}T</text>
                        </>
                      )}

                      {isBad ? (
                        <>
                          <path
                            d="M0 -22 L6 -14 L16 -17 L15 -7 L24 0 L15 7 L17 17 L6 14 L0 23 L-6 14 L-17 17 L-15 7 L-24 0 L-15 -7 L-17 -17 L-6 -14 Z"
                            className={isVeryBad ? 'party-ruins-badluck party-ruins-badluck--very' : 'party-ruins-badluck'}
                          />
                          <text className="party-ruins-space-symbol party-ruins-space-symbol--bad" textAnchor="middle" y="5">{isVeryBad ? '☠' : '!'}</text>
                        </>
                      ) : node.visualMode === 'junction' || node.visualMode === 'shop-dot' || node.visualMode === 'paratroopa-dot' || node.visualMode === 'lakitu-dot' || node.visualMode === 'route-stub' ? (
                        <>
                          {node.visualMode === 'junction' && <circle cx="0" cy="0" r="29" className="party-ruins-junction-ring" />}
                          <circle
                            cx="0"
                            cy="0"
                            r={node.visualMode === 'route-stub' ? '3' : node.visualMode === 'shop-dot' || node.visualMode === 'paratroopa-dot' || node.visualMode === 'lakitu-dot' ? '6.2' : '4.8'}
                            className={node.visualMode === 'route-stub' ? 'party-ruins-route-stub' : 'party-ruins-junction-dot'}
                          />
                          {node.visualMode === 'paratroopa-dot' && (
                            <text className="party-ruins-stop-label" textAnchor="middle" y="-12">PARATROOPA</text>
                          )}
                          {node.visualMode === 'lakitu-dot' && (
                            <text className="party-ruins-stop-label" textAnchor="end" x="-12" y="4">LAKITU</text>
                          )}
                        </>
                      ) : node.type === 'Battle' ? (
                        <>
                          <polygon points="0,-22 22,0 0,22 -22,0" className="party-ruins-battle-space" filter="url(#space-glow)" />
                          <text className="party-ruins-space-symbol party-ruins-space-symbol--battle" textAnchor="middle" y="5">VS</text>
                        </>
                      ) : (
                        <>
                          <circle r="18" fill={SPACE_COLORS[node.type] || '#64748b'} className="v2-board-node" filter="url(#space-glow)" />
                          {symbol && <text className={node.type === 'Lucky' ? 'party-ruins-space-symbol party-ruins-space-symbol--lucky' : 'party-ruins-space-symbol'} textAnchor="middle" y="5">{symbol}</text>}
                        </>
                      )}

                      {node.choiceJunction && node.visualMode !== 'junction' && (
                        <>
                          <circle cx="0" cy="0" r="29" className="party-ruins-junction-ring" />
                          <circle cx="0" cy="0" r="4.8" className="party-ruins-junction-dot" />
                        </>
                      )}
                      <title>{`Space ${nodeNumber(node.id)} • ${isVeryBad ? 'Very Bad Luck' : node.type}${node.choiceJunction ? ' • Choice Junction' : ''}`}</title>
                    </g>
                  )
                })}
              </g>

              <g className="party-player-markers party-ruins-player-markers">
                {players.map((player, index) => {
                  const setup = room.playerSetup?.[player.id] || {}
                  const node = nodeMap[setup.boardNodeId || board.startId]
                  if (!node && !isTurnOrderPhase) return null
                  const normalOffset = PLAYER_OFFSETS[index] || [0, 0]
                  const deckOffset = TURN_ORDER_OFFSETS[index] || [0, 0]
                  const onStartDeck = isTurnOrderPhase || setup.onStartDeck === true
                  const markerX = onStartDeck
                    ? (board.startZone?.x || node?.x || 0) + deckOffset[0]
                    : node.x + normalOffset[0]
                  const markerY = onStartDeck
                    ? (board.startZone?.y || node?.y || 0) + deckOffset[1]
                    : node.y + normalOffset[1]
                  const roll = Number(turnOrderRolls[player.id]) || 0
                  return (
                    <g
                      key={player.id}
                      transform={`translate(${markerX} ${markerY})`}
                      className={!isTurnOrderPhase && player.id === activePlayer?.id ? 'party-player-marker party-player-marker--active' : 'party-player-marker'}
                    >
                      <circle r="12" />
                      <text textAnchor="middle" dominantBaseline="central">P{index + 1}</text>
                      <text className="party-ruins-player-name" textAnchor="middle" y="-19">{player.name}</text>
                      {isTurnOrderPhase && roll > 0 && <text className="party-turn-order-marker-roll" textAnchor="middle" y="27">🎲 {roll}</text>}
                    </g>
                  )
                })}
              </g>
            </svg>
          </div>

          <div className="party-board-caption">
            <strong>Booststone Ruins • corrected top-left geometry pass</strong>
            <span>The shared Lucky and Action Card now align horizontally; the Garage-Gate loop is one-way counterclockwise from the first junction.</span>
            <span>VS spaces are orange diamonds. Lakitu, Paratroopa, and Action Shop use black forced-stop dots rather than normal spaces.</span>
          </div>
        </section>

        <aside className="party-turn-panel">
          {isTurnOrderPhase && (
            <div className="party-turn-panel__section party-turn-order-panel">
              <p className="home-mode-card__eyebrow">Starting Deck</p>
              <h2>Roll for turn order</h2>
              <p>Every player gets one unique 1–6 roll. Highest roll goes first; duplicate rolls are impossible.</p>
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
              <small>The board begins automatically as soon as everyone has rolled.</small>
            </div>
          )}

          {!isTurnOrderPhase && <div className="party-turn-panel__section">
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
              <span>Closed Garage Gate</span>
              <strong>
                {closedGarageGate
                  ? `${closedGarageGate.id.includes('west') ? 'West' : 'Center'} • ${closedGarageGate.toll || 3} Tokens`
                  : 'None'}
              </strong>
            </div>
          </div>}

          {isHost && !isTurnOrderPhase && (
            <details className="party-turn-panel__section" open={Boolean(room.devCardTest)}>
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
                  onClick={() => handlePrepareEventTest('supply-crates')}
                  disabled={busy}
                  title="Instantly test the interactive 3 Supply Crates Event."
                >
                  📦 Supply Crates Test
                </button>
                <button
                  type="button"
                  onClick={() => handlePrepareEventTest('reactor-trigger-a')}
                  disabled={busy}
                  title="Instantly test a one-use Boost Reactor Chain with another player placed in the affected lane."
                >
                  ⚡ Boost Reactor Test
                </button>
                <button
                  type="button"
                  onClick={() => handlePrepareEventTest('gate-switch-west')}
                  disabled={busy}
                  title="Instantly test the Garage Gate Switch."
                >
                  🚧 Gate Switch Test
                </button>
                <button
                  type="button"
                  onClick={() => handlePrepareEventTest('ancient-boost-cache')}
                  disabled={busy}
                  title="Instantly test the Ancient Boost Cache Event."
                >
                  🪙 Boost Cache Test
                </button>
              </div>
              {room.devCardTest && (
                <div className="party-private-card-message" style={{ marginTop: 12 }}>
                  <strong>DEV Test Ready — {room.devCardTest.cardName}</strong>
                  <span>{room.devCardTest.instructions}</span>
                </div>
              )}
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
                    <span>Token {setup.tokens ?? 10}</span>
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

          {room.phase === 'board' && turn.eventEffect && (
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

          {room.phase === 'board' && battle && (
            <div className="party-turn-panel__section party-landing-effect">
              <p className="home-mode-card__eyebrow">
                {battle.allPlayers
                  ? 'Everyone Battle'
                  : battle.source === 'challenge-glove'
                    ? 'Challenge Glove Battle'
                    : 'Battle Space'}
              </p>
              <h2>⚔️ {battle.name}</h2>
              <p>
                {battle.allPlayers ? (
                  <strong>{battleParticipants.map((player) => player.name).join(' · ')}</strong>
                ) : (
                  <>
                    <strong>{battleChallenger?.name || 'Player 1'}</strong> vs <strong>{battleOpponent?.name || 'Player 2'}</strong>
                  </>
                )}
              </p>

              {battle.battleMechanic && (
                <div className="party-card-statuses">
                  <span>Battle Mechanic: {battle.battleMechanic.name}</span>
                  <span>Difficulty: {battle.battleMechanic.difficulty}</span>
                </div>
              )}

              <div style={{ textAlign: 'left', margin: '12px 0' }}>
                {(battle.rules || []).map((rule, index) => (
                  <p key={`${battle.id}-rule-${index}`} style={{ margin: '6px 0' }}>
                    <strong>{index + 1}.</strong> {rule}
                  </p>
                ))}
              </div>

              <div className="party-card-statuses">
                <span>Winner: +{battle.rewardTokens || 5} Tokens</span>
                <span>
                  {battle.allPlayers ? 'Everyone else:' : 'Loser:'} -{battle.lossTokens || 1} Token{(battle.lossTokens || 1) === 1 ? '' : 's'} (minimum 0)
                </span>
              </div>

              {battle.status === 'active' ? (
                <>
                  {isMyTurn ? (
                    <div className="party-landing-effect__actions">
                      {battle.allPlayers ? (
                        battleParticipants.map((player) => (
                          <button
                            type="button"
                            key={player.id}
                            className="party-primary-action"
                            onClick={() => handleBattleWinner(player.id)}
                            disabled={busy}
                          >
                            {player.name} Won
                          </button>
                        ))
                      ) : (
                        <>
                          <button
                            type="button"
                            className="party-primary-action"
                            onClick={() => handleBattleWinner(battle.challengerId)}
                            disabled={busy}
                          >
                            {battleChallenger?.name || 'Challenger'} Won
                          </button>
                          <button
                            type="button"
                            className="party-secondary-action"
                            onClick={() => handleBattleWinner(battle.opponentId)}
                            disabled={busy}
                          >
                            {battleOpponent?.name || 'Opponent'} Won
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="party-waiting-box">
                      Waiting for {battleChallenger?.name || 'the current player'} to report the Battle winner…
                    </div>
                  )}

                  {battle.allowMutualConcede && isBattleParticipant && (
                    <div style={{ marginTop: 10 }}>
                      {!battleConcedeVotes[clientId] ? (
                        <button
                          type="button"
                          className="party-card-cancel"
                          onClick={handleBattleConcedeVote}
                          disabled={busy}
                        >
                          Request Mutual Concede
                        </button>
                      ) : (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="party-card-cancel"
                            disabled
                          >
                            Mutual Concede Requested
                          </button>
                          <button
                            type="button"
                            className="party-secondary-action"
                            onClick={handleBattleConcedeCancel}
                            disabled={busy}
                          >
                            Cancel Concede Request
                          </button>
                        </div>
                      )}
                      <small style={{ display: 'block', marginTop: 6 }}>
                        Both Battle players must request it. You can cancel your request any time before the other player agrees.
                      </small>
                    </div>
                  )}
                </>
              ) : (
                <div className="party-mechanic-result">
                  {battle.resultMessage || 'Battle resolved.'}
                  {battle.source === 'challenge-glove' && !turn.rolled && (
                    <div style={{ marginTop: 8 }}>Battle complete — the current player can now roll normally.</div>
                  )}
                </div>
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
                    <strong>Attempt {(Number(turn.landingEffect.attemptsUsed) || 0) + 1} of {Math.max(1, Number(turn.landingEffect.attemptLimit) || 2)}</strong>
                    {(Number(turn.landingEffect.attemptsUsed) || 0) > 0 && ' — you missed the previous attempt, so this is your next shot.'}
                  </p>

                  {turn.landingEffect.resultMessage && !turn.landingEffect.resolved && (
                    <p className="party-mechanic-result">{turn.landingEffect.resultMessage}</p>
                  )}

                  {(turn.landingEffect.pressureTriggered || turn.landingEffect.noBounceRequired || turn.landingEffect.kph100Required || turn.landingEffect.topCornerRequired || turn.landingEffect.mulliganRetry || turn.landingEffect.insuranceActive || turn.landingEffect.hotStreakTriggered || turn.landingEffect.jackpotTriggered) && (
                    <div className="party-card-statuses">
                      {turn.landingEffect.pressureTriggered && (
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
                      {turn.landingEffect.hotStreakTriggered && (
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

          {room.phase === 'board' && turn.awaitingTrophy && (
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

          {room.phase === 'board' && turn.awaitingGate && (
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

          {room.phase === 'board' && isMyTurn && turn.rolled && !turn.readyToEnd && !turn.awaitingChoice && !turn.awaitingTrophy && !turn.awaitingGate && battle?.status !== 'active' && (
            <button className="party-primary-action" type="button" onClick={() => handleMove()} disabled={busy}>
              Move {turn.movementRemaining} Space{turn.movementRemaining === 1 ? '' : 's'}
            </button>
          )}

          {room.phase === 'board' && isMyTurn && turn.awaitingChoice && battle?.status !== 'active' && (
            <div className="party-turn-panel__section party-path-choice">
              <h3>Choose a Path</h3>
              <p>You reached a junction with {turn.movementRemaining} move{turn.movementRemaining === 1 ? '' : 's'} left.</p>
              <div className="party-path-choice__buttons">
                {(turn.choices || []).map((nextId, index) => {
                  const nextNode = nodeMap[nextId]
                  return (
                    <button
                      type="button"
                      key={nextId}
                      onClick={() => handleMove(nextId)}
                      disabled={busy}
                    >
                      Path {index + 1} → Space {nodeNumber(nextId)}
                      <small>
                        {nextNode?.type === 'Bad Luck' && finalFive ? 'Very Bad Luck' : nextNode?.type || 'Space'}
                      </small>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {room.phase === 'board' && isMyTurn && turn.readyToEnd && !turn.awaitingJackpotDecision && !turn.awaitingGate && battle?.status !== 'active' && (!turn.landingEffect || turn.landingEffect.resolved) && (!turn.spaceEffect || turn.spaceEffect.resolved) && (!turn.eventEffect || turn.eventEffect.resolved) && (
            <button className="party-primary-action" type="button" onClick={handleEndTurn} disabled={busy}>
              End Turn
            </button>
          )}

          {room.phase === 'board' && !isMyTurn && !turn.awaitingTrophy && !turn.awaitingGate && !turn.awaitingJackpotDecision && battle?.status !== 'active' && !(turn.landingEffect && !turn.landingEffect.resolved) && !(turn.spaceEffect && !turn.spaceEffect.resolved) && !(turn.eventEffect && !turn.eventEffect.resolved) && (
            <div className="party-waiting-box">
              Waiting for {activePlayer?.name || 'the current player'} to finish their turn…
            </div>
          )}

          {room.phase === 'round-complete' && (
            <div className="party-turn-panel__section party-round-complete">
              <p className="home-mode-card__eyebrow">Round Complete</p>
              <h2>Challenge comes next</h2>
              <p>The end-of-round Challenge system is the next build step. For now, this button lets us keep testing board movement.</p>
              {isHost ? (
                <button type="button" className="party-primary-action" onClick={handleNextRound} disabled={busy}>
                  Begin Round {(room.currentRound || 1) + 1}
                </button>
              ) : (
                <div className="party-waiting-box">Waiting for the host to begin the next test round…</div>
              )}
            </div>
          )}

          {room.phase === 'party-complete-test' && (
            <div className="party-turn-panel__section party-round-complete">
              <p className="home-mode-card__eyebrow">Movement Test Complete</p>
              <h2>{room.settings?.rounds || 10} rounds finished</h2>
              <p>Trophies, Mechanics, Battles, Lucky/Bad Luck, Very Bad Luck, Booststone Ruins Events, Supply Crates, Boost Reactors, and Garage Gates are active. Shops and end-of-round Challenges are next.</p>
            </div>
          )}

          {error && <p className="party-form-error"><strong>{error}</strong></p>}

          <div className="party-stage-note party-game-stage-note">
            Booststone Ruins board Events are active now, including Supply Crates, one-use Boost Reactor chains, the Garage Gate switch/toll system, and the Ancient Boost Cache. Card visibility still follows the lobby setting for any Cards awarded by Events.
          </div>
        </aside>
      </div>
    </div>
  )
}
