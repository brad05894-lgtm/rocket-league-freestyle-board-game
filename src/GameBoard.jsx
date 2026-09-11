import { useEffect, useMemo, useRef, useState } from 'react'
import { edgeKey, layoutBoard } from './boardLayout'

const SPACE_COLORS = {
  Start: '#22c55e',
  Finish: '#facc15',
  Mechanic: '#2563eb',
  Action: '#8b5cf6',
  Battle: '#ef4444',
  Event: '#f97316',
  Gamble: '#f59e0b',
  'Action Shop': '#14b8a6',
  'Choose Difficulty': '#ec4899',
  'Shortcut Gate': '#eab308',
}

const PLAYER_COLORS = ['#38bdf8', '#f472b6', '#a3e635', '#fb923c']

function routeToPath(points) {
  if (!points || points.length < 2) return ''

  let path = `M ${points[0].x} ${points[0].y}`

  for (let index = 1; index < points.length; index += 1) {
    const point = points[index]

    if (index === points.length - 1) {
      path += ` L ${point.x} ${point.y}`
      continue
    }

    const nextPoint = points[index + 1]
    const midX = (point.x + nextPoint.x) / 2
    const midY = (point.y + nextPoint.y) / 2

    path += ` Q ${point.x} ${point.y} ${midX} ${midY}`
  }

  return path
}

function nodeLabel(node) {
  if (node.route === 'main') return node.mainIndex
  if (node.route === 'shortcut') {
    return `S${Number(node.id.split('-').at(-1)) + 1}`
  }
  if (node.route === 'fork') {
    return `F${Number(node.id.split('-').at(-1)) + 1}`
  }
  return ''
}

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export default function GameBoard({
  board,
  players,
  currentPlayerIndex,
  boardLength = 75,
  localPlayerId = null,
  ambient = false,
  highlightedNodes = [],
  focusNodeIds = [],
}) {
  const scrollRef = useRef(null)
  const [zoom, setZoom] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 700 ? 0.72 : 0.9
  )

  const layout = useMemo(() => (board ? layoutBoard(board) : null), [board])

  const nodeMap = useMemo(() => {
    if (!board || !layout) return {}

    return Object.fromEntries(
      board.nodes.map((node) => [
        node.id,
        {
          ...node,
          ...layout.positions[node.id],
        },
      ])
    )
  }, [board, layout])

  const highlightedNodeMap = useMemo(() => {
    const map = new Map()

    for (const item of highlightedNodes || []) {
      if (!item?.nodeId) continue

      const existing = map.get(item.nodeId)
      if (existing) {
        map.set(item.nodeId, {
          ...existing,
          label: `${existing.label} / ${item.label}`,
          color: '#e2e8f0',
        })
      } else {
        map.set(item.nodeId, item)
      }
    }

    return map
  }, [highlightedNodes])

  const focusNodeKey = (focusNodeIds || []).filter(Boolean).join('|')

  const playerMarkers = useMemo(() => {
    if (!board || !layout) return []

    const lastMainIndex = Math.max(0, board.mainPath.length - 1)

    return players.map((player, playerIndex) => {
      let nodeId = null

      if (player.finished) {
        nodeId = board.finishId
      } else if (
        player.boardNodeId &&
        layout.positions[player.boardNodeId]
      ) {
        nodeId = player.boardNodeId
      } else {
        const normalized = Math.max(
          0,
          Math.min(1, (player.position || 0) / boardLength)
        )
        const mainIndex = Math.min(
          lastMainIndex,
          Math.round(normalized * lastMainIndex)
        )
        nodeId = board.mainPath[mainIndex] || board.startId
      }

      const point = layout.positions[nodeId] || layout.positions[board.startId]

      return {
        player,
        playerIndex,
        nodeId,
        point,
      }
    })
  }, [board, layout, players, boardLength])

  function focusPlayer(playerIndex, { boostZoom = false } = {}) {
    if (!layout || !scrollRef.current) return

    const marker = playerMarkers[playerIndex]
    if (!marker?.point) return

    const targetZoom = boostZoom ? Math.max(zoom, 0.95) : zoom
    if (targetZoom !== zoom) {
      setZoom(targetZoom)
    }

    const container = scrollRef.current
    const scaledX = (marker.point.x - layout.bounds.minX) * targetZoom
    const scaledY = (marker.point.y - layout.bounds.minY) * targetZoom
    const targetLeft = Math.max(0, scaledX - container.clientWidth / 2)
    const targetTop = Math.max(0, scaledY - container.clientHeight / 2)

    window.requestAnimationFrame(() => {
      container.scrollTo({
        left: targetLeft,
        top: targetTop,
        behavior: ambient ? 'auto' : 'smooth',
      })
    })
  }

  useEffect(() => {
    if (focusNodeKey) return

    focusPlayer(currentPlayerIndex)
    // Re-center when the active player's actual board location changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentPlayerIndex,
    players[currentPlayerIndex]?.position,
    players[currentPlayerIndex]?.boardNodeId,
    layout,
    playerMarkers,
    zoom,
    focusNodeKey,
  ])

  useEffect(() => {
    if (!layout || !scrollRef.current || !focusNodeKey || ambient) return

    const ids = focusNodeKey.split('|').filter(Boolean)
    const points = ids
      .map((nodeId) => layout.positions[nodeId])
      .filter(Boolean)

    if (points.length === 0) return

    const container = scrollRef.current
    const minPointX = Math.min(...points.map((point) => point.x))
    const maxPointX = Math.max(...points.map((point) => point.x))
    const minPointY = Math.min(...points.map((point) => point.y))
    const maxPointY = Math.max(...points.map((point) => point.y))
    const centerX = (minPointX + maxPointX) / 2
    const centerY = (minPointY + maxPointY) / 2
    const contentWidth = Math.max(170, maxPointX - minPointX + 170)
    const contentHeight = Math.max(190, maxPointY - minPointY + 190)
    const widthZoom = container.clientWidth / contentWidth
    const heightZoom = container.clientHeight / contentHeight
    const targetZoom = Math.max(0.45, Math.min(1.05, widthZoom, heightZoom))

    setZoom(targetZoom)

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const scaledX = (centerX - layout.bounds.minX) * targetZoom
        const scaledY = (centerY - layout.bounds.minY) * targetZoom

        container.scrollTo({
          left: Math.max(0, scaledX - container.clientWidth / 2),
          top: Math.max(0, scaledY - container.clientHeight / 2),
          behavior: 'smooth',
        })
      })
    })
  }, [focusNodeKey, layout, ambient])

  if (!board || !layout) return null

  const { minX, minY, width, height } = layout.bounds

  return (
    <section
      className={`game-board-shell ${ambient ? 'game-board-shell--ambient' : ''}`}
      aria-label={ambient ? undefined : 'Live game board'}
      aria-hidden={ambient ? 'true' : undefined}
    >
      {!ambient && (
        <div className="game-board-toolbar">
          <div>
            <div className="game-board-title">Live Board</div>
            <div className="game-board-subtitle">
              Follows the current player · scroll or drag to explore
            </div>
          </div>

          <div className="game-board-zoom">
            <button
              type="button"
              data-online-allowed="true"
              onClick={() => setZoom((value) => Math.max(0.45, value - 0.1))}
              aria-label="Zoom out"
            >
              −
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              data-online-allowed="true"
              onClick={() => setZoom((value) => Math.min(1.35, value + 0.1))}
              aria-label="Zoom in"
            >
              +
            </button>
          </div>
        </div>
      )}

      <div ref={scrollRef} className="game-board-scroll">
        <svg
          width={width * zoom}
          height={height * zoom}
          viewBox={`${minX} ${minY} ${width} ${height}`}
          className="game-board-svg"
        >
          <defs>
            <filter id="game-board-glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="game-board-soft-glow">
              <feGaussianBlur stdDeviation="1.7" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {board.nodes.flatMap((node) =>
            node.next.map((nextId) => {
              const nextNode = nodeMap[nextId]
              if (!nextNode) return null

              const route = layout.edgeRoutes[edgeKey(node.id, nextId)] || [
                layout.positions[node.id],
                layout.positions[nextId],
              ]

              const isShortcut =
                node.route === 'shortcut' || nextNode.route === 'shortcut'
              const isFork = node.route === 'fork' || nextNode.route === 'fork'

              return (
                <path
                  key={`${node.id}-${nextId}`}
                  d={routeToPath(route)}
                  fill="none"
                  stroke={isShortcut ? '#facc15' : isFork ? '#64748b' : '#475569'}
                  strokeWidth={isShortcut ? 9 : 7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={isShortcut ? '15 11' : undefined}
                  className={`board-route ${isShortcut ? 'board-route--shortcut' : ''}`}
                />
              )
            })
          )}

          {board.nodes.map((node) => {
            const positioned = nodeMap[node.id]
            if (!positioned) return null

            const important = ['Start', 'Finish', 'Shortcut Gate'].includes(node.type)
            const color = SPACE_COLORS[node.type] || '#64748b'
            const highlight = highlightedNodeMap.get(node.id)

            return (
              <g
                key={node.id}
                transform={`translate(${positioned.x}, ${positioned.y})`}
                className={`board-node board-node--${String(node.type)
                  .toLowerCase()
                  .replaceAll(' ', '-')}`}
              >
                {highlight && (
                  <>
                    <circle
                      r={important ? 42 : 37}
                      fill="none"
                      stroke={highlight.color || '#7dd3fc'}
                      strokeWidth="5"
                      opacity="0.98"
                      filter="url(#game-board-glow)"
                      className="board-choice-ring"
                    />
                    <rect
                      x="-54"
                      y="-58"
                      width="108"
                      height="19"
                      rx="9"
                      fill="#07111f"
                      stroke={highlight.color || '#7dd3fc'}
                      strokeWidth="1.5"
                      opacity="0.98"
                    />
                    <text
                      textAnchor="middle"
                      y="-45"
                      fill="#f8fbff"
                      fontSize="8"
                      fontWeight="900"
                    >
                      {highlight.label}
                    </text>
                  </>
                )}
                <circle r={important ? 35 : 30} fill="#040815" opacity="0.94" />
                <circle
                  r={important ? 29 : 24}
                  fill={color}
                  stroke={important ? '#ffffff' : '#cbd5e1'}
                  strokeWidth={important ? 4 : 2}
                  filter={important ? 'url(#game-board-glow)' : 'url(#game-board-soft-glow)'}
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize={important ? 12 : 10}
                  fontWeight="900"
                >
                  {nodeLabel(node)}
                </text>
                <rect x="-50" y="37" width="100" height="20" rx="8" fill="#020617" opacity="0.9" />
                <text textAnchor="middle" y="51" fill="#e2e8f0" fontSize="8.5" fontWeight="700">
                  {node.type}
                </text>
              </g>
            )
          })}

          {playerMarkers.map(({ player, playerIndex, point }, markerIndex) => {
            if (!point) return null

            const sameNodeMarkers = playerMarkers.filter(
              (other) => other.nodeId === playerMarkers[markerIndex].nodeId
            )
            const sameNodeIndex = sameNodeMarkers.findIndex(
              (other) => other.playerIndex === playerIndex
            )
            const angle =
              (sameNodeIndex / Math.max(1, sameNodeMarkers.length)) * Math.PI * 2 -
              Math.PI / 2
            const radius = sameNodeMarkers.length > 1 ? 34 : 0
            const x = point.x + Math.cos(angle) * radius
            const y = point.y + Math.sin(angle) * radius - 38
            const isCurrent = playerIndex === currentPlayerIndex

            return (
              <g
                key={player.id ?? playerIndex}
                transform={`translate(${x}, ${y})`}
                className={`player-marker ${isCurrent ? 'player-marker--current' : ''}`}
              >
                {isCurrent && (
                  <circle
                    r="20"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="3"
                    opacity="0.95"
                    filter="url(#game-board-glow)"
                    className="current-player-ring"
                  />
                )}
                <circle
                  r="14"
                  fill={PLAYER_COLORS[playerIndex % PLAYER_COLORS.length]}
                  stroke="#020617"
                  strokeWidth="3"
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#07101c"
                  fontSize="8"
                  fontWeight="900"
                >
                  {initials(player.name)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {!ambient && (
        <div className="game-board-focus-row">
          <span className="game-board-focus-label">Jump to player</span>
          {players.map((player, playerIndex) => {
            const isYou = localPlayerId !== null && player.id === localPlayerId

            return (
              <button
                type="button"
                data-online-allowed="true"
                key={player.id ?? playerIndex}
                onClick={() => focusPlayer(playerIndex, { boostZoom: true })}
                title={`Center the map on ${player.name}`}
                className={`player-focus-button ${
                  playerIndex === currentPlayerIndex ? 'player-focus-button--current' : ''
                }`}
              >
                <span
                  className="player-focus-dot"
                  style={{ background: PLAYER_COLORS[playerIndex % PLAYER_COLORS.length] }}
                />
                {player.name}{isYou ? ' · You' : ''}
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
