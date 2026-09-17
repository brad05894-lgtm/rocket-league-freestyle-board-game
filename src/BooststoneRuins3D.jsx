import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

const BOARD_SCALE = 80
const THREE_D_CROP_MIN_X = 210
const TERRAIN_HEIGHTS = {
  1: 0.38,
  2: 0.62,
  3: 0.86,
  4: 1.08,
}

const SPACE_COLORS = {
  Mechanic: '#3b82f6',
  'Danger Mechanic': '#ef4444',
  Card: '#a855f7',
  Battle: '#f59e0b',
  Event: '#22c55e',
  Lucky: '#10b981',
  'Bad Luck': '#e11d48',
  Shop: '#111827',
  Junction: '#0b0f0d',
  Lakitu: '#0b0f0d',
  Paratroopa: '#0b0f0d',
}

const PLAYER_COLORS = ['#f8fafc', '#fbbf24', '#38bdf8', '#f472b6']

function parsePoints(points = '') {
  return String(points)
    .trim()
    .split(/\s+/)
    .map((pair) => pair.split(',').map(Number))
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
}

function pointInPolygon(x, y, polygon) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    const crosses = ((yi > y) !== (yj > y)) &&
      (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 0.00001) + xi)
    if (crosses) inside = !inside
  }
  return inside
}

function createBoardHelpers(board) {
  const view = board.viewBox || { x: 0, y: 0, width: board.width, height: board.height }
  const centerX = view.x + view.width / 2
  const centerY = view.y + view.height / 2
  const terrain = (board.terrain || []).map((slab) => ({
    ...slab,
    polygon: parsePoints(slab.points),
  }))

  function heightAt(x, y) {
    let elevation = 0
    for (const slab of terrain) {
      if (pointInPolygon(x, y, slab.polygon)) {
        elevation = Math.max(elevation, Number(slab.elevation) || 1)
      }
    }
    return elevation ? TERRAIN_HEIGHTS[elevation] || TERRAIN_HEIGHTS[1] : 0.12
  }

  function world(x, y, extraY = 0) {
    return [
      (x - centerX) / BOARD_SCALE,
      heightAt(x, y) + extraY,
      (y - centerY) / BOARD_SCALE,
    ]
  }

  function flatWorld(x, y, worldY = 0) {
    return [
      (x - centerX) / BOARD_SCALE,
      worldY,
      (y - centerY) / BOARD_SCALE,
    ]
  }

  return { view, centerX, centerY, terrain, heightAt, world, flatWorld }
}

function CameraRig() {
  const { camera } = useThree()
  useEffect(() => {
    camera.position.set(10.5, 13.5, 12.5)
    camera.lookAt(0, 0.2, 0)
    camera.updateProjectionMatrix()
  }, [camera])
  return null
}

function StonePlatform({ slab, helpers }) {
  const geometry = useMemo(() => {
    const points = parsePoints(slab.points).map(([x, y]) => [Math.max(THREE_D_CROP_MIN_X, x), y])
    if (points.length < 3) return null

    const shape = new THREE.Shape()
    points.forEach(([x, y], index) => {
      const sx = (x - helpers.centerX) / BOARD_SCALE
      const sy = -(y - helpers.centerY) / BOARD_SCALE
      if (index === 0) shape.moveTo(sx, sy)
      else shape.lineTo(sx, sy)
    })
    shape.closePath()

    const height = TERRAIN_HEIGHTS[Number(slab.elevation) || 1] || TERRAIN_HEIGHTS[1]
    const result = new THREE.ExtrudeGeometry(shape, {
      depth: height,
      bevelEnabled: true,
      bevelSize: 0.025,
      bevelThickness: 0.025,
      bevelSegments: 1,
    })
    result.rotateX(-Math.PI / 2)
    result.computeVertexNormals()
    return result
  }, [slab, helpers.centerX, helpers.centerY])

  useEffect(() => () => geometry?.dispose(), [geometry])
  if (!geometry) return null

  const elevation = Number(slab.elevation) || 1
  const colors = ['#4c6157', '#5a6f64', '#687d70', '#74887a']

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color={colors[Math.max(0, Math.min(colors.length - 1, elevation - 1))]}
        roughness={0.9}
        metalness={0.02}
      />
    </mesh>
  )
}

function RuinBlock({ block, helpers }) {
  const [x, y, width, depth, heightPx] = block
  const base = helpers.heightAt(x, y)
  const height = Math.max(0.16, (Number(heightPx) || 12) / 45)
  return (
    <mesh
      position={[
        helpers.flatWorld(x, y)[0],
        base + height / 2,
        helpers.flatWorld(x, y)[2],
      ]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[Math.max(0.12, width / BOARD_SCALE), height, Math.max(0.12, depth / BOARD_SCALE)]} />
      <meshStandardMaterial color="#5d7067" roughness={0.95} />
    </mesh>
  )
}

function FoliageCluster({ item, helpers }) {
  const [x, y, r] = item
  const base = helpers.heightAt(x, y)
  const scale = Math.max(0.09, r / 112)
  const offsets = [
    [-0.18, 0, 0.04],
    [0.12, 0.04, -0.08],
    [0.02, 0.11, 0.13],
    [0.19, 0.03, 0.12],
  ]
  const [wx, , wz] = helpers.flatWorld(x, y)

  return (
    <group position={[wx, base + scale * 0.45, wz]}>
      {offsets.map(([dx, dy, dz], index) => (
        <mesh key={index} position={[dx * scale * 2.2, dy, dz * scale * 2.2]} castShadow>
          <sphereGeometry args={[scale * (0.72 + index * 0.05), 12, 10]} />
          <meshStandardMaterial color={index % 2 ? '#2f8f49' : '#3fa85b'} roughness={0.95} />
        </mesh>
      ))}
    </group>
  )
}

function buildEdgePoints(board, from, to) {
  const route = board.edgeRoutes?.[`${from.id}->${to.id}`] || []
  const raw = [[from.x, from.y], ...route, [to.x, to.y]]
  if (!route.length && from.x !== to.x && from.y !== to.y) {
    return [[from.x, from.y], [to.x, from.y], [to.x, to.y]]
  }
  return raw
}

function BoardPaths({ board, helpers }) {
  const nodeMap = useMemo(
    () => Object.fromEntries(board.nodes.map((node) => [node.id, node])),
    [board.nodes]
  )

  const edges = useMemo(() => {
    const result = []
    for (const node of board.nodes) {
      for (const nextId of node.next || []) {
        const next = nodeMap[nextId]
        if (!next) continue
        const points = buildEdgePoints(board, node, next).map(([x, y]) => {
          const [wx, wy, wz] = helpers.world(x, y, 0.075)
          return [wx, wy, wz]
        })
        result.push({ id: `${node.id}-${nextId}`, points })
      }
    }
    return result
  }, [board, helpers, nodeMap])

  return (
    <group>
      {edges.map((edge) => (
        <Line
          key={edge.id}
          points={edge.points}
          color="#effff5"
          lineWidth={2.4}
          transparent
          opacity={0.92}
        />
      ))}
    </group>
  )
}

function SpriteLabel({ text, width = 0.78, height = 0.28, fontSize = 54, color = '#ffffff', y = 0.22 }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 160
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.font = `900 ${fontSize}px system-ui, -apple-system, Segoe UI, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = 'rgba(0,0,0,.88)'
    ctx.lineWidth = Math.max(8, fontSize * 0.16)
    ctx.strokeText(String(text), canvas.width / 2, canvas.height / 2)
    ctx.fillStyle = color
    ctx.fillText(String(text), canvas.width / 2, canvas.height / 2)
    const t = new THREE.CanvasTexture(canvas)
    t.colorSpace = THREE.SRGBColorSpace
    t.minFilter = THREE.LinearFilter
    t.magFilter = THREE.LinearFilter
    t.needsUpdate = true
    return t
  }, [text, fontSize, color])

  useEffect(() => () => texture.dispose(), [texture])

  return (
    <sprite position={[0, y, 0]} scale={[width, height, 1]} renderOrder={8}>
      <spriteMaterial map={texture} transparent depthTest depthWrite={false} />
    </sprite>
  )
}

function Symbol({ children }) {
  return <SpriteLabel text={children} width={0.38} height={0.18} fontSize={66} y={0.2} />
}

function BadLuckSpace({ finalFive }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape()
    const spikes = 12
    for (let i = 0; i < spikes * 2; i += 1) {
      const angle = (i / (spikes * 2)) * Math.PI * 2
      const radius = i % 2 === 0 ? 0.28 : 0.19
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius
      if (i === 0) shape.moveTo(x, y)
      else shape.lineTo(x, y)
    }
    shape.closePath()
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.075, bevelEnabled: false })
    g.rotateX(-Math.PI / 2)
    return g
  }, [])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <group>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial color={finalFive ? '#080808' : '#e11d48'} roughness={0.7} />
      </mesh>
      <Symbol>{finalFive ? '☠' : '!'}</Symbol>
    </group>
  )
}

function BoardSpace({ node, helpers, finalFive, isActive, isTrophy }) {
  const [x, y, z] = helpers.world(node.x, node.y, 0.085)
  const stopDot = ['junction', 'shop-dot', 'paratroopa-dot', 'lakitu-dot'].includes(node.visualMode)

  return (
    <group position={[x, y, z]}>
      {isTrophy && (
        <group position={[0, 0.6, 0]}>
          <pointLight color="#fde047" intensity={1.4} distance={2.6} />
          <Symbol>🏆</Symbol>
        </group>
      )}

      {isActive && (
        <mesh position={[0, -0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.3, 0.38, 32]} />
          <meshBasicMaterial color="#fef08a" side={THREE.DoubleSide} />
        </mesh>
      )}

      {node.type === 'Bad Luck' ? (
        <BadLuckSpace finalFive={finalFive} />
      ) : node.type === 'Battle' ? (
        <group>
          <mesh rotation={[0, Math.PI / 4, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.42, 0.09, 0.42]} />
            <meshStandardMaterial color="#f59e0b" roughness={0.72} />
          </mesh>
          <Symbol>VS</Symbol>
        </group>
      ) : stopDot ? (
        <group>
          {node.visualMode === 'junction' && (
            <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.29, 0.36, 24]} />
              <meshBasicMaterial color="#090b0a" side={THREE.DoubleSide} />
            </mesh>
          )}
          <mesh castShadow>
            <cylinderGeometry args={[0.095, 0.095, 0.09, 24]} />
            <meshStandardMaterial color="#090b0a" roughness={0.78} />
          </mesh>
          {node.visualMode === 'lakitu-dot' && <SpriteLabel text="LAKITU" width={0.62} height={0.2} fontSize={42} y={0.32} />}
          {node.visualMode === 'paratroopa-dot' && <SpriteLabel text="PARATROOPA" width={0.86} height={0.2} fontSize={38} y={0.32} />}
          {node.visualMode === 'shop-dot' && <SpriteLabel text="SHOP" width={0.5} height={0.19} fontSize={42} y={0.32} />}
        </group>
      ) : (
        <group>
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[0.235, 0.235, 0.09, 32]} />
            <meshStandardMaterial color={SPACE_COLORS[node.type] || '#3b82f6'} roughness={0.68} />
          </mesh>
          {node.type === 'Card' && <Symbol>A</Symbol>}
          {node.type === 'Event' && <Symbol>!</Symbol>}
          {node.type === 'Lucky' && <Symbol>🍀</Symbol>}
        </group>
      )}
    </group>
  )
}

function Chest({ position }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 0.13, 0]}>
        <boxGeometry args={[0.62, 0.28, 0.48]} />
        <meshStandardMaterial color="#a95f25" roughness={0.82} />
      </mesh>
      <mesh castShadow position={[0, 0.33, 0]}>
        <boxGeometry args={[0.64, 0.16, 0.5]} />
        <meshStandardMaterial color="#c47a31" roughness={0.78} />
      </mesh>
      <mesh castShadow position={[0, 0.24, 0.248]}>
        <boxGeometry args={[0.11, 0.38, 0.035]} />
        <meshStandardMaterial color="#f4d06f" metalness={0.32} roughness={0.42} />
      </mesh>
      <mesh castShadow position={[0, 0.18, 0.275]}>
        <boxGeometry args={[0.15, 0.15, 0.05]} />
        <meshStandardMaterial color="#ffe08a" metalness={0.35} roughness={0.38} />
      </mesh>
    </group>
  )
}

function CrateZone({ landmark, board, helpers }) {
  const [x, , z] = helpers.flatWorld(landmark.x, landmark.y)
  const base = helpers.heightAt(landmark.x, landmark.y)
  const width = (Number(landmark.width) || 260) / BOARD_SCALE
  const depth = (Number(landmark.height) || 120) / BOARD_SCALE
  const entrance = board.nodes.find((node) => node.id === landmark.entranceNodeId)

  return (
    <group>
      {entrance && (
        <Line
          points={[
            helpers.world(entrance.x, entrance.y, 0.1),
            [x + width / 2, base + 0.1, z],
          ]}
          color="#dff6e6"
          lineWidth={3}
        />
      )}
      <mesh position={[x, base + 0.12, z]} castShadow receiveShadow>
        <boxGeometry args={[width, 0.24, depth]} />
        <meshStandardMaterial color="#758b7d" roughness={0.92} />
      </mesh>
      <group position={[x, base + 0.24, z]}>
        <Chest position={[-width * 0.29, 0, 0]} />
        <Chest position={[0, 0, 0]} />
        <Chest position={[width * 0.29, 0, 0]} />
        <SpriteLabel text="SUPPLY CRATES" width={1.5} height={0.3} fontSize={48} y={0.72} />
      </group>
    </group>
  )
}

function BoulderChain({ landmark, helpers }) {
  const [x, y, z] = helpers.world(landmark.x, landmark.y, 0.35)
  return (
    <group position={[x, y, z]}>
      <mesh castShadow>
        <sphereGeometry args={[0.35, 24, 18]} />
        <meshStandardMaterial color="#8b4513" roughness={0.72} />
      </mesh>
      <pointLight color="#f59e0b" intensity={0.8} distance={2} />
      <Symbol>⚡</Symbol>
      <SpriteLabel text="BOOST BOULDER CHAIN" width={1.75} height={0.28} fontSize={43} y={-0.46} />
    </group>
  )
}

function Shop3D({ shop, helpers }) {
  const [x, y, z] = helpers.world(shop.x, shop.y, 0.22)
  return (
    <group position={[x, y, z]}>
      {shop.elevated && (
        <mesh position={[0, -0.16, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.55, 0.7, 0.24, 28]} />
          <meshStandardMaterial color="#536b5a" roughness={0.95} />
        </mesh>
      )}
      <mesh castShadow position={[0, 0.2, 0]}>
        <boxGeometry args={[0.42, 0.46, 0.18]} />
        <meshStandardMaterial color="#f3cf4f" roughness={0.58} />
      </mesh>
      <SpriteLabel text="A" width={0.24} height={0.18} fontSize={72} color="#17231b" y={0.22} />
    </group>
  )
}

function Gate3D({ gate, helpers, closed }) {
  const [x, y, z] = helpers.world(gate.x, gate.y, 0.2)
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0.28, 0]} castShadow>
        <boxGeometry args={[0.68, 0.07, 0.1]} />
        <meshStandardMaterial color={closed ? '#b45309' : '#52685d'} roughness={0.7} />
      </mesh>
      {[-0.3, -0.15, 0, 0.15, 0.3].map((dx) => (
        <mesh key={dx} position={[dx, 0, 0]} castShadow>
          <boxGeometry args={[0.05, 0.52, 0.07]} />
          <meshStandardMaterial color={closed ? '#d97706' : '#71867b'} roughness={0.68} />
        </mesh>
      ))}
    </group>
  )
}

function StartDeck3D({ board, helpers }) {
  const zone = board.startZone
  if (!zone) return null
  const [x, , z] = helpers.flatWorld(zone.x, zone.y)
  const width = zone.width / BOARD_SCALE
  const depth = zone.height / BOARD_SCALE
  const first = board.nodes.find((node) => node.id === board.startId)

  return (
    <group>
      {first && (
        <Line
          points={[
            [x, 0.44, z - depth / 2],
            helpers.world(first.x, first.y, 0.12),
          ]}
          color="#8b5a2b"
          lineWidth={5}
        />
      )}
      <mesh position={[x, 0.24, z]} castShadow receiveShadow>
        <boxGeometry args={[width, 0.48, depth]} />
        <meshStandardMaterial color="#8a6037" roughness={0.86} />
      </mesh>
      <group position={[x, 0.55, z]}><SpriteLabel text="START" width={0.72} height={0.24} fontSize={54} y={0} /></group>
    </group>
  )
}

function PlayerTokens({ board, helpers, room, players, activePlayer, turnOrderPhase, turnOrderRolls }) {
  const nodeMap = useMemo(
    () => Object.fromEntries(board.nodes.map((node) => [node.id, node])),
    [board.nodes]
  )
  const deck = board.startZone

  return (
    <group>
      {players.map((player, index) => {
        const setup = room.playerSetup?.[player.id] || {}
        const onDeck = turnOrderPhase || setup.onStartDeck === true
        const node = nodeMap[setup.boardNodeId || board.startId]
        if (!node && !onDeck) return null

        let position
        if (onDeck && deck) {
          const [dx, dz] = [[-0.23, -0.38], [0.23, -0.38], [-0.23, 0.36], [0.23, 0.36]][index] || [0, 0]
          const [x, , z] = helpers.flatWorld(deck.x, deck.y)
          position = [x + dx, 0.64, z + dz]
        } else {
          const [x, y, z] = helpers.world(node.x, node.y, 0.37)
          const [dx, dz] = [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]][index] || [0, 0]
          position = [x + dx, y, z + dz]
        }

        const active = !turnOrderPhase && player.id === activePlayer?.id
        const roll = Number(turnOrderRolls?.[player.id]) || 0

        return (
          <group key={player.id} position={position}>
            {active && (
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.17, 0]}>
                <ringGeometry args={[0.24, 0.33, 28]} />
                <meshBasicMaterial color="#fde047" side={THREE.DoubleSide} />
              </mesh>
            )}
            <mesh castShadow>
              <sphereGeometry args={[0.19, 20, 16]} />
              <meshStandardMaterial color={PLAYER_COLORS[index] || '#fff'} roughness={0.55} metalness={0.08} />
            </mesh>
            <SpriteLabel
              text={`${player.name}${turnOrderPhase && roll > 0 ? ` • ${roll}` : ''}`}
              width={0.95}
              height={0.24}
              fontSize={45}
              y={0.4}
            />
          </group>
        )
      })}
    </group>
  )
}

function StableBoardControls() {
  const controls = useRef(null)
  const { camera } = useThree()

  useFrame(() => {
    const c = controls.current
    if (!c) return
    const oldX = c.target.x
    const oldZ = c.target.z
    const nextX = THREE.MathUtils.clamp(oldX, -2.35, 2.35)
    const nextZ = THREE.MathUtils.clamp(oldZ, -1.7, 1.7)
    if (Math.abs(nextX - oldX) > 0.0001 || Math.abs(nextZ - oldZ) > 0.0001) {
      camera.position.x += nextX - oldX
      camera.position.z += nextZ - oldZ
      c.target.x = nextX
      c.target.z = nextZ
      c.update()
    }
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={[0, 0.35, 0]}
      enableRotate={false}
      enablePan
      enableZoom
      screenSpacePanning
      enableDamping
      dampingFactor={0.12}
      panSpeed={0.55}
      zoomSpeed={0.55}
      minZoom={44}
      maxZoom={70}
    />
  )
}

function Scene({ board, room, players, activePlayer, finalFive, closedGarageGateId, turnOrderPhase, turnOrderRolls }) {
  const helpers = useMemo(() => createBoardHelpers(board), [board])
  const activeSetup = activePlayer ? room.playerSetup?.[activePlayer.id] || {} : {}

  return (
    <>
      <CameraRig />
      <color attach="background" args={['#07110e']} />
      <fog attach="fog" args={['#07110e', 15, 34]} />

      <hemisphereLight intensity={1.1} color="#d9f4df" groundColor="#17251d" />
      <directionalLight
        castShadow
        position={[7, 15, 8]}
        intensity={2.15}
        color="#f5fff7"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={40}
        shadow-camera-left={-13}
        shadow-camera-right={13}
        shadow-camera-top={13}
        shadow-camera-bottom={-13}
      />
      <ambientLight intensity={0.38} />

      <mesh position={[0, -0.1, 0]} receiveShadow>
        <boxGeometry args={[13.2, 0.18, 12.1]} />
        <meshStandardMaterial color="#0a1712" roughness={1} />
      </mesh>

      {(board.terrain || []).map((slab) => (
        <StonePlatform key={slab.id} slab={slab} helpers={helpers} />
      ))}

      {(board.ruinBlocks || []).map((block, index) => (
        <RuinBlock key={`ruin-block-${index}`} block={block} helpers={helpers} />
      ))}

      {(board.foliage || []).map((item, index) => (
        <FoliageCluster key={`foliage-${index}`} item={item} helpers={helpers} />
      ))}

      <BoardPaths board={board} helpers={helpers} />

      {board.nodes.map((node) => (
        <BoardSpace
          key={node.id}
          node={node}
          helpers={helpers}
          finalFive={finalFive}
          isActive={node.id === activeSetup.boardNodeId}
          isTrophy={node.id === room.activeTrophyNodeId}
        />
      ))}

      {(board.landmarks || []).map((landmark) => {
        if (landmark.kind === 'crates') {
          return <CrateZone key={landmark.id} landmark={landmark} board={board} helpers={helpers} />
        }
        if (landmark.id === 'boulder-chain' || landmark.kind === 'reactor') {
          return <BoulderChain key={landmark.id} landmark={landmark} helpers={helpers} />
        }
        return null
      })}

      {(board.shops || []).map((shop) => (
        <Shop3D key={shop.id} shop={shop} helpers={helpers} />
      ))}

      {(board.gates || []).map((gate) => (
        <Gate3D key={gate.id} gate={gate} helpers={helpers} closed={gate.id === closedGarageGateId} />
      ))}

      <StartDeck3D board={board} helpers={helpers} />

      <PlayerTokens
        board={board}
        helpers={helpers}
        room={room}
        players={players}
        activePlayer={activePlayer}
        turnOrderPhase={turnOrderPhase}
        turnOrderRolls={turnOrderRolls}
      />

      <StableBoardControls />
    </>
  )
}

export default function BooststoneRuins3D({
  board,
  room,
  players,
  activePlayer,
  finalFive = false,
  closedGarageGateId = '',
  turnOrderPhase = false,
  turnOrderRolls = {},
}) {
  const [cameraKey, setCameraKey] = useState(0)

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: 'min(72vh, 760px)',
      minHeight: 560,
      borderRadius: 18,
      overflow: 'hidden',
      border: '1px solid rgba(163, 210, 177, .28)',
      background: '#07110e',
      boxShadow: 'inset 0 0 70px rgba(0,0,0,.35)',
    }}>
      <div style={{
        position: 'absolute',
        zIndex: 2,
        top: 12,
        left: 12,
        pointerEvents: 'none',
        padding: '8px 10px',
        borderRadius: 10,
        background: 'rgba(5, 12, 9, .74)',
        border: '1px solid rgba(255,255,255,.12)',
        color: '#eaf8ee',
        fontSize: 12,
        fontWeight: 800,
      }}>
        3D PREVIEW • scroll to zoom • drag to pan • fixed isometric camera
      </div>

      <button
        type="button"
        onClick={() => setCameraKey((value) => value + 1)}
        style={{
          position: 'absolute',
          zIndex: 3,
          top: 12,
          right: 12,
          border: '1px solid rgba(255,255,255,.2)',
          borderRadius: 9,
          background: 'rgba(5,12,9,.8)',
          color: '#f8fafc',
          padding: '7px 10px',
          fontWeight: 900,
          cursor: 'pointer',
        }}
      >
        Reset View
      </button>

      <Canvas
        orthographic
        shadows
        dpr={[1, 1.35]}
        camera={{ position: [10.5, 13.5, 12.5], zoom: 53, near: 0.1, far: 80 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      >
        <Scene
          key={cameraKey}
          board={board}
          room={room}
          players={players}
          activePlayer={activePlayer}
          finalFive={finalFive}
          closedGarageGateId={closedGarageGateId}
          turnOrderPhase={turnOrderPhase}
          turnOrderRolls={turnOrderRolls}
        />
      </Canvas>
    </div>
  )
}
