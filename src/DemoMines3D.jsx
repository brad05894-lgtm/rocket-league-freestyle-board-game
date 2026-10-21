import {partyPlayerColor} from './partyPlayerColors'
import {minecartFrame,stationRail} from './demoMinecartAnimation'
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
export function minecartPosition(c,now){return minecartFrame(c,now).player}
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
 const gltf=useGLTF(URL+'demo-mines-v13.glb?materials=20261020-events2')
 const model=useMemo(()=>{const s=gltf.scene.clone(true);s.traverse(o=>{if(o.isMesh){o.raycast=()=>null;o.material=o.material.clone();o.userData.baseColor=o.material.color?.clone();if((o.userData.sourceName||o.name).startsWith('BOMB_')){o.geometry=o.geometry.clone();o.geometry.translate(0,-4.4424,1.55);o.position.set(0,4.4424,-1.55)}if((o.userData.sourceName||o.name).startsWith('LEFT CHEVRON')){o.geometry=o.geometry.clone();o.geometry.computeBoundingBox();const pivot=o.geometry.boundingBox.getCenter(new THREE.Vector3());o.geometry.translate(-pivot.x,-pivot.y,-pivot.z);o.position.copy(pivot)}}});return s},[gltf.scene])
 useFrame(()=>{
  const now=partyNow(),c=room.boardCinematic
  model.traverse(o=>{
   const name=o.userData.sourceName||o.name
   if(name.startsWith('SPACE_')){
    const id=name.match(/d\d+/)?.[0];o.visible=id!==room.activeTrophyNodeId
    if(name.startsWith('SPACE_FILL_')&&board.nodes.find(n=>n.id===id)?.type==='Bad Luck'&&o.material){o.material.color.copy(o.userData.baseColor);const m=spaceMaterials[transformedBadLuck(room,id,now)?'Very Bad Luck dark purple':'Bad Luck'];o.material.color.setRGB(...m.color);o.material.emissive.setRGB(...m.emissive);o.material.emissiveIntensity=m.emissiveIntensity}
   }
   if(name.startsWith('LEFT CHEVRON'))o.rotation.z=0
   if(name.startsWith('BOMB_')){
    const explosion=c?.kind==='central-bomb'&&c.countdown===0,age=now-Number(c?.startedAt||0)
    o.visible=!explosion||age<2800||age>=5700
    o.position.set(0,4.4424,-1.55);o.rotation.set(0,0,0)
    if(explosion&&age>=900&&age<2800){const t=(age-900)/1900;o.position.x=Math.sin(age*.027)*.25*t;o.position.z+=Math.cos(age*.02)*.18*t;o.rotation.z=Math.sin(age*.025)*.16*t;o.rotation.x=Math.cos(age*.02)*.12*t}
    if(explosion&&age>=5700&&age<7100){const t=(age-5700)/1400;o.position.y+=12*(1-t*t);o.rotation.z=(1-t)*.8}
   }
   // Runtime cart replaces the parked model during the ride only.
   if(/minecart|cart body|cart wheel/i.test(name)&&!/rail|track|mouth/i.test(name))o.visible=false
  })
 })
 return <primitive object={model} userData={{minecartGround:true}}/>
}
function Pickaxe({effect,position}){
 const asset=useGLTF(URL+'mining-pickaxe.glb'),ref=useRef()
 const clone=useMemo(()=>asset.scene.clone(true),[asset.scene])
 useFrame(()=>{if(!ref.current)return;const t=clamp((partyNow()-Number(effect.lastSwingAt||0))/1100);ref.current.rotation.z=t<1?-.6+Math.sin(t*Math.PI*1.5)*1.3:-.5;ref.current.visible=!effect.broken||t<.75;ref.current.position.y=position[1]+.8})
 return <group ref={ref} position={position} scale={.85}><primitive object={clone}/></group>
}
function Cart(){return <group><mesh position={[0,.25,0]}><boxGeometry args={[.75,.48,.95]}/><meshStandardMaterial color="#705039" metalness={.3}/></mesh>{[-.4,.4].flatMap(x=>[-.32,.32].map(z=><mesh key={`${x}-${z}`} position={[x,0,z]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.17,.17,.08,12]}/><meshStandardMaterial color="#25292e" metalness={.7}/></mesh>))}</group>}
function Actor({room,player,index,active}){
 const ref=useRef(),egg=useRef(),world=useThree(state=>state.scene),groundRay=useMemo(()=>new THREE.Raycaster(),[]),groundCache=useRef(null)
 useFrame(()=>{if(!ref.current)return;const p=playerPoint(room,player.id,partyNow());if(room.playerSetup?.[player.id]?.onStartDeck)p[0]+=(index-1.5)*.55;else if(!(room.boardCinematic?.kind==='minecart'&&room.boardCinematic.playerId===player.id)){p[0]+=(index%2?1:-1)*.12;p[2]+=(index<2?1:-1)*.12}const ride=room.boardCinematic;if(ride?.kind==='minecart'&&ride.playerId===player.id){const f=minecartFrame(ride,partyNow());if(!f.riding){const root=world.children.find(o=>o.userData.minecartGround);if(root){const old=groundCache.current;if(!old||old.id!==ride.id||Math.hypot(old.x-p[0],old.z-p[2])>.08){groundRay.set(new THREE.Vector3(p[0],Math.max(demoPoint(ride.from)[1],demoPoint(ride.to)[1])+.7,p[2]),new THREE.Vector3(0,-1,0));const hit=groundRay.intersectObject(root,true).find(h=>h.object.visible&&h.point.y<=p[1]+1.8);groundCache.current={id:ride.id,x:p[0],z:p[2],y:hit?hit.point.y+.06:p[1]}}p[1]=Math.max(p[1],groundCache.current.y)}}}ref.current.position.set(...p);if(egg.current)egg.current.position.y=.6+Math.sin(partyNow()/220)*.08})
 const s=room.playerSetup?.[player.id],c=room.boardCinematic,inCart=c?.kind==='minecart'&&c.playerId===player.id
 return <group ref={ref}><mesh position={[0,.28,0]}><sphereGeometry args={[.23,14,10]}/><meshStandardMaterial color={partyPlayerColor(room,player.id)} emissive={active?'#40391d':'#000'}/></mesh>{s?.bombAlly&&<group ref={egg} position={[.45,.6,0]}><mesh scale={[.75,1,.75]}><sphereGeometry args={[.20,12,8]}/><meshStandardMaterial color="#ff982e"/></mesh></group>}</group>
}
function Effects({room,board}){
 const burst=useRef(),reward=useRef(),trophy=useRef();const [now,setNow]=useState(partyNow())
 useEffect(()=>{const t=setInterval(()=>setNow(partyNow()),80);return()=>clearInterval(t)},[])
 const c=room.boardCinematic,e=room.turnState?.eventEffect,beat=presentationBeat(room,now)
 const bombing=c?.kind==='central-bomb'&&c.countdown===0||c?.kind==='ally-goodbye'
 const point=c?.kind==='central-bomb'?[0,4.4,-1.55]:demoPoint(c?.nodeId||room.playerSetup?.[c?.playerId]?.boardNodeId)
 const age=now-Number(c?.startedAt||0)
 useFrame(()=>{
  if(burst.current){burst.current.visible=c?.kind==='ally-goodbye'&&age>=1300&&age<3300;burst.current.scale.setScalar(.2+clamp((age-1300)/1600)*3.8);burst.current.rotation.y+=.02}
  if(reward.current&&beat){reward.current.position.set(...demoPoint(beat.nodeId));reward.current.position.y+=1.5+(beat.amount>0?-1:1)*Math.sin(clamp(beat.age/2200)*Math.PI);reward.current.rotation.y+=.06}
  if(trophy.current){let p=demoPoint(room.activeTrophyNodeId);const t=room.turnState?.trophyCinematic;if(t&&now>=t.startedAt&&now<t.startedAt+3300){const a=demoPoint(t.fromNodeId||t.from||room.playerSetup?.[room.turnState?.playerId]?.boardNodeId);p=vec(a).lerp(vec(p),clamp((now-t.startedAt)/3300)).toArray();p[1]+=Math.sin(clamp((now-t.startedAt)/3300)*Math.PI)*3}trophy.current.position.set(p[0],p[1]+.45,p[2]);trophy.current.rotation.y=now/900}
 })
 const countdown=c?.kind==='central-bomb'?(age<1300?c.previous:c.countdown===0?(age<7100?0:Math.min(5,1+Math.floor((age-7100)/180))):c.countdown):(room.boardState?.bombCountdown??5)
 return <>
 <CountdownSigns value={countdown}/>
 <ConveyorRoute room={room}/>
 <StationSteps/>
 <CentralBlast cinematic={c}/>
 {c?.kind==='minecart'?<RideCart cinematic={c}/>:<group position={stationRail(room.boardState?.minecartStation||'d49')[0].map((v,i)=>i===1?v+.17:v)}><Cart/></group>}
 <group ref={burst} position={point}>{Array.from({length:22},(_,i)=><mesh key={i} position={[Math.sin(i*4.1),Math.cos(i*2.1),Math.sin(i*1.7)]}><icosahedronGeometry args={[.22,0]}/><meshBasicMaterial color={i%2?'#ff9d21':'#ffd965'} transparent opacity={.8}/></mesh>)}</group>
 {e?.id==='gold-mine'&&!e.resolved&&<Suspense fallback={null}><Pickaxe effect={e} position={demoPoint(e.nodeId).map((v,i)=>i===0?v+.4:v)}/></Suspense>}
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
   if(c.kind==='minecart'){const f=minecartFrame(c,now);target=f.waiting?f.cart:f.player}
   if(c.kind==='central-bomb')target=[0,3.7,-1.55]
   if(c.kind==='conveyor')target=[0,5,-9.2]
   if(c.kind==='ally-goodbye')target=demoPoint(c.nodeId)
   if(c.kind==='homestretch'){const i=Math.floor((age-1800)/2200);target=i>=0&&i<c.nodes.length?demoPoint(c.nodes[i]):center}
  }else if(e?.id==='gold-mine'&&!e.resolved)target=demoPoint(e.nodeId)
  else if(beat)target=demoPoint(beat.nodeId)
  const key=`${overview}-${topDown}-${!!target}-${size.width}-${size.height}`
  if(!target&&overview){if(previous.current!==key){camera.position.set(18,28,26);if(topDown)camera.position.set(0,40,.01);ref.current.target.set(...center);camera.zoom=fit*1.13;camera.updateProjectionMatrix();ref.current.update()}previous.current=key;return}
  target ||= playerPoint(room,activePlayer?.id,now)
  if(e?.id==='gold-mine'&&!e.resolved){target=[target[0]+(size.width>600?2.5:0),target[1],target[2]+(size.width<=600?2:0)]}
  const desired=vec(target),offset=topDown?new THREE.Vector3(0,30,.01):new THREE.Vector3(9,14,15)
  const lock=c?.kind==='homestretch'&&((now-c.startedAt-1800)%2200)>=900;const factor=lock?1:1-Math.exp(-7*Math.min(dt,.1));camera.position.lerp(desired.clone().add(offset),factor);ref.current.target.lerp(desired,factor)
  camera.zoom+=(fit*(c?.kind==='central-bomb'?(c.countdown===0&&now-c.startedAt<2800?1.7:1.12):c?.kind==='minecart'?1.8:e?.id==='gold-mine'?2:2.8)-camera.zoom)*factor;camera.updateProjectionMatrix();ref.current.update();previous.current=key
 })
 return <OrbitControls ref={ref} makeDefault enabled={overview&&!room.boardCinematic&&(!showcase||showcase.host)} enableRotate={!topDown} minZoom={fit*.6} maxZoom={fit*5} maxPolarAngle={Math.PI/2-.12} onChange={()=>{if(showcase?.host&&ref.current)showcase.onChange({position:camera.position.toArray(),target:ref.current.target.toArray(),viewHeight:(camera.top-camera.bottom)/camera.zoom})}}/>
}
export default function DemoMines3D({room,board,players=[],activePlayer,overview=false,quality='low',topDown=false,showcase,turnOrderPhase=false}){
 return <div className="party-immersive-canvas" style={{position:'absolute',inset:0,background:'#100b09'}}><Canvas orthographic dpr={quality==='low'?.75:1} camera={{position:[18,28,32],zoom:20,near:.5,far:150}} gl={{antialias:quality!=='low',powerPreference:'default'}}>
 <color attach="background" args={['#100b09']}/><fog attach="fog" args={['#100b09',40,85]}/><ambientLight intensity={.13}/><hemisphereLight args={['#bd7848','#160a06',.24]}/><directionalLight position={[0,18,8]} color="#ffd29b" intensity={.65}/><pointLight position={[0,6,12]} color="#ff6826" intensity={48} distance={22}/><pointLight position={[-10,6,0]} color="#62ffa6" intensity={22} distance={13}/>
 <pointLight position={[10,5,1]} color="#59e895" intensity={20} distance={12}/>
 <pointLight position={[8,5,-8]} color="#ffad57" intensity={16} distance={10}/>
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

function RideCart({cinematic}){
 const ref=useRef()
 useFrame(()=>{const f=minecartFrame(cinematic,partyNow());if(ref.current){ref.current.position.set(f.cart[0],f.cart[1]+.17,f.cart[2]);ref.current.rotation.y=f.yaw}})
 return <group ref={ref}><Cart/></group>
}
function CentralBlast({cinematic}){
 const ref=useRef(),core=useRef(),ring=useRef()
 useFrame(()=>{
  if(!ref.current)return
  const age=partyNow()-Number(cinematic?.startedAt||0),t=clamp((age-2800)/2000)
  ref.current.visible=cinematic?.kind==='central-bomb'&&cinematic.countdown===0&&age>=2800&&age<5700
  if(core.current){core.current.scale.setScalar(.3+t*5.8);core.current.material.opacity=Math.max(0,1-t)}
  if(ring.current){ring.current.scale.setScalar(.2+t*7);ring.current.material.opacity=Math.max(0,.85-t*.85)}
  ref.current.children.slice(2).forEach((o,i)=>{const a=i*2.399;o.position.set(Math.cos(a)*t*5.5,1+Math.sin(t*Math.PI)*(2+(i%3)),Math.sin(a)*t*5.5);o.scale.setScalar(.15+(1-t)*.7);o.material.opacity=Math.max(0,1-t)})
 })
 return <group ref={ref} position={[0,2.7,-1.55]} visible={false}>
 <mesh ref={core}><sphereGeometry args={[1,20,12]}/><meshBasicMaterial color="#ffab32" transparent opacity={0} depthWrite={false}/></mesh>
 <mesh ref={ring} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.75,1,48]}/><meshBasicMaterial color="#ffdc76" side={THREE.DoubleSide} transparent depthWrite={false}/></mesh>
 {Array.from({length:28},(_,i)=><mesh key={i}><icosahedronGeometry args={[.6,1]}/><meshBasicMaterial color={i%3?'#ff761b':'#fff0ad'} transparent depthWrite={false}/></mesh>)}
 </group>
}
function ConveyorRoute({room}){
 const upper=room.boardState?.conveyorLane==='upper'
 return <group>{[['upper',['d31','d34','d35','d36']],['lower',['d31','d32','d33','d36']]].map(([lane,ids])=><group key={lane}>{ids.slice(1).map((id,i)=>{
 const a=vec(demoPoint(ids[i])),b=vec(demoPoint(id)),mid=a.clone().lerp(b,.5),length=a.distanceTo(b),active=(lane==='upper')===upper
 return <group key={id} position={[mid.x,mid.y+.02,mid.z]} rotation={[0,Math.atan2(b.x-a.x,b.z-a.z),0]}>
 <mesh rotation={[-Math.PI/2,0,0]}><planeGeometry args={[.34,length]}/><meshBasicMaterial color={active?'#7bffc7':'#282324'} transparent opacity={active?.5:.8} depthWrite={false}/></mesh>
 {!active&&i===0&&<group position={[0,.45,0]}><mesh><boxGeometry args={[1,.18,.15]}/><meshStandardMaterial color="#e58d35"/></mesh>{[-.4,.4].map(x=><mesh key={x} position={[x,-.2,0]}><boxGeometry args={[.08,.65,.08]}/><meshStandardMaterial color="#353434"/></mesh>)}</group>}
 </group>
 })}</group>)}</group>
}

function StationSteps(){
 const a=demoPoint('d49'),zEnd=10
 return <group>{Array.from({length:6},(_,i)=>{const t=(i+.5)/6,top=a[1]-(a[1]-.14)*i/6;return <mesh key={i} position={[a[0]+(-10.4-a[0])*t,top-.12,a[2]+(zEnd-a[2])*t]}><boxGeometry args={[.85,.24,(zEnd-a[2])/6+.015]}/><meshStandardMaterial color="#514434" roughness={.9}/></mesh>})}</group>
}
