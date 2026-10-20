import {Component,Suspense,useEffect,useMemo,useRef,useState} from 'react'
import {Canvas,useFrame,useThree} from '@react-three/fiber'
import {Html,OrbitControls,useGLTF} from '@react-three/drei'
import * as THREE from 'three'
import {demoPoint} from './partyBoards'
import {centralBombColor,transformedBadLuck} from './demoMinesEvents'
import {presentationBeat} from './partyPresentation'
import spaceMaterials from './demoMinesSpaceMaterials.json'
import {partyNow} from './partyClock'
const URL=(import.meta.env.BASE_URL||'/')+'models/'
const center=[0,2.8,0],vec=p=>new THREE.Vector3(...p),clamp=x=>Math.max(0,Math.min(1,x))
export function minecartPosition(c,now){
 const elapsed=now-c.startedAt,a=vec(demoPoint(c.from)),b=vec(demoPoint(c.to))
 const mouthA=a.clone().add(new THREE.Vector3(c.from==='d29'?1.2:-1.2,0,-1.9)),mouthB=b.clone().add(new THREE.Vector3(c.to==='d29'?1.2:-1.2,0,-1.9))
 if(elapsed<1100)return a.toArray()
 if(elapsed<3000)return a.lerp(mouthA,clamp((elapsed-1100)/1900)).toArray()
 if(elapsed<3500)return mouthB.toArray()
 return mouthB.lerp(b,clamp((elapsed-3500)/1900)).toArray()
}
function playerPoint(room,id,now){
 const c=room.boardCinematic,s=room.playerSetup?.[id]||{},m=room.boardMotion
 if(c?.kind==='minecart'&&c.playerId===id&&now<c.endsAt)return minecartPosition(c,now)
 let p=demoPoint(s.onStartDeck?'start-deck':s.boardNodeId)
 if(m?.playerId===id&&m.path?.length>1){
  const t=Math.max(0,(now-Number(m.startedAt||0))/(m.stepMs||280)),i=Math.min(m.path.length-1,Math.floor(t))
  p=vec(demoPoint(m.path[i])).lerp(vec(demoPoint(m.path[Math.min(i+1,m.path.length-1)])),t-i).toArray()
  if(i<m.path.length-1)p[1]+=.13*Math.sin((t-i)*Math.PI)
 }
 return p
}
class AssetBoundary extends Component{
 state={failed:false};static getDerivedStateFromError(){return {failed:true}}
 render(){return this.state.failed?<Html center><div className="demo-asset-error">Demo Mines export is missing.<br/>Run export_demo_mines.py, then copy demo-mines-v13.glb and mining-pickaxe.glb into public/models. Refresh afterward.</div></Html>:this.props.children}
}
function NativeBoard({room,board}){
 const gltf=useGLTF(URL+'demo-mines-v13.glb?materials=20261020')
 const model=useMemo(()=>{const s=gltf.scene.clone(true);s.traverse(o=>{if(o.isMesh){o.raycast=()=>null;o.material=o.material.clone();o.userData.baseColor=o.material.color?.clone();if((o.userData.sourceName||o.name).startsWith('LEFT CHEVRON')){o.geometry=o.geometry.clone();o.geometry.computeBoundingBox();const pivot=o.geometry.boundingBox.getCenter(new THREE.Vector3());o.geometry.translate(-pivot.x,-pivot.y,-pivot.z);o.position.copy(pivot)}}});return s},[gltf.scene])
 useFrame(()=>{
  const now=partyNow(),c=room.boardCinematic
  model.traverse(o=>{
   const name=o.userData.sourceName||o.name
   if(name.startsWith('SPACE_')){
    const id=name.match(/d\d+/)?.[0];o.visible=id!==room.activeTrophyNodeId
    if(name.startsWith('SPACE_FILL_')&&board.nodes.find(n=>n.id===id)?.type==='Bad Luck'&&o.material){o.material.color.copy(o.userData.baseColor);const m=spaceMaterials[transformedBadLuck(room,id,now)?'Very Bad Luck dark purple':'Bad Luck'];o.material.color.setRGB(...m.color);o.material.emissive.setRGB(...m.emissive);o.material.emissiveIntensity=m.emissiveIntensity}
   }
   if(name.startsWith('LEFT CHEVRON'))o.rotation.z=room.boardState?.conveyorLane==='upper'?-Math.PI/2:Math.PI/2
   // Runtime cart replaces the parked model during the ride only.
   if(/minecart|cart body|cart wheel/i.test(name)&&!/rail|track|mouth/i.test(name))o.visible=c?.kind!=='minecart'
  })
 })
 return <primitive object={model}/>
}
function Pickaxe({effect,position}){
 const asset=useGLTF(URL+'mining-pickaxe.glb'),ref=useRef()
 const clone=useMemo(()=>asset.scene.clone(true),[asset.scene])
 useFrame(()=>{if(!ref.current)return;const t=clamp((partyNow()-Number(effect.lastSwingAt||0))/1100);ref.current.rotation.z=t<1?-.6+Math.sin(t*Math.PI*1.5)*1.3:-.5;ref.current.visible=!effect.broken||t<.75;ref.current.position.y=position[1]+.8})
 return <group ref={ref} position={position} scale={.85}><primitive object={clone}/></group>
}
function Cart(){return <group><mesh position={[0,.25,0]}><boxGeometry args={[.75,.48,.95]}/><meshStandardMaterial color="#705039" metalness={.3}/></mesh>{[-.4,.4].flatMap(x=>[-.32,.32].map(z=><mesh key={`${x}-${z}`} position={[x,0,z]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.17,.17,.08,12]}/><meshStandardMaterial color="#25292e" metalness={.7}/></mesh>))}</group>}
function Actor({room,player,index,active}){
 const ref=useRef(),egg=useRef()
 useFrame(()=>{if(!ref.current)return;const p=playerPoint(room,player.id,partyNow());if(room.playerSetup?.[player.id]?.onStartDeck)p[0]+=(index-1.5)*.55;else{p[0]+=(index%2?1:-1)*.12;p[2]+=(index<2?1:-1)*.12}ref.current.position.set(...p);if(egg.current)egg.current.position.y=.6+Math.sin(partyNow()/220)*.08})
 const s=room.playerSetup?.[player.id],c=room.boardCinematic,inCart=c?.kind==='minecart'&&c.playerId===player.id
 return <group ref={ref}>{inCart&&<Cart/>}<mesh position={[0,inCart?.85:.28,0]}><sphereGeometry args={[.23,14,10]}/><meshStandardMaterial color={player.color||['#fff','#ffb936','#70baff','#ff81c4'][index%4]} emissive={active?'#40391d':'#000'}/></mesh><Html center position={[0,1.1,0]} distanceFactor={20} style={{pointerEvents:'none',whiteSpace:'nowrap',color:'white',fontSize:12,textShadow:'0 2px 3px #000'}}>{player.name}</Html>{s?.bombAlly&&<group ref={egg} position={[.45,.6,0]}><mesh scale={[.75,1,.75]}><sphereGeometry args={[.20,12,8]}/><meshStandardMaterial color="#ff982e"/></mesh></group>}</group>
}
function Effects({room,board}){
 const burst=useRef(),reward=useRef(),trophy=useRef();const [now,setNow]=useState(partyNow())
 useEffect(()=>{const t=setInterval(()=>setNow(partyNow()),80);return()=>clearInterval(t)},[])
 const c=room.boardCinematic,e=room.turnState?.eventEffect,beat=presentationBeat(room,now)
 const bombing=c?.kind==='central-bomb'&&c.countdown===0||c?.kind==='ally-goodbye'
 const point=c?.kind==='central-bomb'?[0,4.4,-1.55]:demoPoint(c?.nodeId||room.playerSetup?.[c?.playerId]?.boardNodeId)
 const age=now-Number(c?.startedAt||0)
 useFrame(()=>{
  if(burst.current){burst.current.visible=!!bombing&&age>=1300&&age<3300;burst.current.scale.setScalar(.2+clamp((age-1300)/1600)*3.8);burst.current.rotation.y+=.02}
  if(reward.current&&beat){reward.current.position.set(...demoPoint(beat.nodeId));reward.current.position.y+=1.5+(beat.amount>0?-1:1)*Math.sin(clamp(beat.age/2200)*Math.PI);reward.current.rotation.y+=.06}
  if(trophy.current){let p=demoPoint(room.activeTrophyNodeId);const t=room.turnState?.trophyCinematic;if(t&&now>=t.startedAt&&now<t.startedAt+3300){const a=demoPoint(t.fromNodeId||t.from||room.playerSetup?.[room.turnState?.playerId]?.boardNodeId);p=vec(a).lerp(vec(p),clamp((now-t.startedAt)/3300)).toArray();p[1]+=Math.sin(clamp((now-t.startedAt)/3300)*Math.PI)*3}trophy.current.position.set(p[0],p[1]+.45,p[2]);trophy.current.rotation.y=now/900}
 })
 const countdown=c?.kind==='central-bomb'&&age<3300?(age<1100?c.previous:c.countdown):(room.boardState?.bombCountdown??5)
 return <>
 <CountdownSigns value={countdown}/>
 <group ref={burst} position={point}>{Array.from({length:22},(_,i)=><mesh key={i} position={[Math.sin(i*4.1),Math.cos(i*2.1),Math.sin(i*1.7)]}><icosahedronGeometry args={[.22,0]}/><meshBasicMaterial color={i%2?'#ff9d21':'#ffd965'} transparent opacity={.8}/></mesh>)}</group>
 {e?.id==='gold-mine'&&!e.resolved&&<Suspense fallback={null}><Pickaxe effect={e} position={demoPoint(e.nodeId)}/></Suspense>}
 {beat&&<group ref={reward}><mesh><cylinderGeometry args={[.20,.20,.06,20]}/><meshStandardMaterial color="#ffd15d" metalness={.7}/></mesh><Html center position={[0,.5,0]} style={{color:beat.amount>0?'#ffda66':'#ff6262',fontSize:24,fontWeight:900,whiteSpace:'nowrap'}}>{beat.amount>0?'+':''}{beat.amount} {beat.kind==='tokens'?'Tokens':'Trophy'}</Html></group>}
 {room.activeTrophyNodeId&&<group ref={trophy}><mesh><cylinderGeometry args={[.23,.12,.3,16]}/><meshStandardMaterial color="#ffcf4b" metalness={.8} roughness={.2}/></mesh><mesh position={[0,-.25,0]}><cylinderGeometry args={[.06,.06,.25,12]}/><meshStandardMaterial color="#ffcf4b"/></mesh><mesh position={[0,-.4,0]}><boxGeometry args={[.3,.06,.3]}/><meshStandardMaterial color="#ffcf4b"/></mesh></group>}
 </>
}
function Controls({room,activePlayer,overview,topDown,showcase}){
 const ref=useRef(),previous=useRef(''),{camera,size}=useThree(),fit=Math.min(size.width/36,size.height/39)
 useFrame((_,dt)=>{
  if(!ref.current)return
  const now=partyNow(),c=room.boardCinematic,e=room.turnState?.eventEffect,beat=presentationBeat(room,now)
  if(showcase&&!showcase.host&&showcase.camera){const p=showcase.camera;camera.position.lerp(vec(p.position),.25);ref.current.target.lerp(vec(p.target),.25);camera.zoom=(camera.top-camera.bottom)/p.viewHeight;camera.updateProjectionMatrix();ref.current.update();return}
  let target=null
  if(c){const age=now-c.startedAt
   if(c.kind==='minecart')target=minecartPosition(c,now)
   if(c.kind==='central-bomb')target=[0,4,-1.55]
   if(c.kind==='conveyor')target=[0,5,-9.2]
   if(c.kind==='ally-goodbye')target=demoPoint(c.nodeId)
   if(c.kind==='homestretch'){const i=Math.floor((age-1800)/2200);target=i>=0&&i<c.nodes.length?demoPoint(c.nodes[i]):center}
  }else if(e?.id==='gold-mine'&&!e.resolved)target=demoPoint(e.nodeId)
  else if(beat)target=demoPoint(beat.nodeId)
  const key=`${overview}-${topDown}-${!!target}-${size.width}-${size.height}`
  if(!target&&overview){if(previous.current!==key){camera.position.set(18,28,32);if(topDown)camera.position.set(0,40,.01);ref.current.target.set(...center);camera.zoom=fit;camera.updateProjectionMatrix();ref.current.update()}previous.current=key;return}
  target ||= playerPoint(room,activePlayer?.id,now)
  const desired=vec(target),offset=topDown?new THREE.Vector3(0,30,.01):new THREE.Vector3(9,14,15)
  const lock=c?.kind==='homestretch'&&((now-c.startedAt-1800)%2200)>=900;const factor=lock?1:1-Math.exp(-7*Math.min(dt,.1));camera.position.lerp(desired.clone().add(offset),factor);ref.current.target.lerp(desired,factor)
  camera.zoom+=(fit*(c?.kind==='central-bomb'?1.7:2.8)-camera.zoom)*factor;camera.updateProjectionMatrix();ref.current.update();previous.current=key
 })
 return <OrbitControls ref={ref} makeDefault enabled={overview&&!room.boardCinematic&&(!showcase||showcase.host)} enableRotate={!topDown} minZoom={fit*.6} maxZoom={fit*5} maxPolarAngle={Math.PI/2-.12} onChange={()=>{if(showcase?.host&&ref.current)showcase.onChange({position:camera.position.toArray(),target:ref.current.target.toArray(),viewHeight:(camera.top-camera.bottom)/camera.zoom})}}/>
}
export default function DemoMines3D({room,board,players=[],activePlayer,overview=false,quality='low',topDown=false,showcase,turnOrderPhase=false}){
 return <div className="party-immersive-canvas" style={{position:'absolute',inset:0,background:'#151015'}}><Canvas orthographic dpr={quality==='low'?.75:1} camera={{position:[18,28,32],zoom:20,near:.5,far:150}} gl={{antialias:quality!=='low',powerPreference:'default'}}>
 <color attach="background" args={['#151015']}/><fog attach="fog" args={['#151015',45,95]}/><ambientLight intensity={.3}/><hemisphereLight args={['#eed0aa','#25140b',.45]}/><directionalLight position={[0,18,8]} color="#ffe0a3" intensity={1.1}/><pointLight position={[0,6,12]} color="#ff5522" intensity={35} distance={25}/><pointLight position={[-10,6,0]} color="#62ffa6" intensity={15} distance={16}/>
 <AssetBoundary><Suspense fallback={<Html center>Loading Demo Mines…</Html>}><NativeBoard room={room} board={board}/><Effects room={room} board={board}/></Suspense></AssetBoundary>
 {players.map((p,i)=><Actor key={p.id} room={room} player={p} index={i} active={p.id===activePlayer?.id}/>)}
 <Controls room={room} activePlayer={activePlayer} overview={overview||turnOrderPhase} topDown={topDown} showcase={showcase}/>
 </Canvas></div>
}

function CountdownSigns({value}) {
 const texture=useMemo(()=>{
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,128,128);
  ctx.fillStyle=centralBombColor(value);ctx.font='bold 108px Arial';
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(value),64,68);
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;return tex;
 },[value]);
 useEffect(()=>()=>texture.dispose(),[texture]);
 const signs=[[-3.2,1.5,3.365,1.15],[3.2,1.5,3.365,1.15],[0,3.55,-6.425,1.15],[0,2.95,.935,.67]];
 return <>{signs.map(([x,y,z,size],i)=><mesh key={i} position={[x,y,z]} raycast={()=>null}>
  <planeGeometry args={[size*.7,size*.85]}/>
  <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} polygonOffset polygonOffsetFactor={-1}/>
 </mesh>)}</>;
}
