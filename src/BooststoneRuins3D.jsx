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

function BoardModel({ board, room, finalFive, closedGarageGateIds = [], showNumbers, ballRun, clockOffset }) {
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
    // Junctions are navigation points, not Mechanic spaces. Give every choice dot
    // the same dark/black junction treatment even if the GLB originally baked one blue.
    for (const node of board.nodes) {
      if (node.type !== 'Junction') continue
      spaces[node.id]?.traverse((o) => {
        if (!o.isMesh) return
        const source = Array.isArray(o.material) ? o.material : [o.material]
        const mats = source.map((m) => {
          const copy = m.clone()
          if (copy.color) copy.color.set('#111318')
          if (copy.emissive) copy.emissive.set('#000000')
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
  const closedGateKey = (closedGarageGateIds || []).join('|')
  const closedModelGateIds = useMemo(() => new Set(
    (closedGarageGateIds || []).map((closedId) =>
      board.gates?.find((gate) => gate.id === closedId)?.modelGateId || LEGACY_GATES[closedId] || ''
    ).filter(Boolean)
  ), [board.gates, closedGateKey])

  useEffect(() => {
    for (const { object, rest, gateId: id } of model.doors) {
      if (!initialized.current) {
        object.position.copy(rest).add(new THREE.Vector3(0, closedModelGateIds.has(id) ? 0 : 0.81, 0))
      }
    }
    initialized.current = true
  }, [model, closedModelGateIds])
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
  }, [invalidate, model, closedGateKey, room.activeTrophyNodeId, room.boardMotion, finalFive, ballRun])

  useFrame((_, dt) => {
    let moving = false
    const motion = room.boardMotion
    const moveEnd = Number(motion?.startedAt || 0) + Math.max(0, (motion?.path?.length || 1)-1) * (motion?.stepMs || 280)
    const crossingModelGateId = board.gates?.find((gate) => gate.id === motion?.openGateId)?.modelGateId || LEGACY_GATES[motion?.openGateId] || ''
    const crossing = Boolean(crossingModelGateId) && Date.now() + clockOffset < moveEnd + 200
    const reveal = Math.min(1, (performance.now() - trophyReveal.current) / 500)
    model.trophy.scale.copy(model.trophyScale).multiplyScalar(1 - Math.pow(1-reveal, 3))
    if (reveal < 1 || crossing) moving = true
    for (const { object, rest, gateId: id } of model.doors) {
      const gateShouldBeClosed = closedModelGateIds.has(id) && !(crossing && id === crossingModelGateId)
      const target = rest.y + (gateShouldBeClosed ? 0 : 0.81)
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
      const point = id => id === 'start-deck' ? DECK : layout.nodes[id]
      const a = point(path[step]), b = point(path[step + 1])
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

function CameraControls({ resetKey, overview, followPoint, topDown }) {
  const ref = useRef()
  const { camera, size, invalidate } = useThree()
  const fit = Math.max(8, Math.min(size.width / 18, size.height / 17))
  const previous = useRef(null)
  useEffect(() => { previous.current = null; invalidate() }, [overview, fit, resetKey, invalidate])
  useEffect(() => {
    camera.position.set(...(topDown ? [TARGET[0],28,TARGET[2]+.01] : CAMERA))
    ref.current?.target.set(...TARGET)
    camera.zoom = fit
    camera.updateProjectionMatrix()
    previous.current = null
    invalidate()
  }, [resetKey, topDown, camera, invalidate])
  useFrame((_, dt) => {
    if (!ref.current) return
    if (overview && previous.current === overview) return
    const desired = overview ? new THREE.Vector3(...TARGET) : followPoint.current
    if (!desired) return
    const factor = 1 - Math.exp(-8 * Math.min(dt, .1))
    const delta = desired.clone().sub(ref.current.target)
    const zoom = fit * (overview ? 1 : 2.65)
    if (delta.lengthSq() > .00001 || Math.abs(camera.zoom - zoom) > .015) {
      delta.multiplyScalar(factor)
      camera.position.add(delta)
      ref.current.target.add(delta)
      camera.zoom += (zoom - camera.zoom) * factor
      camera.updateProjectionMatrix()
      ref.current.update()
      invalidate()
    } else previous.current = overview
    if (!overview) previous.current = false
  })
  return <OrbitControls ref={ref} makeDefault target={TARGET} enabled={overview}
    minPolarAngle={topDown ? 0 : .15} maxPolarAngle={topDown ? 0 : Math.PI / 2 - .08}
    enablePan enableZoom enableRotate={!topDown} enableDamping={false}
    minZoom={fit * .65} maxZoom={fit * 4} />
}

class ModelErrorBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error) { console.error('Booststone model could not load:', error) }
  render() {
    if (this.state.failed) return <div role="alert" style={{ padding: 32, color: '#fff' }}>
      The board could not load. Check the model file below, then refresh.
      <p>Check that public/models/booststone-v7.glb was copied, then refresh.</p>
    </div>
    return this.props.children
  }
}

export default function BooststoneRuins3D({ board, room, players = [], activePlayer,
  finalFive = false, closedGarageGateIds = [], turnOrderPhase = false, turnOrderRolls = {}, overview = false, quality = 'low', showNumbers = false, topDown = false }) {
  const [clockOffset, setClockOffset] = useState(0)
  const followPoint = useRef(new THREE.Vector3(...TARGET))
  useEffect(() => onValue(databaseRef(db, '.info/serverTimeOffset'), (snapshot) => setClockOffset(Number(snapshot.val()) || 0)), [])
  const [resetKey, setResetKey] = useState(0)
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

  const effectiveClosedGarageGateIds = closedGarageGateIds.length
    ? closedGarageGateIds
    : Object.values(room.boardState?.closedGarageGateIds || Object.fromEntries(
        (board.garageGatePairs || []).map((pair) => [pair.id, pair.defaultClosedGateId])
      )).filter(Boolean)

  return <div className="party-immersive-canvas" style={{ position:'absolute', inset:0, background:'#182a28' }}>
    <ModelErrorBoundary>
      <Canvas orthographic frameloop="demand" shadows={quality === 'detail'} dpr={quality === 'low' ? 0.75 : 1} camera={{ position: CAMERA, zoom: 35, near: 0.1, far: 100 }}
        gl={{ antialias: quality !== 'low', alpha: false, powerPreference: 'default' }}>
        <color attach="background" args={['#182a28']} />
        <fog attach="fog" args={['#243a36', 29, 55]} />
        <hemisphereLight color="#dce9e3" groundColor="#36483f" intensity={1.6} />
        <directionalLight position={[-5, 12, 8]} color="#fff3df" intensity={2.1} castShadow={quality === 'detail'}
          shadow-mapSize-width={1024} shadow-mapSize-height={1024}
          shadow-camera-left={-10} shadow-camera-right={10} shadow-camera-top={10} shadow-camera-bottom={-10}
          shadow-bias={-0.001} />
        <directionalLight position={[6, 6, -8]} color="#9cc9db" intensity={0.8} />
        <Suspense fallback={<Html center><div style={{ color: '#fff', whiteSpace: 'nowrap' }}>Loading your board…</div></Html>}>
          <BoardModel board={board} room={room} finalFive={finalFive} closedGarageGateIds={effectiveClosedGarageGateIds}
            showNumbers={showNumbers} ballRun={ballRun} clockOffset={clockOffset} />
          <PlayerTokens board={board} room={room} players={players} activePlayer={activePlayer}
            turnOrderPhase={turnOrderPhase} turnOrderRolls={turnOrderRolls} ballRun={ballRun} clockOffset={clockOffset} followPoint={followPoint} />
        </Suspense>
        <CameraControls topDown={topDown} resetKey={resetKey} overview={overview || turnOrderPhase} followPoint={followPoint} />
      </Canvas>
    </ModelErrorBoundary>
  </div>
}
