import { useMemo, useState } from 'react'
import { BOOSTSTONE_RUINS } from './booststoneRuins'
import { DEMO_MINES } from './demoMines'
import DemoMinesPreview from './DemoMinesPreview'

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


// Decorative-only art: the board's routes, node IDs and space types are unchanged.
function DemoMineScenery({ foreground = false }) {
  if (!foreground) return <g aria-hidden="true">
    {/* The cavern wall stays behind the routes so circles remain legible. */}
    <path d="M12 178L85 125L152 155L194 58L284 95L351 24H901L956 90L1080 66L1155 143L1228 135V835H12Z" fill="#5e2b1e" opacity=".55" />
    <path d="M14 235L138 200L166 225L286 164L326 191L934 173L1046 199L1159 180L1226 207" stroke="#d67b43" strokeWidth="16" opacity=".18" fill="none" />
    <path d="M14 350C50 376 52 432 36 472C6 522 30 572 20 659L170 658C177 584 133 542 152 482C176 409 128 363 110 336Z" fill="url(#mine-lava)" opacity=".9" />
    <path d="M16 456C68 471 78 528 62 570M40 639Q74 619 112 632" fill="none" stroke="#ffde7d" strokeWidth="9" strokeLinecap="round" opacity=".65" />
    <path d="M1058 585L1178 554L1216 585L1228 807L1062 812Z" fill="#14342a" stroke="#2c6548" strokeWidth="7" />
    {/* Upper-left mine machinery: a ferris-style ore lift. */}
    <g transform="translate(112 129)" stroke="#c68f50" fill="none" opacity=".8">
      <circle r="53" strokeWidth="12" /> <circle r="37" strokeWidth="3" /> <circle r="12" fill="#5c4236" strokeWidth="6" />
      {Array.from({ length: 8 }, (_, i) => <g key={i} transform={`rotate(${45 * i})`}><line y1="-12" y2="-54" strokeWidth="5"/><rect x="-10" y="-63" width="20" height="12" rx="2" fill="#503c2f" stroke="#f4bd65" strokeWidth="2" /></g>)}
      <path d="M-33 46L-63 90M33 46L63 90M-73 90H73" strokeWidth="8" />
    </g>
    {/* Industrial ventilation pipes and overhead tubes. */}
    <path d="M1035 112V44Q1035 25 1053 25H1122Q1142 25 1142 45V158" stroke="#172d2a" strokeWidth="32" fill="none" />
    <path d="M1035 112V44Q1035 25 1053 25H1122Q1142 25 1142 45V158" stroke="#56826a" strokeWidth="19" fill="none" />
    <rect x="1085" y="91" width="90" height="55" rx="12" fill="#29463a" stroke="#a17d46" strokeWidth="8" />
  </g>
  return <g aria-hidden="true">
    {/* Side decks and the raised iron court have deeper walls. */}
    <rect x="435" y="283" width="370" height="275" rx="14" fill="#121a19" stroke="#261a12" strokeWidth="20" opacity=".75" />
    <rect x="444" y="289" width="352" height="255" rx="8" fill="url(#mine-court-grid)" stroke="#d2a348" strokeWidth="7" opacity=".45" />
    <g fill="#67df60" stroke="#132d1b" strokeWidth="4" fontWeight="900" fontSize="23" textAnchor="middle">
      {[[440,376],[800,376],[440,505],[800,505]].map(([x,y],i)=><g key={i}><rect x={x-23} y={y-23} width="46" height="46" rx="6" fill="#132a1c" stroke="#ba963e" /><text x={x} y={y+8} fill="#63e75c" stroke="none">5</text></g>)}
    </g>
    <path d="M468 282H772M468 543H772" stroke="#f3bd3f" strokeWidth="9" strokeDasharray="24 14" opacity=".52" />
    {/* Grates on the lower-left and lower-right glow from below. */}
    {[[154,610],[214,620],[273,640],[932,612],[1015,645],[1100,665]].map(([x,y],i)=><g key={i} transform={`translate(${x} ${y})`}>
      <rect x="-21" y="-13" width="43" height="27" fill="#a14820" opacity=".5" />
      <path d="M-20 -13H21M-20 0H21M-20 13H21M-18 -13V13M0 -13V13M20 -13V13" stroke="#e7a45a" strokeWidth="2" opacity=".7" />
    </g>)}
    {/* Crystals, distinct from game spaces. */}
    {[[1110,740,1],[1175,701,.8],[1084,806,.75],[1210,785,1.1],[1134,834,.55],[1172,610,.6]].map(([x,y,k],i)=><g key={i} transform={`translate(${x} ${y}) scale(${k})`}>
      <polygon points="0,-49 18,-12 10,27 -20,26 -26,-10" fill="url(#mine-crystal)" stroke="#84ffb8" strokeWidth="3" />
      <polygon points="0,-49 0,26 -20,26 -26,-10" fill="#00773d" opacity=".54" />
    </g>)}
    {/* Ore haulers and a stretch of railway. */}
    {[[115,785,0],[946,405,-8]].map(([x,y,r],i)=><g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
      <path d="M-48 18H110M-48 36H110" stroke="#a7794c" strokeWidth="6" />
      {Array.from({length:8},(_,j)=><line key={j} x1={-45+j*21} x2={-45+j*21} y1="15" y2="41" stroke="#57412b" strokeWidth="9" />)}
      <path d="M-12 -12H55L43 15H-4Z" fill="#665042" stroke="#ebaf66" strokeWidth="4" />
      <circle cx="4" cy="18" r="10" fill="#20201f" stroke="#d1a276" strokeWidth="3"/><circle cx="38" cy="18" r="10" fill="#20201f" stroke="#d1a276" strokeWidth="3" />
      <polygon points="0,-12 16,-35 31,-12" fill="#d4aa45" />
    </g>)}
    <g fontWeight="900" fontSize="19" textAnchor="middle" letterSpacing="1">
      <text x="96" y="330" fill="#ffce74">LAVA FALLS</text>
      <text x="1131" y="876" fill="#7af5b5">CRYSTAL CAVERN</text>
      <text x="612" y="873" fill="#f2c885" fontSize="17">MINE ENTRANCE</text>
    </g>
  </g>
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
          markerUnits="userSpaceOnUse"
          markerWidth="15"
          markerHeight="15"
          refX="13"
          refY="7"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L14,7 L0,14 Z" fill="rgba(255,255,255,.65)" />
        </marker>
        {isDemo && <>
          <linearGradient id="mine-lava" x1="0" y1="0" x2=".5" y2="1"><stop offset="0" stopColor="#ffdf4f"/><stop offset=".42" stopColor="#fc6e16"/><stop offset="1" stopColor="#b6210e"/></linearGradient>
          <linearGradient id="mine-crystal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#b0ffc8"/><stop offset=".5" stopColor="#22c672"/><stop offset="1" stopColor="#06754d"/></linearGradient>
          <pattern id="mine-court-grid" width="38" height="38" patternUnits="userSpaceOnUse"><rect width="38" height="38" fill="#27372f"/><path d="M0 0H38V38H0Z" fill="none" stroke="#8e9981" strokeWidth="2"/><circle cx="8" cy="8" r="2" fill="#8f9c88"/><circle cx="29" cy="29" r="2" fill="#8f9c88"/></pattern>
          <pattern id="mine-steel" width="44" height="44" patternUnits="userSpaceOnUse"><rect width="44" height="44" fill="#6b6257"/><path d="M0 0H44V44H0Z" fill="none" stroke="#b3a493" strokeWidth="2"/><circle cx="6" cy="6" r="3" fill="#302b2a"/><circle cx="38" cy="38" r="3" fill="#302b2a"/></pattern>
        </>}
        {isDemo && (
          <pattern id="demo-grate" width="20" height="20" patternUnits="userSpaceOnUse">
            <rect width="20" height="20" fill="#4a3429" />
            <path d="M0 0L20 20M20 0L0 20" stroke="#d77a3544" strokeWidth="2" />
          </pattern>
        )}
      </defs>

      <rect x="8" y="8" width={board.width - 16} height={board.height - 16} rx="34" fill={`url(#lab-bg-${board.id})`} stroke="rgba(255,255,255,.15)" strokeWidth="4" />

      {isDemo && <DemoMineScenery />}

      {(board.terrain || []).map((zone) => (
        <g key={zone.id}>
        {isDemo && <polygon points={zone.points} transform="translate(0 14)" fill="#1e1512" stroke="#170e0d" strokeWidth="12" opacity=".7" />}
        <polygon
          points={zone.points}
          fill={isDemo ? (zone.id?.includes('grate') ? 'url(#demo-grate)' : zone.id === 'king-court' ? 'url(#mine-court-grid)' : 'url(#mine-steel)') : (zone.fill || '#173228')}
          stroke={isDemo ? '#d29b6455' : '#7bbf9950'}
          strokeWidth={4 + Number(zone.elevation || 0)}
          opacity={0.95}
        />
        </g>
      ))}

      {isDemo && <DemoMineScenery foreground />}

      {(!isDemo ? (board.transportLinks || []) : []).map((link) => (
        <g key={link.id} opacity=".55">
          <line x1={link.from[0]} y1={link.from[1]} x2={link.to[0]} y2={link.to[1]} stroke="#fbbf24" strokeWidth="5" strokeDasharray="12 12" />
          <title>{link.label}</title>
        </g>
      ))}

      <g fill="none" stroke={isDemo ? 'rgba(240,250,255,.7)' : 'rgba(236,242,255,.38)'} strokeWidth={isDemo ? 5 : 8} strokeLinecap="round" strokeLinejoin="round">
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
          return <g key={landmark.id} transform={`translate(${landmark.x} ${landmark.y})`} filter={`url(#lab-shadow-${board.id})`}>
            <ellipse cy="49" rx="67" ry="22" fill="#08140e" opacity=".6" />
            {/* Cartoon bomb mascot, not an imported Mario asset. */}
            <circle r="56" cy="-2" fill="#171820" stroke="#f6c453" strokeWidth="6" />
            <path d="M-36 -44L-30 -72L-12 -59L0 -82L15 -61L34 -76L37 -43Z" fill="#ffcc35" stroke="#7d4b12" strokeWidth="5" />
            <circle cx="-20" cy="-13" r="10" fill="white" /><circle cx="17" cy="-13" r="10" fill="white" />
            <ellipse cx="-18" cy="-11" rx="3" ry="5" fill="#0c151c"/><ellipse cx="19" cy="-11" rx="3" ry="5" fill="#0c151c" />
            <path d="M-17 28Q0 42 18 27" fill="none" stroke="#f9f6ed" strokeWidth="7" strokeLinecap="round" />
            <circle cx="-61" cy="18" r="17" fill="#ecedea"/><circle cx="61" cy="18" r="17" fill="#ecedea" />
            <rect x="-21" y="46" width="42" height="36" rx="6" fill="#0e713c" stroke="#b0f285" strokeWidth="4" />
            <text y="73" textAnchor="middle" fill="white" fontSize="31" fontWeight="1000">{landmark.countdown || 5}</text>
            <title>King Bob-omb countdown: {landmark.countdown || 5} (prototype only)</title>
          </g>
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
              <circle r={radius+7} fill="#06111b" stroke={isDemo ? '#c0a783' : '#d3e1e7'} strokeWidth="3" opacity=".9" />
              <circle r={radius} fill={color} stroke="#f8f9fb" strokeWidth="3.5" />
              {isDemo && <ellipse cy={-radius/3} rx={radius*.7} ry={radius*.25} fill="white" opacity=".2" />}
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
            <div style={board.id === 'demo-mines' ? {width: '100%'} : {aspectRatio: `${board.width} / ${board.height}`, minHeight: 520}}>
              {board.id === 'demo-mines' ? <DemoMinesPreview board={board} /> : <BoardSvg board={board} />}
            </div>
          </section>

          <aside style={{ display: 'grid', gap: 12 }}>
            <section style={panel}>
              <h2 style={{ margin: '0 0 10px', fontSize: 18 }}>Board Summary</h2>
              <p style={{ margin: '5px 0' }}><strong>{board.nodes.length}</strong> playable spaces</p>
              {board.stops && <p style={{ margin: '5px 0' }}><strong>{board.stops.length}</strong> free junctions/services</p>}
              {board.startDeck && <p style={{ margin: '5px 0', color: '#b6e7d2' }}>Large entrance deck (not counted)</p>}
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
                <h2 style={{ margin: '0 0 10px', fontSize: 18 }}>Demo Mines — Approved Browser Layout v4</h2>
                <div style={{ display: 'grid', gap: 8, color: '#d5deea', fontSize: 13, lineHeight: 1.42 }}>
                  {(board.designNotes || []).map((note) => <div key={note}>• {note}</div>)}
                </div>
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #334155', color: '#e9d5ff', fontSize: 12 }}>
                  Lavender rings mark the three former Ally spaces. Click a pink switching Event to flip the upper conveyor. The giant soccer bomb, mini bomb, stairs, shops and steal stop are preview-only; none of these features is active in Party gameplay.
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
