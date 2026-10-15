import { useMemo, useState } from 'react'
import { DEMO_MINES } from './demoMines'
import approvedBoardArtwork from './assets/demoMinesApproved.png'

// This is the *approved* layout image, not a replacement for the board graph.
// The picture is the faithful browser design reference; live hit targets, route
// inspection and the conveyor switch use DEMO_MINES below. The board is not yet
// a playable Party map, and no changes are made to Booststone Ruins.
const IMAGE_WIDTH = 1341
const IMAGE_HEIGHT = 1173

// Coordinate registration between the V3 board's edit-friendly 1240×1020 grid
// and the final approved 1341×1173 browser artwork. Keep this transform in one
// place so future node/layout edits don't become hard-coded SVG hit targets.
function artPosition(node) {
  return {
    x: Math.round(node.x * 1.018 + 24),
    y: Math.round(node.y * 1.023 - 7),
  }
}

const boardButton = (selected) => ({
  color: '#f8fafc', background: selected ? '#704923' : '#1b2c3e',
  border: `1px solid ${selected ? '#e7b855' : '#5c7288'}`,
  borderRadius: 9, padding: '9px 13px', minHeight: 40,
  fontWeight: 800, cursor: 'pointer',
})

function linePoints(a, b) {
  // Preview-only route inspection, not movement code. The west VS connection
  // squares off BEFORE entering the north-west Event, not halfway along a lane.
  if (a.id === 'd42' && b.id === 'd12') {
    const corner = artPosition({x: 405, y: a.y})
    const above = artPosition({x: 405, y: b.y})
    return [artPosition(a), corner, above, artPosition(b)]
  }
  const start = artPosition(a), end = artPosition(b)
  if (start.x !== end.x && start.y !== end.y && !['d31', 'd32', 'd33', 'd34', 'd35'].includes(a.id)) {
    return [start, {x: end.x, y: start.y}, end]
  }
  return [start, end]
}

const toSvgPath = (points) => points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')

export default function DemoMinesPreview({ board = DEMO_MINES }) {
  const [lane, setLane] = useState(board.defaultConveyorLane || 'lower')
  const [selectedId, setSelectedId] = useState(null)
  const [showGraph, setShowGraph] = useState(false)
  const [showIds, setShowIds] = useState(false)
  const allNodes = useMemo(() => [...board.nodes, ...board.stops], [board])
  const lookup = useMemo(() => Object.fromEntries(allNodes.map(n => [n.id, n])), [allNodes])
  const selected = selectedId ? lookup[selectedId] : null
  const selectedPoint = selected ? artPosition(selected) : null

  function inspect(node) {
    setSelectedId(node.id)
    // These Event spaces reverse the one active upper conveyor direction.
    if (board.switchEvents.includes(node.id)) setLane(current => current === 'lower' ? 'upper' : 'lower')
  }

  return <div style={{ width: '100%', minWidth: 0, color: '#eaf1fa' }}>
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 5px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <strong style={{ fontSize: 13, color: '#f5dfa2' }}>Top conveyor:</strong>
        <button type="button" style={boardButton(lane === 'lower')} onClick={() => setLane('lower')} aria-pressed={lane === 'lower'}>↙ Lucky route</button>
        <button type="button" style={boardButton(lane === 'upper')} onClick={() => setLane('upper')} aria-pressed={lane === 'upper'}>↖ Egg / VS route</button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', fontSize: 13 }}>
        <label><input type="checkbox" checked={showGraph} onChange={event => setShowGraph(event.target.checked)} /> Inspect paths</label>
        <label><input type="checkbox" checked={showIds} onChange={event => setShowIds(event.target.checked)} /> Space IDs</label>
      </div>
    </div>

    <svg viewBox={`0 0 ${IMAGE_WIDTH} ${IMAGE_HEIGHT}`} role="group" aria-label="Interactive Demo Mines design preview, based on approved layout" style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 13, background: '#20140f' }}>
      <defs>
        <filter id="dm-approved-focus-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feDropShadow dx="0" dy="0" stdDeviation="7" floodColor="#f9e376" floodOpacity="1" />
        </filter>
        <marker id="dm-approved-route-arrow" orient="auto" markerWidth="7" markerHeight="7" refX="6" refY="3.5"><path d="M0 0L7 3.5L0 7Z" fill="#69eeff" /></marker>
      </defs>
      <image href={approvedBoardArtwork} x="0" y="0" width={IMAGE_WIDTH} height={IMAGE_HEIGHT} preserveAspectRatio="none" />

      {/* Default image shows the lower/Lucky route. Highlight the upper route
          *when selected* without destroying the original approved composition. */}
      {lane === 'upper' && <g aria-hidden="true" pointerEvents="none">
        <path d="M 904 135 L 825 73 L 655 73 L 488 73 L 406 135" fill="none" stroke="#181816" strokeWidth="13" strokeLinejoin="round" opacity=".85" />
        <path d="M 904 135 L 825 73 L 655 73 L 488 73 L 406 135" fill="none" stroke="#f5c451" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="18 9" />
        {[[825,73],[488,73]].map(([x,y],i) => <circle key={i} cx={x} cy={y} r="25" fill="none" stroke="#f6dc7b" strokeWidth="4" />)}
      </g>}

      {/* The route graph is always real data, and can be inspected on demand.
          The presentation artwork itself is just a fixed 2D design background. */}
      {showGraph && <g fill="none" pointerEvents="none" opacity=".92">
        {board.edges.map(edge => {
          if (edge.lane && edge.lane !== lane) return null
          const from = lookup[edge.from], to = lookup[edge.to]
          if (!from || !to) return null
          const d = toSvgPath(linePoints(from, to))
          return <g key={edge.id}>
            <path d={d} stroke="#091b28" strokeWidth="8" strokeLinejoin="round" />
            <path d={d} stroke="#69eeff" strokeWidth="3" strokeLinejoin="round" markerEnd="url(#dm-approved-route-arrow)" />
          </g>
        })}
      </g>}

      {/* The image already contains each visible circle and tiny non-space dot.
          Transparent accessible hit regions prevent a duplicate set of spaces. */}
      {allNodes.map(node => {
        const pos = artPosition(node)
        const isStop = Boolean(node.nonSpace)
        return <g key={node.id} role="button" tabIndex={0} aria-label={`${node.name}, ${isStop ? 'free stop' : node.type}`} style={{ cursor: 'pointer', outline: 'none' }}
          onClick={() => inspect(node)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') {event.preventDefault(); inspect(node)} }}>
          <circle cx={pos.x} cy={pos.y} r={isStop ? 20 : 29} fill="transparent" pointerEvents="all" />
          {showIds && <text x={pos.x} y={pos.y - (isStop ? 17 : 31)} fill="#ffffff" fontSize="16" fontWeight="900" textAnchor="middle" paintOrder="stroke" stroke="#14222c" strokeWidth="5" pointerEvents="none">{node.id}</text>}
          <title>{node.id}: {node.name} ({isStop ? 'stop, not a space' : node.type})</title>
        </g>
      })}
      {/* The approved artwork omits one Blue on the right climbing stair. The
          map data keeps it, because deleting a playable space would silently
          change the route. Reveal it in the route-inspection layer only. */}
      {showGraph && <g pointerEvents="none">
        {(() => {const pos = artPosition(lookup.d28); return <g><circle cx={pos.x} cy={pos.y} r="22" fill="#3489f5" stroke="white" strokeWidth="4" /><text x={pos.x} y={pos.y+6} fontSize="12" fontWeight="bold" textAnchor="middle" fill="white">28</text></g>})()}
      </g>}
      {selectedPoint && <g pointerEvents="none" filter="url(#dm-approved-focus-glow)">
        <circle cx={selectedPoint.x} cy={selectedPoint.y} r={selected.nonSpace ? 15 : 31} fill="none" stroke="#ffe26b" strokeWidth="5" />
      </g>}
    </svg>

    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px 17px', color: '#bed1e1', padding: '10px 4px', fontSize: 12 }}>
      <span><b>{board.nodes.length}</b> playable spaces</span><span><b>{board.stops.length}</b> tiny junction/service stops (free)</span>
      <span>Spawn platform isn't a space</span><span>Click either conveyor Event to switch the top route</span>
    </div>
    <div role="status" aria-live="polite" style={{ background: '#142638', border: '1px solid #37566f', borderRadius: 11, padding: '12px 14px', minHeight: 64, fontSize: 14, lineHeight: 1.5 }}>
      {selected ? <>
        <strong>{selected.name}</strong> ({selected.id}) — {selected.nonSpace ? 'Free stop, not a dice step' : `${selected.type}, level L${selected.level}`}.
        {' '}<span style={{ color: '#b9cce2' }}>Next: {selected.next.map(id => lookup[id]?.name || id).join(' / ') || 'none'}.</span>
        {board.switchEvents.includes(selected.id) && <span style={{ color: '#f3ce82' }}> Conveyor switched to the {lane} route.</span>}
      </> : <>Approved layout is now shown directly in your browser. Select a space to inspect its actual route, or enable “Inspect paths” to see the graph on top of the artwork.</>}
    </div>
  </div>
}
