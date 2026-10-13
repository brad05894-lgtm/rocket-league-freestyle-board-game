import { useMemo, useState } from 'react'
import { BOOSTSTONE_RUINS } from './booststoneRuins'
import { DEMO_MINES } from './demoMines'

const DEFAULT_COLORS = {
  Start: '#22c55e',
  Mechanic: '#3b82f6',
  'Danger Mechanic': '#ef4444',
  Card: '#a855f7',
  Battle: '#f59e0b',
  Event: '#22c55e',
  Lucky: '#10b981',
  'Bad Luck': '#7c3aed',
  Junction: '#111318',
  Shop: '#14b8a6',
  Lakitu: '#0ea5e9',
  Paratroopa: '#84cc16',
}

function edgeKey(fromId, toId) {
  return `${fromId}->${toId}`
}

function routePoints(board, from, to) {
  const via = board.edgeRoutes?.[edgeKey(from.id, to.id)] || []
  if (via.length) return [[from.x, from.y], ...via, [to.x, to.y]]

  // Keep most prototype paths orthogonal so the layout reads like a board map.
  if (from.x !== to.x && from.y !== to.y) {
    const horizontalFirst = Math.abs(to.x - from.x) >= Math.abs(to.y - from.y)
    return horizontalFirst
      ? [[from.x, from.y], [to.x, from.y], [to.x, to.y]]
      : [[from.x, from.y], [from.x, to.y], [to.x, to.y]]
  }

  return [[from.x, from.y], [to.x, to.y]]
}

function pointString(points) {
  return points.map(([x, y]) => `${x},${y}`).join(' ')
}

function nodeGlyph(type) {
  if (type === 'Start') return 'S'
  if (type === 'Danger Mechanic') return '!'
  if (type === 'Card') return 'C'
  if (type === 'Battle') return 'VS'
  if (type === 'Event') return '!'
  if (type === 'Lucky') return '★'
  if (type === 'Bad Luck') return '?'
  if (type === 'Junction') return '↗'
  if (type === 'Shop') return '$'
  if (type === 'Lakitu') return 'L'
  if (type === 'Paratroopa') return 'P'
  return ''
}

function BoardSvg({ board }) {
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
        result.push({ id: edgeKey(node.id, nextId), from: node, to: next })
      }
    }
    return result
  }, [board, nodeMap])

  const colors = { ...DEFAULT_COLORS, ...(board.spaceColors || {}) }
  const isDemo = board.id === 'demo-mines'

  return (
    <svg
      viewBox={`0 0 ${board.width} ${board.height}`}
      role="img"
      aria-label={`${board.name} layout prototype`}
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      <defs>
        <linearGradient id={`lab-bg-${board.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={isDemo ? '#4f1f17' : '#10251f'} />
          <stop offset="1" stopColor={isDemo ? '#1e1411' : '#07130f'} />
        </linearGradient>
        <filter id={`lab-shadow-${board.id}`} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="4" stdDeviation="5" floodOpacity="0.42" />
        </filter>
        <marker
          id={`lab-arrow-${board.id}`}
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="4"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L8,4 L0,8 Z" fill="rgba(255,255,255,.58)" />
        </marker>
        {isDemo && (
          <pattern id="demo-grate" width="20" height="20" patternUnits="userSpaceOnUse">
            <rect width="20" height="20" fill="#4a3429" />
            <path d="M0 0L20 20M20 0L0 20" stroke="#d77a3544" strokeWidth="2" />
          </pattern>
        )}
      </defs>

      <rect x="8" y="8" width={board.width - 16} height={board.height - 16} rx="34" fill={`url(#lab-bg-${board.id})`} stroke="rgba(255,255,255,.15)" strokeWidth="4" />

      {(board.terrain || []).map((zone) => (
        <polygon
          key={zone.id}
          points={zone.points}
          fill={zone.id?.includes('grate') && isDemo ? 'url(#demo-grate)' : (zone.fill || (isDemo ? '#4e4339' : '#173228'))}
          stroke={isDemo ? '#d29b6455' : '#7bbf9950'}
          strokeWidth={4 + Number(zone.elevation || 0)}
          opacity={0.92}
        />
      ))}

      {isDemo && (
        <>
          <path d="M48 520 C78 430 90 350 62 255" fill="none" stroke="#ff6b1a" strokeWidth="26" opacity=".8" />
          <path d="M1190 520 C1150 430 1152 325 1180 245" fill="none" stroke="#22c55e" strokeWidth="18" opacity=".22" />
          <text x="75" y="215" fill="#ffbd74" fontSize="26" fontWeight="900">LAVA</text>
          <text x="1080" y="790" fill="#86efac" fontSize="22" fontWeight="900">CRYSTAL MINE</text>
        </>
      )}

      {(board.transportLinks || []).map((link) => (
        <g key={link.id} opacity=".55">
          <line x1={link.from[0]} y1={link.from[1]} x2={link.to[0]} y2={link.to[1]} stroke="#fbbf24" strokeWidth="5" strokeDasharray="12 12" />
          <title>{link.label}</title>
        </g>
      ))}

      <g fill="none" stroke="rgba(236,242,255,.38)" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
        {edges.map(({ id, from, to }) => (
          <polyline
            key={id}
            points={pointString(routePoints(board, from, to))}
            markerEnd={`url(#lab-arrow-${board.id})`}
          />
        ))}
      </g>

      {(board.landmarks || []).map((landmark) => {
        if (landmark.kind === 'king-bobomb') {
          return (
            <g key={landmark.id} transform={`translate(${landmark.x} ${landmark.y})`} filter={`url(#lab-shadow-${board.id})`}>
              <circle r={landmark.radius || 70} fill="#171717" stroke="#fbbf24" strokeWidth="8" />
              <circle cy="-17" r="21" fill="#fbbf24" />
              <circle cx="-22" cy="3" r="8" fill="white" />
              <circle cx="22" cy="3" r="8" fill="white" />
              <rect x="-25" y="48" width="50" height="34" rx="10" fill="#15803d" stroke="#86efac" strokeWidth="4" />
              <text y="72" textAnchor="middle" fill="white" fontSize="30" fontWeight="900">{landmark.countdown || 5}</text>
              <text y="-92" textAnchor="middle" fill="#ffe6b5" fontSize="22" fontWeight="900">{landmark.label}</text>
            </g>
          )
        }

        if (landmark.kind === 'conveyor') {
          return (
            <g key={landmark.id} transform={`translate(${landmark.x} ${landmark.y})`}>
              <rect x={-(landmark.width || 260) / 2} y={-(landmark.height || 50) / 2} width={landmark.width || 260} height={landmark.height || 50} rx="12" fill="#171717" stroke="#facc15" strokeWidth="5" />
              <text textAnchor="middle" y="7" fill="#facc15" fontSize="23" fontWeight="900">⇦ ⇦ ⇦ ⇦</text>
              <text textAnchor="middle" y="-37" fill="#fef3c7" fontSize="18" fontWeight="800">{landmark.label}</text>
            </g>
          )
        }

        return (
          <g key={landmark.id} transform={`translate(${landmark.x} ${landmark.y})`}>
            <rect x="-56" y="-22" width="112" height="44" rx="13" fill={isDemo ? '#2d211cdd' : '#0b1c18dd'} stroke={landmark.kind === 'gold' ? '#facc15' : '#cbd5e1'} strokeWidth="3" />
            <text textAnchor="middle" y="6" fill="white" fontSize="15" fontWeight="900">{landmark.label}</text>
          </g>
        )
      })}

      <g>
        {board.nodes.map((node) => {
          const color = colors[node.type] || '#64748b'
          const special = node.special ? board.boardEvents?.[node.special] : null
          const glyph = nodeGlyph(node.type)
          const radius = node.type === 'Battle' ? 22 : 19
          return (
            <g key={node.id} transform={`translate(${node.x} ${node.y})`} filter={`url(#lab-shadow-${board.id})`}>
              {node.trophySpot && <circle r="30" fill="none" stroke="#facc15" strokeWidth="5" strokeDasharray="5 4" />}
              {node.convertedFrom === 'Ally' && <circle r="26" fill="none" stroke="#f0abfc" strokeWidth="3" strokeDasharray="3 4" />}
              <circle r={radius} fill={color} stroke="white" strokeWidth="4" />
              {glyph && (
                <text textAnchor="middle" y={node.type === 'Battle' ? 5 : 6} fill="white" fontSize={node.type === 'Battle' ? 10 : 14} fontWeight="1000">
                  {glyph}
                </text>
              )}
              <title>
                {`${node.id} · ${node.type}${node.convertedFrom ? ` · converted from ${node.convertedFrom}` : ''}${special ? ` · ${special.name}` : ''}`}
              </title>
            </g>
          )
        })}
      </g>
    </svg>
  )
}

export default function BoardDesignLab({ onBack }) {
  const [selectedId, setSelectedId] = useState('demo-mines')
  const boards = [DEMO_MINES, BOOSTSTONE_RUINS]
  const board = boards.find((entry) => entry.id === selectedId) || DEMO_MINES

  const typeCounts = useMemo(() => {
    const counts = {}
    for (const node of board.nodes) counts[node.type] = (counts[node.type] || 0) + 1
    return counts
  }, [board])

  const colors = { ...DEFAULT_COLORS, ...(board.spaceColors || {}) }

  const shell = {
    minHeight: '100vh',
    background: 'radial-gradient(circle at top, #17243d 0%, #09101d 48%, #04070d 100%)',
    color: 'white',
    padding: '18px',
    fontFamily: 'Inter, system-ui, Arial, sans-serif',
  }

  const panel = {
    background: '#0b1422e8',
    border: '1px solid #334155',
    borderRadius: '16px',
    padding: '14px',
    boxShadow: '0 16px 55px rgba(0,0,0,.32)',
  }

  const button = (active = false) => ({
    border: active ? '1px solid #facc15' : '1px solid #475569',
    background: active ? '#3a3212' : '#111827',
    color: 'white',
    borderRadius: '11px',
    padding: '10px 14px',
    cursor: 'pointer',
    fontWeight: 850,
  })

  return (
    <main style={shell}>
      <div style={{ maxWidth: 1500, margin: '0 auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
          <div>
            <div style={{ color: '#facc15', fontWeight: 900, letterSpacing: '.08em', fontSize: 12 }}>TEMPORARY BOARD DESIGN LAB</div>
            <h1 style={{ margin: '5px 0 4px', fontSize: 'clamp(26px,4vw,42px)' }}>{board.name}</h1>
            <p style={{ margin: 0, color: '#b8c5d8', maxWidth: 900 }}>{board.subtitle}</p>
          </div>
          <button type="button" onClick={onBack} style={button(false)}>Back Home</button>
        </header>

        <div style={{ ...panel, display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 14 }}>
          {boards.map((entry) => (
            <button key={entry.id} type="button" style={button(entry.id === board.id)} onClick={() => setSelectedId(entry.id)}>
              {entry.name}
            </button>
          ))}
          <span style={{ alignSelf: 'center', marginLeft: 'auto', color: '#94a3b8', fontSize: 13 }}>
            Layout/design preview only — Party gameplay is untouched.
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, 340px)', gap: 14, alignItems: 'start' }}>
          <section style={{ ...panel, padding: 8, overflow: 'hidden' }}>
            <div style={{ aspectRatio: `${board.width} / ${board.height}`, minHeight: 520 }}>
              <BoardSvg board={board} />
            </div>
          </section>

          <aside style={{ display: 'grid', gap: 12 }}>
            <section style={panel}>
              <h2 style={{ margin: '0 0 10px', fontSize: 18 }}>Board Summary</h2>
              <p style={{ margin: '5px 0' }}><strong>{board.nodes.length}</strong> spaces</p>
              <p style={{ margin: '5px 0' }}><strong>{board.trophySpots?.length || 0}</strong> prototype Trophy locations</p>
              <p style={{ margin: '5px 0' }}><strong>{board.defaultTrophyPrice}</strong> Tokens per Trophy</p>
              {board.prototypeOnly && <p style={{ margin: '9px 0 0', color: '#fbbf24' }}>Not connected to live Party Mode.</p>}
            </section>

            <section style={panel}>
              <h2 style={{ margin: '0 0 10px', fontSize: 18 }}>Space Mix</h2>
              <div style={{ display: 'grid', gap: 7 }}>
                {Object.entries(typeCounts).map(([type, count]) => (
                  <div key={type} style={{ display: 'grid', gridTemplateColumns: '18px 1fr auto', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 14, height: 14, borderRadius: '50%', background: colors[type] || '#64748b', border: '1px solid white' }} />
                    <span>{type}</span>
                    <strong>{count}</strong>
                  </div>
                ))}
              </div>
            </section>

            {board.id === 'demo-mines' && (
              <section style={panel}>
                <h2 style={{ margin: '0 0 10px', fontSize: 18 }}>Demo Mines First Pass</h2>
                <div style={{ display: 'grid', gap: 8, color: '#d5deea', fontSize: 13, lineHeight: 1.42 }}>
                  {(board.designNotes || []).map((note) => <div key={note}>• {note}</div>)}
                </div>
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #334155', color: '#e9d5ff', fontSize: 12 }}>
                  Dashed lavender rings mark the three former Ally spaces so they are easy to review in this temporary prototype.
                </div>
              </section>
            )}
          </aside>
        </div>
      </div>

      <style>{`
        @media (max-width: 980px) {
          main > div > div[style*="grid-template-columns"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </main>
  )
}
