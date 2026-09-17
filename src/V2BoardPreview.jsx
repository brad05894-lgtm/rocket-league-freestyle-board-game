import { useMemo } from 'react'
import { BOOSTSTONE_RUINS } from './booststoneRuins'
import { getPartyCar } from './partyCars'

const SPACE_COLORS = {
  Start: '#22c55e',
  Mechanic: '#3b82f6',
  'Danger Mechanic': '#ef4444',
  Card: '#a855f7',
  Battle: '#06b6d4',
  Event: '#f59e0b',
  Lucky: '#10b981',
  'Bad Luck': '#7c3aed',
}

function edgeKey(fromId, toId) {
  return `${fromId}->${toId}`
}

export default function V2BoardPreview({ onBack, backLabel = 'Back Home', partyInfo = null }) {
  const board = BOOSTSTONE_RUINS

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
        result.push({
          id: edgeKey(node.id, nextId),
          from: node,
          to: next,
        })
      }
    }

    return result
  }, [board, nodeMap])

  const typeCounts = useMemo(() => {
    const counts = {}
    for (const node of board.nodes) {
      counts[node.type] = (counts[node.type] || 0) + 1
    }
    return counts
  }, [board])

  return (
    <div className="game v2-preview-screen">
      <div className="v2-preview-header">
        <div>
          <div className="game-hud__eyebrow">V2 MAP FOUNDATION</div>
          <h1>{board.name}</h1>
          <p>{board.subtitle}</p>
        </div>

        {onBack && (
          <button type="button" onClick={onBack}>
            {backLabel}
          </button>
        )}
      </div>

      <div className="v2-preview-summary">
        <span><strong>{board.nodes.length}</strong> spaces</span>
        <span><strong>2–4</strong> players</span>
        <span><strong>{board.defaultTrophyPrice}</strong> Tokens per Trophy</span>
        <span><strong>{board.trophySpots.length}</strong> Trophy locations</span>
      </div>

      {partyInfo && (
        <div className="party-live-strip">
          <span><strong>Room {partyInfo.roomCode}</strong></span>
          <span>Round <strong>{partyInfo.currentRound}</strong> / {partyInfo.rounds}</span>
          <span><strong>{partyInfo.players.length}</strong> player{partyInfo.players.length === 1 ? '' : 's'}</span>
          <span>Party lobby sync test active</span>
          {partyInfo.players.map((player) => {
            const car = getPartyCar(player.carId)
            return (
              <span key={player.id}>
                <strong>{player.name}</strong>: {car ? car.name : 'No car'}
              </span>
            )
          })}
        </div>
      )}

      <div className="v2-board-scroll">
        <svg
          className="v2-board-svg"
          viewBox={`0 0 ${board.width} ${board.height}`}
          role="img"
          aria-label={`${board.name} fixed board preview`}
        >
          <defs>
            <marker
              id="v2-board-arrow"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L8,4 L0,8 Z" fill="rgba(226,232,240,.65)" />
            </marker>
          </defs>

          <rect x="15" y="15" width={board.width - 30} height={board.height - 30} rx="38" className="v2-board-bg" />

          <g className="v2-board-ruins" aria-hidden="true">
            <rect x="105" y="130" width="410" height="250" rx="24" />
            <rect x="590" y="125" width="335" height="245" rx="24" />
            <rect x="245" y="385" width="545" height="210" rx="24" />
          </g>

          <g className="v2-board-edges">
            {edges.map(({ id, from, to }) => (
              <line
                key={id}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                markerEnd="url(#v2-board-arrow)"
              />
            ))}
          </g>

          <g className="v2-board-specials">
            {board.shops.map((shop) => (
              <g key={shop.id} transform={`translate(${shop.x} ${shop.y})`}>
                <rect x="-45" y="-18" width="90" height="36" rx="12" className="v2-board-shop" />
                <text textAnchor="middle" dominantBaseline="central">SHOP</text>
              </g>
            ))}

            {board.gates.map((gate) => (
              <g key={gate.id} transform={`translate(${gate.x} ${gate.y})`}>
                <rect x="-40" y="-16" width="80" height="32" rx="10" className="v2-board-gate" />
                <text textAnchor="middle" dominantBaseline="central">GATE</text>
              </g>
            ))}
          </g>

          <g className="v2-board-nodes">
            {board.nodes.map((node) => {
              const fill = SPACE_COLORS[node.type] || '#64748b'
              const special = node.special ? board.boardEvents[node.special] : null

              return (
                <g key={node.id} transform={`translate(${node.x} ${node.y})`}>
                  {node.trophySpot && (
                    <circle r="29" className="v2-board-trophy-ring" />
                  )}
                  <circle r="17" fill={fill} className="v2-board-node" />
                  {node.type === 'Start' && (
                    <text className="v2-board-node-label" textAnchor="middle" y="4">S</text>
                  )}
                  {node.trophySpot && (
                    <text className="v2-board-trophy-label" textAnchor="middle" y="-24">T</text>
                  )}
                  {special && (
                    <title>{`${special.name}: ${special.description}`}</title>
                  )}
                </g>
              )
            })}
          </g>
        </svg>
      </div>

      <div className="v2-preview-grid">
        <section className="rules-box">
          <h2>Space Mix</h2>
          <div className="v2-space-legend">
            {Object.entries(typeCounts).map(([type, count]) => (
              <div key={type} className="v2-space-legend__item">
                <span className="v2-space-dot" style={{ background: SPACE_COLORS[type] || '#64748b' }} />
                <span>{type}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="rules-box">
          <h2>Map 1 Gimmicks</h2>
          <p><strong>Garage Gates:</strong> two toll blockers control important routes and can switch which route they block.</p>
          <p><strong>Boost Reactor Chain:</strong> three one-use Event triggers knock cars caught in that lane back to its entrance.</p>
          <p><strong>3 Supply Crates:</strong> choose one mystery crate for a random reward.</p>
          <p><strong>Trophies:</strong> one active Trophy at a time, chosen from 5 possible locations. Standard price: 10 Tokens.</p>
        </section>
      </div>

      <div className="rules-box v2-preview-note">
        <strong>{partyInfo ? 'Stage 2 Party test:' : 'Stage 1 preview:'}</strong>{' '}
        {partyInfo
          ? 'the online room, player count, round setting, and unique car selections are synced. Actual dice rolling and board movement come next.'
          : 'this screen is the fixed Party Mode map foundation. Classic Mode stays untouched while Party Mode is built separately.'}
      </div>
    </div>
  )
}
