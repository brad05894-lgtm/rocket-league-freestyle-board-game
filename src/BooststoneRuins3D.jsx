import { onValue, ref as databaseRef } from 'firebase/database'
import { db } from './firebase'
import { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import layout from './booststoneV7Layout.json'

const MODEL_URL = `${import.meta.env.BASE_URL || '/'}models/booststone-v7.glb`
const COLORS = ['#f8fafc', '#fbbf24', '#38bdf8', '#f472b6']
const DECK = [4.975, 0.71, 5.875]
const CAMERA = [5, 18, 20]
const TARGET = [0, 0.6, 0.3]
const BALL_DURATION = 3.2
const LEGACY_GATES = {
  'garage-gate-bridge-east': 'bridge_east',
  'garage-gate-bridge-west': 'bridge_west',
  'garage-gate-west': 'west_straight',
  'garage-gate-center': 'west_branch',
}

function SpriteLabel({ text, y = 0.42, width = 1.05 }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 128
    const c = canvas.getContext('2d')
    c.font = 'bold 48px system-ui, sans-serif'
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.lineJoin = 'round'
    c.lineWidth = 9
    c.strokeStyle = '#07110e'
    c.strokeText(String(text), 256, 64, 490)
    c.fillStyle = '#ffffff'
    c.fillText(String(text), 256, 64, 490)
    const result = new THREE.CanvasTexture(canvas)
    result.colorSpace = THREE.SRGBColorSpace
    return result
  }, [text])
  useEffect(() => () => texture.dispose(), [texture])
  return <sprite position={[0, y, 0]} scale={[width, 0.26, 1]}>
    <spriteMaterial map={texture} transparent depthWrite={false} />
  </sprite>
}

function BoardModel({ board, room, finalFive, closedGarageGateId, showNumbers, ballRun, clockOffset }) {
  const invalidate = useThree((state) => state.invalidate)
  const gltf = useGLTF(MODEL_URL)
  const model = useMemo(() => {
    const scene = gltf.scene.clone(true)
    const spaces = {}, doors = [], originals = []
    let trophy = null, ball = null
    scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
      const { role, nodeId, gateId } = o.userData
      if (role === 'space') spaces[nodeId] = o
      if (role === 'door') doors.push({ object: o, gateId, rest: o.position.clone() })
      if (role === 'trophy') trophy = o
      if (role === 'ball') ball = o
    })
    // Only Bad Luck materials need private copies for final-five recoloring.
    for (const node of board.nodes) {
      if (node.type !== 'Bad Luck') continue
      spaces[node.id]?.traverse((o) => {
        if (!o.isMesh) return
        const source = Array.isArray(o.material) ? o.material : [o.material]
        const mats = source.map((m) => {
          const copy = m.clone()
          originals.push({ material: copy, color: copy.color.clone() })
          return copy
        })
        o.material = Array.isArray(o.material) ? mats : mats[0]
      })
    }
    if (!ball || !trophy || Object.keys(spaces).length !== 66) throw new Error('Incomplete board model')
    return { scene, spaces, doors, trophy, ball, originals,
      ballRest: ball.position.clone(), ballRotation: ball.quaternion.clone(), trophyScale: trophy.scale.clone() }
  }, [gltf.scene, board.nodes])
  const initialized = useRef(false)
  const trophyReveal = useRef(0)
  const gateId = board.gates?.find((g) => g.id === closedGarageGateId)?.modelGateId
    || LEGACY_GATES[closedGarageGateId] || ''

  useEffect(() => {
    for (const { object, rest, gateId: id } of model.doors) {
      if (!initialized.current) object.position.copy(rest).add(new THREE.Vector3(0, id === gateId && !room.turnState?.gatePassApproved ? 0 : 0.81, 0))
    }
    initialized.current = true
  }, [model, gateId])
  useEffect(() => {
    const id = room.activeTrophyNodeId
    const anchor = layout.nodes[id]
    model.trophy.visible = Boolean(anchor)
    if (anchor) {
      model.trophy.position.set(anchor[0], anchor[1] + 0.04, anchor[2])
      model.trophy.scale.copy(model.trophyScale).multiplyScalar(0.01)
      trophyReveal.current = performance.now()
    }
    Object.entries(model.spaces).forEach(([nodeId, object]) => { object.visible = nodeId !== id })
  }, [model, room.activeTrophyNodeId])
  useEffect(() => {
    model.originals.forEach(({ material, color }) => {
      material.color.copy(finalFive ? new THREE.Color('#14151a') : color)
    })
  }, [model, finalFive])

  useEffect(() => {
    invalidate()
  }, [invalidate, model, gateId, room.activeTrophyNodeId, room.turnState?.gatePassApproved, room.boardMotion, finalFive, ballRun])

  useFrame((_, dt) => {
    let moving = false
    const motion = room.boardMotion
    const moveEnd = Number(motion?.startedAt || 0) + Math.max(0, (motion?.path?.length || 1)-1) * (motion?.stepMs || 280)
    const crossing = Date.now() + clockOffset < moveEnd + 200 && motion?.openGateId === closedGarageGateId
    const reveal = Math.min(1, (performance.now() - trophyReveal.current) / 500)
    model.trophy.scale.copy(model.trophyScale).multiplyScalar(1 - Math.pow(1-reveal, 3))
    if (reveal < 1 || crossing) moving = true
    for (const { object, rest, gateId: id } of model.doors) {
      const target = rest.y + (id === gateId && !room.turnState?.gatePassApproved && !crossing ? 0 : 0.81)
      if (Math.abs(object.position.y - target) > 0.001) {
        object.position.y = THREE.MathUtils.damp(object.position.y, target, 7, Math.min(dt, 0.1))
        moving = true
      } else {
        object.position.y = target
      }
    }
    const elapsed = ballRun ? (performance.now() - ballRun.started) / 1000 : Infinity
    if (elapsed >= 0 && elapsed < BALL_DURATION) {
      moving = true
      const t = Math.pow(elapsed / BALL_DURATION, 1.35)
      const distance = ((1102 - 288) / 80) * t
      model.ball.position.copy(model.ballRest)
      model.ball.position.x += distance
      model.ball.position.y -= distance * (1.25 / ((1104 - 264) / 80))
      model.ball.quaternion.copy(model.ballRotation)
      model.ball.rotateZ(-distance / 0.48)
    } else {
      model.ball.position.copy(model.ballRest)
      model.ball.quaternion.copy(model.ballRotation)
    }
    if (moving || (ballRun && elapsed < 0)) invalidate()
  })
  return <>
    <primitive object={model.scene} dispose={null} />
    {showNumbers && Object.entries(layout.nodes).map(([id, p]) =>
      <group key={id} position={p}><SpriteLabel text={id.slice(1)} y={0.22} width={0.38} /></group>
    )}
  </>
}

function AnimatedPiece({ position, motion, playerId, clockOffset, followPoint, isActive, children }) {
  const ref = useRef()
  const invalidate = useThree((state) => state.invalidate)
  useEffect(() => { invalidate() }, [motion, position, invalidate])
  useFrame(() => {
    if (!ref.current) return
    const elapsed = Date.now() + clockOffset - Number(motion?.startedAt || 0)
    const path = motion?.playerId === playerId ? motion.path || [] : []
    const stepMs = motion?.stepMs || 280
    const duration = Math.max(0, path.length - 1) * stepMs
    if (path.length > 1 && elapsed >= 0 && elapsed < duration) {
      const step = Math.min(path.length - 2, Math.floor(elapsed / stepMs))
      const a = layout.nodes[path[step]], b = layout.nodes[path[step + 1]]
      if (a && b) {
        const t = (elapsed % stepMs) / stepMs
        ref.current.position.set(a[0] + (b[0]-a[0])*t, a[1] + (b[1]-a[1])*t + 0.14 + Math.sin(t*Math.PI)*0.08, a[2] + (b[2]-a[2])*t)
      }
      invalidate()
    } else ref.current.position.set(...position)
    if (isActive) followPoint.current.copy(ref.current.position)
  })
  return <group ref={ref} position={position}>{children}</group>
}

function PlayerTokens({ board, room, players, activePlayer, turnOrderPhase, turnOrderRolls, ballRun, clockOffset, followPoint }) {
  return <group>{players.map((p, i) => {
    const setup = room.playerSetup?.[p.id] || {}
    const onDeck = turnOrderPhase || setup.onStartDeck === true
    const held = ballRun?.positions[p.id]
    const point = onDeck ? DECK : layout.nodes[held || setup.boardNodeId || board.startId]
    if (!point) return null
    const offset = onDeck ? 0.28 : 0.11
    const position = [point[0] + (i % 2 ? offset : -offset), point[1] + (onDeck ? 0 : 0.14), point[2] + (i < 2 ? -offset : offset)]
    const roll = Number(turnOrderRolls?.[p.id]) || 0
    return <AnimatedPiece key={p.id} position={position} motion={room.boardMotion} playerId={p.id} clockOffset={clockOffset} followPoint={followPoint} isActive={p.id === activePlayer?.id}>
      <mesh castShadow>
        <sphereGeometry args={[0.17, 18, 12]} />
        <meshStandardMaterial color={COLORS[i % COLORS.length]} roughness={0.5} />
      </mesh>
      {!turnOrderPhase && p.id === activePlayer?.id && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.13, 0]}>
        <ringGeometry args={[0.22, 0.29, 24]} /><meshBasicMaterial color="#fde047" side={THREE.DoubleSide} />
      </mesh>}
      <SpriteLabel text={`${p.name}${turnOrderPhase && roll ? ` • ${roll}` : ''}`} />
    </AnimatedPiece>
  })}</group>
}

function CameraControls({ resetKey, follow, followPoint }) {
  const ref = useRef()
  const { camera, size, invalidate } = useThree()
  const fit = Math.max(14, Math.min(size.width / 17, size.height / 17))
  useEffect(() => {
    camera.position.set(...CAMERA)
    camera.zoom = fit
    camera.lookAt(...TARGET)
    camera.updateProjectionMatrix()
    ref.current?.target.set(...TARGET)
    ref.current?.update()
  }, [camera, fit, resetKey])
  useFrame((_, dt) => {
    if (!follow || !ref.current || !followPoint.current) return
    const desired = followPoint.current
    const difference = desired.clone().sub(ref.current.target)
    if (difference.lengthSq() > 0.0001) {
      difference.multiplyScalar(1 - Math.exp(-4 * Math.min(dt, 0.1)))
      camera.position.add(difference)
      ref.current.target.add(difference)
      ref.current.update()
      invalidate()
    }
  })
  return <OrbitControls ref={ref} makeDefault target={TARGET} enableRotate
    minPolarAngle={0.15} maxPolarAngle={Math.PI / 2 - 0.08}
    enablePan enableZoom enableDamping dampingFactor={0.12} panSpeed={0.5}
    minZoom={fit * 0.65} maxZoom={fit * 2.5} />
}

class ModelErrorBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error) { console.error('Booststone model could not load:', error) }
  render() {
    if (this.state.failed) return <div role="alert" style={{ padding: 32, color: '#fff' }}>
      The 3D board could not load. You can switch back to 2D above.
      <p>Check that public/models/booststone-v7.glb was copied, then refresh.</p>
    </div>
    return this.props.children
  }
}

export default function BooststoneRuins3D({ board, room, players = [], activePlayer,
  finalFive = false, closedGarageGateId = '', turnOrderPhase = false, turnOrderRolls = {} }) {
  const [quality, setQuality] = useState('performance')
  const [follow, setFollow] = useState(false)
  const [clockOffset, setClockOffset] = useState(0)
  const followPoint = useRef(new THREE.Vector3(...TARGET))
  useEffect(() => onValue(databaseRef(db, '.info/serverTimeOffset'), (snapshot) => setClockOffset(Number(snapshot.val()) || 0)), [])
  const [resetKey, setResetKey] = useState(0)
  const [showNumbers, setShowNumbers] = useState(false)
  const [ballRun, setBallRun] = useState(null)
  const previousPositions = useRef({})
  const seenEvent = useRef('')
  const effect = room.turnState?.eventEffect
  const eventKey = effect?.id === 'reactor-trigger-c'
    ? `${room.startedAt}:${room.currentRound}:${room.turnIndex}:${room.turnState?.playerId}:${effect.id}` : ''
  useEffect(() => {
    if (!eventKey) seenEvent.current = ''
    if (eventKey && eventKey !== seenEvent.current) {
      seenEvent.current = eventKey
      const positions = {}
      for (const id of effect.affectedPlayerIds || []) {
        const before = previousPositions.current[id]
        const landed = id === room.turnState?.playerId ? room.turnState?.landedNodeId : null
        const node = landed || before
        if (node && layout.nodes[node]) positions[id] = node
      }
      const motion = room.boardMotion
      const moveEnd = Number(motion?.startedAt || 0) + Math.max(0, (motion?.path?.length || 1) - 1) * (motion?.stepMs || 280)
      const startedAt = Math.max(Number(effect.animationStartedAt) || 0, moveEnd)
      const elapsed = Date.now() + clockOffset - startedAt
      if (startedAt && elapsed < BALL_DURATION * 1000 && elapsed > -15000) {
        setBallRun({ started: performance.now() - elapsed, positions: effect.fromPositions || positions })
      }
    }
    // Keep the pre-event snapshot so knockback appears after the ball passes.
    previousPositions.current = Object.fromEntries(players.map((p) => [p.id, room.playerSetup?.[p.id]?.boardNodeId]))
  }, [eventKey, effect, players, room.playerSetup, room.turnState?.playerId, room.turnState?.landedNodeId, room.boardMotion, clockOffset])
  useEffect(() => {
    if (!ballRun) return undefined
    const timer = window.setTimeout(() => setBallRun(null), Math.max(0, ballRun.started + BALL_DURATION * 1000 - performance.now()))
    return () => window.clearTimeout(timer)
  }, [ballRun])
  useEffect(() => {
    if (!eventKey) previousPositions.current = Object.fromEntries(players.map((p) => [p.id, room.playerSetup?.[p.id]?.boardNodeId]))
  }, [room.playerSetup, players, eventKey])

  const button = { border: '1px solid #ffffff44', borderRadius: 8, background: '#10231fed', color: '#fff', padding: '7px 10px', cursor: 'pointer' }
  return <div style={{ position: 'relative', width: '100%', height: 'min(76vh, 820px)', minHeight: 420,
    borderRadius: 18, overflow: 'hidden', border: '1px solid #8ca69c66', background: '#182a28' }}>
    <div style={{ position: 'absolute', zIndex: 2, top: 12, left: 12, color: '#eef9f6', fontSize: 12, pointerEvents: 'none' }}>
      Left-drag: rotate • right-drag: pan • scroll: zoom
    </div>
    <div style={{ position: 'absolute', zIndex: 2, right: 12, top: 36, display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 'calc(100% - 24px)', gap: 6 }}>
      <button type="button" style={button} onClick={() => setFollow((v) => !v)}>{follow ? 'Following player' : 'Follow player'}</button>
      <select aria-label="3D graphics quality" value={quality} onChange={(event) => setQuality(event.target.value)} style={button}>
        <option value="performance">Performance</option>
        <option value="low">Low graphics</option>
        <option value="detail">Detailed shadows</option>
      </select>
      <button type="button" style={button} onClick={() => setShowNumbers((v) => !v)}>{showNumbers ? 'Hide numbers' : 'Show numbers'}</button>
      <button type="button" style={button} onClick={() => setResetKey((v) => v + 1)}>Reset view</button>
    </div>
    <ModelErrorBoundary>
      <Canvas orthographic frameloop="demand" shadows={quality === 'detail'} dpr={quality === 'low' ? 0.75 : 1} camera={{ position: CAMERA, zoom: 35, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}>
        <color attach="background" args={['#182a28']} />
        <fog attach="fog" args={['#243a36', 29, 55]} />
        <hemisphereLight color="#dce9e3" groundColor="#36483f" intensity={1.6} />
        <directionalLight position={[-5, 12, 8]} color="#fff3df" intensity={2.1} castShadow={quality === 'detail'}
          shadow-mapSize-width={1024} shadow-mapSize-height={1024}
          shadow-camera-left={-10} shadow-camera-right={10} shadow-camera-top={10} shadow-camera-bottom={-10}
          shadow-bias={-0.001} />
        <directionalLight position={[6, 6, -8]} color="#9cc9db" intensity={0.8} />
        <Suspense fallback={<Html center><div style={{ color: '#fff', whiteSpace: 'nowrap' }}>Loading your board…</div></Html>}>
          <BoardModel board={board} room={room} finalFive={finalFive} closedGarageGateId={closedGarageGateId}
            showNumbers={showNumbers} ballRun={ballRun} clockOffset={clockOffset} />
          <PlayerTokens board={board} room={room} players={players} activePlayer={activePlayer}
            turnOrderPhase={turnOrderPhase} turnOrderRolls={turnOrderRolls} ballRun={ballRun} clockOffset={clockOffset} followPoint={followPoint} />
        </Suspense>
        <CameraControls resetKey={resetKey} follow={follow} followPoint={followPoint} />
      </Canvas>
    </ModelErrorBoundary>
  </div>
}
