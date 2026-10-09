import {useEffect,useMemo,useRef} from 'react'
import {useFrame,useThree} from '@react-three/fiber'
import * as THREE from 'three'
import {presentationBeat} from './partyPresentation'
import layout from './booststoneV7Layout.json'
export const DECK_POINT=[4.975,.71,5.875]
export function rewardPoint(beat){return beat?.position|| (beat?.nodeId==='start-deck'?DECK_POINT:layout.nodes[beat?.nodeId])}
export function RewardParticles({room,clockOffset}) {
 const group=useRef(),coins=useRef(),trophy=useRef(),invalidate=useThree(s=>s.invalidate)
 const dummy=useMemo(()=>new THREE.Object3D(),[])
 useEffect(()=>{invalidate()},[room.presentation,invalidate])
 const count=Math.max(1,...(room.presentation?.beats||[]).filter(b=>b.kind==='tokens').map(b=>Math.abs(b.amount)))
 useFrame(()=>{
  const beat=presentationBeat(room,Date.now()+clockOffset),p=rewardPoint(beat)
  if(!group.current)return
  group.current.visible=Boolean(beat&&p)
  if(!beat||!p){if(Date.now()+clockOffset<Number(room.presentation?.endsAt||0))invalidate();return}
  group.current.position.set(...p)
  const isTrophy=beat.kind==='trophies',total=Math.abs(beat.amount)
  coins.current.visible=!isTrophy;trophy.current.visible=isTrophy
  for(let i=0;i<(isTrophy?1:count);i++){
   const local=(beat.age-550-i*(900/Math.max(1,total)))/650,t=Math.max(0,Math.min(1,local)),visible=i<total&&local>=0&&local<1
   const fall=beat.amount>0?1-t:t
   dummy.position.set(Math.sin(i*2.4)*.23,.22+fall*1.9,Math.cos(i*2.4)*.23)
   dummy.rotation.set(Math.PI/2,t*8+i,0);dummy.scale.setScalar(visible?1:0);dummy.updateMatrix()
   if(isTrophy){trophy.current.visible=visible;trophy.current.position.copy(dummy.position);trophy.current.rotation.y=t*5;trophy.current.scale.setScalar(1+Math.sin(t*Math.PI)*.35)}
   else coins.current.setMatrixAt(i,dummy.matrix)
  }
  coins.current.instanceMatrix.needsUpdate=true;invalidate()
 })
 return <group ref={group}><instancedMesh key={count} ref={coins} args={[null,null,count]} frustumCulled={false}><cylinderGeometry args={[.11,.11,.035,16]}/><meshStandardMaterial color="#f1c75b" metalness={.72} roughness={.3} emissive="#b68c28" emissiveIntensity={.2}/></instancedMesh><group ref={trophy}><mesh><cylinderGeometry args={[.19,.08,.22,12]}/><meshStandardMaterial color="#ffd66f" metalness={.65} roughness={.22} emissive="#e7b950" emissiveIntensity={.6}/></mesh><mesh position={[0,-.19,0]}><cylinderGeometry args={[.035,.035,.2,8]}/><meshStandardMaterial color="#ffd66f"/></mesh><mesh position={[0,-.30,0]}><boxGeometry args={[.22,.06,.18]}/><meshStandardMaterial color="#ffd66f"/></mesh>{[-1,1].map(x=><mesh key={x} position={[x*.18,0,0]}><torusGeometry args={[.09,.02,6,12]}/><meshStandardMaterial color="#ffd66f"/></mesh>)}</group></group>
}
export function BoardServices(){
 const wing=useMemo(()=>{const s=new THREE.Shape();s.moveTo(0,0);s.lineTo(.12,.12);s.lineTo(.28,.15);s.lineTo(.22,.04);s.lineTo(.10,-.03);s.closePath();return s},[])
 const transport=layout.nodes.n17,steal=layout.nodes.n32
 return <group><group position={[transport[0]-.40,transport[1],transport[2]+.22]}>
 <mesh position={[0,.20,0]}><boxGeometry args={[.58,.055,.22]}/><meshStandardMaterial color="#78968d"/></mesh><mesh position={[0,.37,-.09]}><boxGeometry args={[.58,.22,.045]}/><meshStandardMaterial color="#78968d"/></mesh>{[-.21,.21].map(x=><mesh key={x} position={[x,.10,0]}><boxGeometry args={[.045,.2,.18]}/><meshStandardMaterial color="#354b48"/></mesh>)}
 <mesh position={[.42,.44,0]}><cylinderGeometry args={[.022,.022,.88,8]}/><meshStandardMaterial color="#bbc7bd"/></mesh><mesh position={[.42,.83,0]}><boxGeometry args={[.6,.36,.045]}/><meshStandardMaterial color="#314c50"/></mesh>{[-1,1].map(sign=><mesh key={sign} position={[.42,.81,.027]} scale={[sign,1,1]}><shapeGeometry args={[wing]}/><meshBasicMaterial color="#f1f5ee" side={THREE.DoubleSide}/></mesh>)}</group>
 <group position={[steal[0],steal[1]+.58,steal[2]]}>{[[-.18,0,.12],[0,.07,.18],[.18,0,.13],[0,-.03,.16]].map(([x,y,r],i)=><mesh key={i} position={[x,y,0]}><sphereGeometry args={[r,14,10]}/><meshStandardMaterial color="#e1e8e5" roughness={.85}/></mesh>)}{[-.06,.06].map(x=><mesh key={x} position={[x,.06,.166]}><sphereGeometry args={[.018,8,6]}/><meshBasicMaterial color="#223839"/></mesh>)}</group></group>
}
// Path built from the V7 terrain formula. The east entry rises in ten equal .08 steps.
export function chestWalkPoint(progress){
 const start=layout.nodes.n19,points=[start,[2.275,.88,-2.875]]
 for(let i=1;i<=10;i++){
  const x=2.275-(i-1)*.1
  points.push([x,.88+i*.08,-2.875],[2.275-i*.1,.88+i*.08,-2.875])
 }
 points.push([1.10,1.68,-2.875],[1.10,1.68,-2.60],[-.1,1.68,-2.60])
 const lengths=points.slice(1).map((p,i)=>Math.hypot(...p.map((v,j)=>v-points[i][j])))
 let distance=Math.max(0,Math.min(1,progress))*lengths.reduce((a,b)=>a+b,0)
 for(let i=0;i<lengths.length;i++){if(distance<=lengths[i]){const t=lengths[i]?distance/lengths[i]:1;return points[i].map((v,j)=>v+(points[i+1][j]-v)*t)}distance-=lengths[i]}
 return points.at(-1)
}
export function HiddenGiftOnBoard({room,clockOffset}){
 const ref=useRef(),invalidate=useThree(s=>s.invalidate),gift=room.turnState?.hiddenGiftResult
 const node=room.playerSetup?.[gift?.playerId]?.boardNodeId,p=layout.nodes[node]
 useEffect(()=>{invalidate()},[gift,invalidate])
 useFrame(()=>{if(!ref.current||!gift||gift.dismissed)return;const age=Date.now()+clockOffset-gift.startedAt;ref.current.rotation.y=age/1600;ref.current.position.y=p[1]+.44+Math.sin(age/300)*.06;invalidate()})
 if(!gift||gift.dismissed||!p)return null
 return <group ref={ref} position={[p[0],p[1]+.44,p[2]]}><mesh><boxGeometry args={[.38,.36,.38]}/><meshStandardMaterial color="#8a718e" roughness={.4}/></mesh><mesh position={[0,.20,0]}><boxGeometry args={[.42,.07,.42]}/><meshStandardMaterial color="#a98ead"/></mesh><mesh><boxGeometry args={[.07,.43,.395]}/><meshStandardMaterial color="#f0cb6d" metalness={.5}/></mesh><mesh><boxGeometry args={[.395,.43,.07]}/><meshStandardMaterial color="#f0cb6d" metalness={.5}/></mesh></group>
}
