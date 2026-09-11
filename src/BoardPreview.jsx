import { useMemo, useState } from 'react'
import { generateBoard } from './boardGenerator'
import { layoutBoard, edgeKey } from './boardLayout'

const SPACE_COLORS = {
  Start: '#22c55e',
  Finish: '#facc15',
  Mechanic: '#2563eb',
  Action: '#8b5cf6',
  Battle: '#ef4444',
  Event: '#f97316',
  'Action Shop': '#14b8a6',
  'Choose Difficulty': '#ec4899',
  'Shortcut Gate': '#eab308',
}

function getSpaceColor(type) {
  return SPACE_COLORS[type] || '#64748b'
}

function routeToPath(points) {
  if (!points || points.length < 2) return ''

  let path = `M ${points[0].x} ${points[0].y}`

  for (let i = 1; i < points.length; i++) {
    const point = points[i]

    if (i === points.length - 1) {
      path += ` L ${point.x} ${point.y}`
    } else {
      const next = points[i + 1]

      const midX = (point.x + next.x) / 2
      const midY = (point.y + next.y) / 2

      path += ` Q ${point.x} ${point.y} ${midX} ${midY}`
    }
  }

  return path
}

function getNodeLabel(node) {
  if (node.route === 'main') {
    return node.mainIndex
  }

  if (node.route === 'shortcut') {
    return `S${Number(node.id.split('-').at(-1)) + 1}`
  }

  if (node.route === 'fork') {
    const pieces = node.id.split('-')

    return `F${Number(pieces[2]) + 1}`
  }

  return ''
}

export default function BoardPreview() {
  const [seed, setSeed] = useState('TEST123')

  const board = useMemo(
    () => generateBoard(seed),
    [seed]
  )

  const layout = useMemo(
    () => layoutBoard(board),
    [board]
  )

  const [zoom, setZoom] = useState(() => {
    if (
      typeof window !== 'undefined' &&
      window.innerWidth < 700
    ) {
      return 0.7
    }

    return 1
  })

  const nodeMap = useMemo(
    () =>
      Object.fromEntries(
        board.nodes.map((node) => [
          node.id,
          {
            ...node,
            ...layout.positions[node.id],
          },
        ])
      ),
    [board, layout]
  )

  function generateNewBoard() {
    setSeed(
      `${Date.now()}-${Math.floor(
        Math.random() * 100000
      )}`
    )
  }

  const {
    minX,
    minY,
    width,
    height,
  } = layout.bounds

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top, #17243d 0%, #09101d 45%, #04070d 100%)',
        color: 'white',
        padding: '18px',
        fontFamily:
          'Inter, system-ui, Arial, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: '1400px',
          margin: '0 auto',
        }}
      >
        {/* HEADER */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '14px',
            flexWrap: 'wrap',
            marginBottom: '16px',
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 'clamp(22px, 5vw, 32px)',
              }}
            >
              Rocket League Board
            </h1>

            <p
              style={{
                margin: '6px 0 0',
                color: '#94a3b8',
                fontSize: '14px',
              }}
            >
              {board.nodes.length} spaces ·{' '}
              {board.forks.length} forks ·{' '}
              {board.finalStretch}-space final stretch
            </p>
          </div>

          <button
            onClick={generateNewBoard}
            style={{
              background:
                'linear-gradient(135deg, #2563eb, #7c3aed)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              padding: '11px 17px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Generate New Board
          </button>
        </div>

        {/* CONTROLS */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
            background: '#111827',
            border: '1px solid #263449',
            borderRadius: '12px',
            padding: '9px 11px',
            marginBottom: '12px',
          }}
        >
          <strong
            style={{
              fontSize: '13px',
              marginRight: '5px',
            }}
          >
            Map
          </strong>

          <button
            onClick={() =>
              setZoom((current) =>
                Math.max(0.45, current - 0.1)
              )
            }
          >
            −
          </button>

          <span
            style={{
              minWidth: '48px',
              textAlign: 'center',
              fontSize: '13px',
            }}
          >
            {Math.round(zoom * 100)}%
          </span>

          <button
            onClick={() =>
              setZoom((current) =>
                Math.min(1.4, current + 0.1)
              )
            }
          >
            +
          </button>

          <button onClick={() => setZoom(1)}>
            Reset
          </button>

          <span
            style={{
              marginLeft: 'auto',
              color: '#94a3b8',
              fontSize: '12px',
            }}
          >
            Scroll to explore
          </span>
        </div>

        {/* BOARD */}
        <div
          style={{
            height: '72vh',
            minHeight: '500px',
            overflow: 'auto',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-x pan-y',
            background:
              'linear-gradient(180deg, #0c1628, #080f1d)',
            border: '1px solid #334155',
            borderRadius: '18px',
            boxShadow:
              '0 20px 65px rgba(0,0,0,0.42)',
          }}
        >
          <svg
            width={width * zoom}
            height={height * zoom}
            viewBox={`${minX} ${minY} ${width} ${height}`}
            style={{
              display: 'block',
            }}
          >
            <defs>
              <filter id="importantGlow">
                <feGaussianBlur
                  stdDeviation="4"
                  result="blur"
                />

                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* PATHS */}
            {board.nodes.flatMap((node) =>
              node.next.map((nextId) => {
                const nextNode = nodeMap[nextId]

                if (!nextNode) return null

                const route =
                  layout.edgeRoutes[
                    edgeKey(node.id, nextId)
                  ] || [
                    layout.positions[node.id],
                    layout.positions[nextId],
                  ]

                const isShortcut =
                  node.route === 'shortcut' ||
                  nextNode.route === 'shortcut'

                const isFork =
                  node.route === 'fork' ||
                  nextNode.route === 'fork'

                return (
                  <path
                    key={`${node.id}-${nextId}`}
                    d={routeToPath(route)}
                    fill="none"
                    stroke={
                      isShortcut
                        ? '#facc15'
                        : isFork
                          ? '#64748b'
                          : '#475569'
                    }
                    strokeWidth={
                      isShortcut ? 9 : 7
                    }
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={
                      isShortcut
                        ? '15 11'
                        : undefined
                    }
                    opacity="0.95"
                  />
                )
              })
            )}

            {/* SPACES */}
            {board.nodes.map((node) => {
              const positioned =
                nodeMap[node.id]

              if (
                !positioned ||
                !Number.isFinite(positioned.x) ||
                !Number.isFinite(positioned.y)
              ) {
                return null
              }

              const important =
                node.type === 'Start' ||
                node.type === 'Finish' ||
                node.type === 'Shortcut Gate'

              const color =
                getSpaceColor(node.type)

              return (
                <g
                  key={node.id}
                  transform={`translate(${positioned.x}, ${positioned.y})`}
                >
                  {/* dark outside ring */}
                  <circle
                    r={important ? 37 : 31}
                    fill="#050914"
                    opacity="0.92"
                  />

                  <circle
                    r={important ? 30 : 25}
                    fill={color}
                    stroke={
                      important
                        ? '#ffffff'
                        : '#cbd5e1'
                    }
                    strokeWidth={
                      important ? 4 : 2
                    }
                    filter={
                      important
                        ? 'url(#importantGlow)'
                        : undefined
                    }
                  />

                  <text
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize={
                      important ? 12 : 11
                    }
                    fontWeight="900"
                  >
                    {getNodeLabel(node)}
                  </text>

                  <rect
                    x="-52"
                    y="39"
                    width="104"
                    height="22"
                    rx="9"
                    fill="#020617"
                    opacity="0.91"
                  />

                  <text
                    textAnchor="middle"
                    y="54"
                    fill="#e2e8f0"
                    fontSize="9"
                    fontWeight="700"
                  >
                    {node.type}
                  </text>
                </g>
              )
            })}

            {/* START */}
            {nodeMap[board.startId] && (
              <text
                x={nodeMap[board.startId].x}
                y={nodeMap[board.startId].y - 52}
                textAnchor="middle"
                fill="#86efac"
                fontSize="17"
                fontWeight="900"
              >
                START
              </text>
            )}

            {/* FINISH */}
            {nodeMap[board.finishId] && (
              <text
                x={nodeMap[board.finishId].x}
                y={nodeMap[board.finishId].y - 52}
                textAnchor="middle"
                fill="#fde047"
                fontSize="17"
                fontWeight="900"
              >
                FINISH
              </text>
            )}
          </svg>
        </div>

        {/* SHORTCUT RULE */}
        <div
          style={{
            marginTop: '14px',
            padding: '13px 15px',
            borderRadius: '12px',
            background:
              'rgba(234,179,8,0.08)',
            border:
              '1px solid rgba(250,204,21,0.3)',
            fontSize: '13px',
          }}
        >
          <strong style={{ color: '#fde047' }}>
            Shortcut:
          </strong>{' '}
          Hard mechanic · 1 attempt · succeed to
          take the shortcut · miss and lose{' '}
          <strong>1 point</strong>.
        </div>

        {/* LEGEND */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '7px',
            marginTop: '13px',
          }}
        >
          {Object.entries(SPACE_COLORS).map(
            ([name, color]) => (
              <div
                key={name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#111827',
                  border:
                    '1px solid #263449',
                  borderRadius: '8px',
                  padding: '6px 9px',
                  fontSize: '11px',
                  color: '#cbd5e1',
                }}
              >
                <span
                  style={{
                    width: '9px',
                    height: '9px',
                    borderRadius: '50%',
                    background: color,
                  }}
                />

                {name}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}