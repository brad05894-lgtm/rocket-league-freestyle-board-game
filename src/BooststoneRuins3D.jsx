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
// The chest terrace is the center landmark whose entrance is Event node n19.
// These are render-only coordinates; the player's authoritative board node stays n19.
const TREASURE_CENTER = [0.25, 1.56, -2.975]
const TREASURE_PLAYER = [1.72, 1.34, -2.93]
const TREASURE_CHEST_POSITIONS = [
  [-0.95, 1.5, -2.98],
  [0.25, 1.5, -2.98],
  [1.45, 1.5, -2.98],
]
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

function BoardModel({ board, room, finalFive, closedGarageGateIds = [], ballRun, clockOffset }) {
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
  const toModelGateId = (closedId) => board.gates?.find((gate) => gate.id === closedId)?.modelGateId || LEGACY_GATES[closedId] || ''
  const closedModelGateIds = useMemo(() => new Set(
    (closedGarageGateIds || []).map(toModelGateId).filter(Boolean)
  ), [board.gates, closedGateKey])
  const gateEffect = room.turnState?.eventEffect
  const previousClosedGateKey = gateEffect?.id?.startsWith('gate-switch-')
    ? JSON.stringify(gateEffect.previousClosedGarageGateIds || {}) : ''
  const previousClosedModelGateIds = useMemo(() => new Set(
    Object.values(gateEffect?.previousClosedGarageGateIds || {}).map(toModelGateId).filter(Boolean)
  ), [board.gates, previousClosedGateKey])

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
    Object.entries(model.spaces).forEach(([nodeId, object]) => { object.visible = nodeId !== id && !['Lucky','Bad Luck','Battle','Event'].includes(board.nodes.find(n=>n.id===nodeId)?.type) })
  }, [model, room.activeTrophyNodeId])
  useEffect(() => {
    model.originals.forEach(({ material, color }) => {
      material.color.copy(finalFive ? new THREE.Color('#14151a') : color)
    })
  }, [model, finalFive])

  useEffect(() => {
    invalidate()
  }, [invalidate, model, closedGateKey, room.activeTrophyNodeId, room.boardMotion, room.turnState?.eventEffect, room.turnState?.trophyCinematic, finalFive, ballRun])

  useFrame((_, dt) => {
    let moving = false
    const motion = room.boardMotion
    const moveEnd = Number(motion?.startedAt || 0) + Math.max(0, (motion?.path?.length || 1)-1) * (motion?.stepMs || 280)
    const crossingModelGateId = board.gates?.find((gate) => gate.id === motion?.openGateId)?.modelGateId || LEGACY_GATES[motion?.openGateId] || ''
    const crossing = Boolean(crossingModelGateId) && Date.now() + clockOffset < moveEnd + 200
    const reveal = Math.min(1, (performance.now() - trophyReveal.current) / 500)
    model.trophy.scale.copy(model.trophyScale).multiplyScalar(1 - Math.pow(1-reveal, 3))
    if (reveal < 1 || crossing) moving = true

    const trophyCinema = room.turnState?.trophyCinematic
    const trophyStartedAt = Number(trophyCinema?.startedAt) || 0
    const fromTrophy = layout.nodes[trophyCinema?.fromNodeId]
    const toTrophy = layout.nodes[trophyCinema?.toNodeId]
    if (trophyStartedAt && fromTrophy && toTrophy) {
      const elapsedTrophy = Date.now() + clockOffset - trophyStartedAt
      if (elapsedTrophy >= -250 && elapsedTrophy < 3300) {
        const travel = Math.max(0, Math.min(1, (elapsedTrophy - 850) / 1850))
        const smooth = travel * travel * (3 - 2 * travel)
        model.trophy.visible = true
        model.trophy.position.set(
          THREE.MathUtils.lerp(fromTrophy[0], toTrophy[0], smooth),
          THREE.MathUtils.lerp(fromTrophy[1] + 0.04, toTrophy[1] + 0.04, smooth) + Math.sin(Math.PI * smooth) * 0.9,
          THREE.MathUtils.lerp(fromTrophy[2], toTrophy[2], smooth)
        )
        const pulse = elapsedTrophy < 850
          ? 1 + 0.24 * Math.max(0, Math.sin(Math.max(0, elapsedTrophy) / 120))
          : 1
        model.trophy.scale.copy(model.trophyScale).multiplyScalar(pulse)
        moving = true
      }
    }

    // Garage Gate Event: switch the right pair first, then the left pair when
    // the camera cuts to it. This keeps the visible doors in sync with the
    // two-step cinematic instead of both pairs jumping at once.
    let visualClosedModelGateIds = closedModelGateIds
    const gateAnimation = room.turnState?.eventEffect
    if (gateAnimation?.id?.startsWith('gate-switch-') && Number(gateAnimation.animationStartedAt)) {
      const elapsedGate = Date.now() + clockOffset - Number(gateAnimation.animationStartedAt)
      if (elapsedGate < 0 && previousClosedModelGateIds.size) {
        visualClosedModelGateIds = previousClosedModelGateIds
      } else if (elapsedGate >= 0 && elapsedGate < 1900 && previousClosedModelGateIds.size) {
        const rightClosed = toModelGateId(gateAnimation.closedGarageGateIds?.right)
        const leftClosed = toModelGateId(gateAnimation.previousClosedGarageGateIds?.left)
        visualClosedModelGateIds = new Set([rightClosed, leftClosed].filter(Boolean))
      }
      if (elapsedGate >= -250 && elapsedGate < 3800) moving = true
    }

    for (const { object, rest, gateId: id } of model.doors) {
      const gateShouldBeClosed = visualClosedModelGateIds.has(id) && !(crossing && id === crossingModelGateId)
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
  return <><primitive object={model.scene} dispose={null} /><SpaceMarkers board={board} room={room} model={model} finalStretch={finalFive}/></>
}

function TreasureChests({ effect, clockOffset }) {
  const lidRefs = useRef([])
  const invalidate = useThree((state) => state.invalidate)
  const selected = Number.isInteger(effect?.selectedCrateIndex) ? effect.selectedCrateIndex : -1
  const openedAt = Number(effect?.openedAt) || 0

  useEffect(() => { invalidate() }, [effect?.id, effect?.selectedCrateIndex, effect?.openedAt, invalidate])
  useFrame((_, dt) => {
    if (!openedAt || selected < 0) return
    const elapsed = Date.now() + clockOffset - openedAt
    if (elapsed < -100 || elapsed > 1600) return
    const lid = lidRefs.current[selected]
    if (lid) {
      const target = -Math.PI * 0.46
      lid.rotation.x = THREE.MathUtils.damp(lid.rotation.x, target, 8, Math.min(dt, 0.1))
    }
    invalidate()
  })

  if (effect?.id !== 'supply-crates') return null
  return <group>{TREASURE_CHEST_POSITIONS.map((position, index) => {
    const isSelected = index === selected
    return <group key={index} position={position}>
      <mesh castShadow receiveShadow position={[0, 0.12, 0]}>
        <boxGeometry args={[0.72, 0.28, 0.48]} />
        <meshStandardMaterial color={isSelected ? '#b97924' : '#8a5a25'} roughness={0.78} metalness={0.05} />
      </mesh>
      <group ref={(value) => { lidRefs.current[index] = value }} position={[0, 0.29, -0.19]}>
        <mesh castShadow position={[0, 0.08, 0.19]}>
          <boxGeometry args={[0.74, 0.16, 0.5]} />
          <meshStandardMaterial color={isSelected ? '#d59b3f' : '#a66d2d'} roughness={0.7} metalness={0.08} />
        </mesh>
      </group>
      <mesh position={[0, 0.12, -0.252]}>
        <boxGeometry args={[0.12, 0.18, 0.035]} />
        <meshStandardMaterial color="#e4c66a" roughness={0.42} metalness={0.35} />
      </mesh>
      <SpriteLabel text={`${index + 1}`} y={0.72} width={0.42} />
    </group>
  })}</group>
}

function AnimatedPiece({ position, motion, playerId, clockOffset, followPoint, isActive, escape, treasure, children }) {
  const ref = useRef()
  const invalidate = useThree((state) => state.invalidate)
  useEffect(() => { invalidate() }, [motion, position, invalidate])
  useFrame(() => {
    if (!ref.current) return

    if (treasure) {
      const now = Date.now() + clockOffset
      const startedAt = Number(treasure.startedAt) || 0
      const openedAt = Number(treasure.openedAt) || 0
      const from = layout.nodes.n19
      const to = TREASURE_PLAYER
      if (startedAt && from && to) {
        let progress = Math.max(0, Math.min(1, (now - startedAt) / 1200))
        let activeTreasureMotion = !openedAt
        if (openedAt) {
          const sinceOpen = now - openedAt
          if (sinceOpen < 450) {
            progress = 1
            activeTreasureMotion = true
          } else if (sinceOpen < 1500) {
            const back = Math.max(0, Math.min(1, (sinceOpen - 450) / 1050))
            const smoothBack = back * back * (3 - 2 * back)
            progress = 1 - smoothBack
            activeTreasureMotion = true
          }
        }
        if (activeTreasureMotion) {
          const smooth = progress * progress * (3 - 2 * progress)
          ref.current.position.set(
            from[0] + (to[0] - from[0]) * smooth,
            from[1] + (to[1] - from[1]) * smooth + 0.14 + Math.sin(smooth * Math.PI) * 0.09,
            from[2] + (to[2] - from[2]) * smooth
          )
          if (isActive) followPoint.current.copy(ref.current.position)
          invalidate()
          return
        }
      }
    }

    const escapeElapsed = escape ? (performance.now() - escape.started) / 1000 : Infinity
    if (escape && escapeElapsed >= 0 && escapeElapsed < BALL_DURATION) {
      const a = layout.nodes[escape.fromNodeId]
      const b = layout.nodes[escape.toNodeId]
      if (a && b) {
        const raw = Math.max(0, Math.min(1, (escapeElapsed / BALL_DURATION - 0.18) / 0.72))
        const t = raw * raw * (3 - 2 * raw)
        ref.current.position.set(
          a[0] + (b[0] - a[0]) * t,
          a[1] + (b[1] - a[1]) * t + 0.14 + Math.abs(Math.sin(raw * Math.PI * 7)) * 0.08,
          a[2] + (b[2] - a[2]) * t
        )
        if (isActive) followPoint.current.copy(ref.current.position)
        invalidate()
        return
      }
    }
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
    const escape = held ? { fromNodeId: held, toNodeId: ballRun?.resetTo || 'n57', started: ballRun.started } : null
    const eventEffect = room.turnState?.eventEffect
    const treasure = eventEffect?.id === 'supply-crates' && p.id === room.turnState?.playerId && (!eventEffect.resolved || eventEffect.openedAt)
      ? { startedAt: eventEffect.animationStartedAt, openedAt: eventEffect.openedAt }
      : null
    return <AnimatedPiece key={p.id} position={position} motion={room.boardMotion} playerId={p.id} clockOffset={clockOffset} followPoint={followPoint} isActive={p.id === activePlayer?.id} escape={escape} treasure={treasure}>
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

function CameraControls({ resetKey, overview, followPoint, topDown, room, board, clockOffset, showcase }) {
  const ref = useRef()
  const { camera, size, invalidate } = useThree()
  const fit = Math.max(8, Math.min(size.width / 18, size.height / 17))
  const previous = useRef(null)
  const lastPose = useRef('')
  const broadcast = () => { if (!showcase?.host || !ref.current) return; const pose={position:camera.position.toArray(),target:ref.current.target.toArray(),viewHeight:(camera.top-camera.bottom)/camera.zoom};const key=JSON.stringify(pose);if(key!==lastPose.current){lastPose.current=key;showcase.onChange(pose)} }
  useEffect(() => { previous.current = null; invalidate() }, [overview, fit, resetKey, invalidate])
  useEffect(() => {
    camera.position.set(...(topDown ? [TARGET[0],28,TARGET[2]+.01] : CAMERA))
    ref.current?.target.set(...TARGET)
    camera.zoom = fit
    camera.updateProjectionMatrix()
    previous.current = null
    invalidate()
  }, [resetKey, topDown, overview, camera, invalidate])
  useEffect(()=>{invalidate()},[showcase?.camera,invalidate])
  useFrame((_, dt) => {
    if (!ref.current) return
    if (showcase && !showcase.host && showcase.camera) {
      const pose=showcase.camera;camera.position.fromArray(pose.position);ref.current.target.fromArray(pose.target)
      camera.zoom=(camera.top-camera.bottom)/pose.viewHeight;camera.updateProjectionMatrix();ref.current.update();return
    }
    if (overview && previous.current === overview) { broadcast(); return }
    let cinematicTarget = null
    const now = Date.now() + clockOffset
    const trophyCinema = room.turnState?.trophyCinematic
    const trophyStartedAt = Number(trophyCinema?.startedAt) || 0
    const fromTrophy = layout.nodes[trophyCinema?.fromNodeId]
    const toTrophy = layout.nodes[trophyCinema?.toNodeId]
    if (trophyStartedAt && fromTrophy && toTrophy && now - trophyStartedAt >= -250 && now - trophyStartedAt < 3300) {
      const travel = Math.max(0, Math.min(1, (now - trophyStartedAt - 850) / 1850))
      const smooth = travel * travel * (3 - 2 * travel)
      cinematicTarget = new THREE.Vector3(
        THREE.MathUtils.lerp(fromTrophy[0], toTrophy[0], smooth),
        THREE.MathUtils.lerp(fromTrophy[1], toTrophy[1], smooth),
        THREE.MathUtils.lerp(fromTrophy[2], toTrophy[2], smooth)
      )
    } else if (!overview) {
      const effect = room.turnState?.eventEffect
      const startedAt = Number(effect?.animationStartedAt) || 0
      if (effect?.id?.startsWith('gate-switch-') && startedAt) {
        const elapsed = now - startedAt
        const focusId = elapsed >= 0 && elapsed < 1900 ? 'n05' : elapsed >= 1900 && elapsed < 3800 ? 'n37' : ''
        if (focusId && layout.nodes[focusId]) cinematicTarget = new THREE.Vector3(...layout.nodes[focusId])
      } else if (effect?.id === 'supply-crates' && startedAt) {
        const openedAt = Number(effect.openedAt) || 0
        if (!openedAt && !effect.resolved) {
          cinematicTarget = new THREE.Vector3(...TREASURE_CENTER)
        } else if (openedAt) {
          const sinceOpen = now - openedAt
          if (sinceOpen >= 0 && sinceOpen < 1500) {
            const back = Math.max(0, Math.min(1, (sinceOpen - 550) / 950))
            const chest = new THREE.Vector3(...TREASURE_CENTER)
            const returnPoint = new THREE.Vector3(...(layout.nodes.n19 || TREASURE_CENTER))
            cinematicTarget = chest.lerp(returnPoint, back * back * (3 - 2 * back))
          }
        }
      } else if (effect?.id === 'reactor-trigger-c' && startedAt) {
        const motion = room.boardMotion
        const moveEnd = Number(motion?.startedAt || 0) + Math.max(0, (motion?.path?.length || 1) - 1) * (motion?.stepMs || 280)
        const animationStart = Math.max(startedAt, moveEnd)
        const elapsed = (now - animationStart) / 1000
        if (elapsed >= 0 && elapsed < BALL_DURATION) {
          const t = Math.pow(elapsed / BALL_DURATION, 1.35)
          const distance = ((1102 - 288) / 80) * t
          const ball = new THREE.Vector3(...(layout.nodes.n58 || TARGET))
          ball.x += distance
          ball.y = Math.max(ball.y, 0.4)
          cinematicTarget = ball
        }
      }
    }
    const desired = cinematicTarget || (overview ? new THREE.Vector3(...TARGET) : followPoint.current)
    if (!desired) return
    const factor = 1 - Math.exp(-8 * Math.min(dt, .1))
    const delta = desired.clone().sub(ref.current.target)
    const zoom = fit * (cinematicTarget ? 3.15 : overview ? 1 : 2.65)
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
  return <OrbitControls ref={ref} makeDefault target={TARGET} enabled={overview && (!showcase || showcase.host)} onChange={broadcast}
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
  finalFive = false, closedGarageGateIds = [], turnOrderPhase = false, turnOrderRolls = {}, overview = false, quality = 'low', topDown = false, highlightNodeIds = [], showcase = null }) {
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
        setBallRun({ started: performance.now() - elapsed, positions: effect.fromPositions || positions, resetTo: effect.resetTo || 'n57' })
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
            ballRun={ballRun} clockOffset={clockOffset} />
          <DestinationHighlights nodeIds={highlightNodeIds} />
          <TreasureChests effect={effect} clockOffset={clockOffset} />
          <PlayerTokens board={board} room={room} players={players} activePlayer={activePlayer}
            turnOrderPhase={turnOrderPhase} turnOrderRolls={turnOrderRolls} ballRun={ballRun} clockOffset={clockOffset} followPoint={followPoint} />
        </Suspense>
        <CameraControls showcase={showcase} topDown={topDown} resetKey={resetKey} overview={overview || turnOrderPhase} followPoint={followPoint} room={room} board={board} clockOffset={clockOffset} />
      </Canvas>
    </ModelErrorBoundary>
  </div>
}

function DestinationHighlights({ nodeIds = [] }) {
  const ref = useRef()
  const invalidate = useThree((state) => state.invalidate)
  useFrame(() => {
    if (!ref.current || !nodeIds.length) return
    const pulse = 1 + Math.sin(performance.now() / 180) * 0.08
    ref.current.scale.setScalar(pulse)
    invalidate()
  })
  return <group ref={ref}>{nodeIds.filter((id) => layout.nodes[id]).map((id) => {
    const p = layout.nodes[id]
    return <group key={`transport-highlight-${id}`} position={[p[0], p[1] + 0.045, p[2]]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.29, 0.39, 36]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.95} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <SpriteLabel text="TELEPORT" y={0.24} width={0.78} />
    </group>
  })}</group>
}

function SpaceMarkers({board,room,model,finalStretch}) {
 const spike=useMemo(()=>{const shape=new THREE.Shape();for(let i=0;i<24;i++){const a=i*Math.PI/12,r=i%2?.72:1,x=Math.cos(a)*r,y=Math.sin(a)*r;i?shape.lineTo(x,y):shape.moveTo(x,y)}shape.closePath();return shape},[]);
 const texture=useMemo(()=>{const make=text=>{const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');x.fillStyle='white';x.font='bold '+(text==='VS'?'60':text==='!?'?'76':'96')+'px Arial';x.textAlign='center';x.textBaseline='middle';x.fillText(text,64,66);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t};return {event:make('!'),bad:make('!?'),vs:make('VS')}},[]);
 useEffect(()=>()=>Object.values(texture).forEach(t=>t.dispose()),[texture]);
 return <group>{board.nodes.filter(n=>['Lucky','Bad Luck','Battle','Event'].includes(n.type)&&n.id!==room.activeTrophyNodeId&&model.spaces[n.id]).map(n=>{const o=model.spaces[n.id],p=new THREE.Vector3();o.getWorldPosition(p);const q=o.getWorldQuaternion(new THREE.Quaternion());const bad=n.type==='Bad Luck',vs=n.type==='Battle',lucky=n.type==='Lucky';const color=bad?(finalStretch?'#554165':'#b66b79'):vs?'#ca9b61':lucky?'#6c9e80':'#bb849e';const disc=(r,c)=> <mesh rotation={[-Math.PI/2,0,0]} scale={[r,r,r]}>{bad?<shapeGeometry args={[spike]}/>:<circleGeometry args={[1,vs?3:40]}/>}<meshStandardMaterial color={c} roughness={.88} side={THREE.DoubleSide}/></mesh>;return <group key={n.id} position={p.toArray()} quaternion={q}><group position={[0,.033,0]}>
 {disc(.199,'#dce4df')}<group position={[0,.002,0]}>{disc(.174,color)}</group>
 {(bad||vs||n.type==='Event')&&<mesh position={[0,.004,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[.27,.27]}/><meshBasicMaterial map={bad?texture.bad:vs?texture.vs:texture.event} transparent depthWrite={false}/></mesh>}
 {lucky&&<group position={[0,.005,0]}>{[[-.047,-.012],[.047,-.012],[0,-.065]].map(([x,z],i)=><mesh key={i} position={[x,0,z]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[.057,20]}/><meshBasicMaterial color="#e4ece4"/></mesh>)}<mesh position={[.012,0,.055]} rotation={[-Math.PI/2,0,.2]}><planeGeometry args={[.022,.1]}/><meshBasicMaterial color="#e4ece4"/></mesh></group>}
 </group></group>})}</group>
}
