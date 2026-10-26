import {useMemo,useRef} from 'react'
import {useFrame} from '@react-three/fiber'
import * as THREE from 'three'
import {partyNow} from './partyClock'
// Exact wall-hugging fuse path from the v5 Blender source, converted to Y-up.
export function fusePath(side){return [[side*.89,.82,3.28],[side*5.24,.82,3.28],[side*5.24,1.2,3.28],[side*5.24,2.28,3.28],[side*5.24,2.28,-6.35],[0,2.28,-6.35]]}
function onePath(points){let total=0;const segments=[];for(let i=1;i<points.length;i++){const a=new THREE.Vector3(...points[i-1]),b=new THREE.Vector3(...points[i]),len=a.distanceTo(b),steps=Math.ceil(len/.16);for(let k=0;k<steps;k++){const x=a.clone().lerp(b,k/steps),y=a.clone().lerp(b,(k+1)/steps),length=x.distanceTo(y);segments.push({position:x.clone().lerp(y,.5),rotation:new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),y.clone().sub(x).normalize()),length,end:total+length});total+=length}}return {segments,total,curve:new THREE.CurvePath()}}
function BurningFuse({side,cinematic}){
 const root=useRef(),fire=useRef(),points=useMemo(()=>fusePath(side),[side]),path=useMemo(()=>onePath(points),[points]);
 useFrame(()=>{if(!root.current)return;const c=cinematic,age=partyNow()-Number(c?.startedAt||0),exploding=c?.kind==='central-bomb'&&c.countdown===0,progress=exploding?Math.max(0,Math.min(1,(age-900)/1900)):0,restore=!exploding||age>=7100;
 root.current.children.forEach((o,i)=>o.visible=restore||path.segments[i].end/path.total>progress);
 if(fire.current){fire.current.visible=exploding&&age>=900&&age<2800;let d=progress*path.total,p=points.at(-1);for(let i=1;i<points.length;i++){const a=new THREE.Vector3(...points[i-1]),b=new THREE.Vector3(...points[i]),len=a.distanceTo(b);if(d<=len){p=a.lerp(b,d/len).toArray();break}d-=len}fire.current.position.set(...p);fire.current.scale.set(1+Math.sin(age*.07)*.2,1.4+Math.sin(age*.09)*.3,1);fire.current.rotation.y=age*.012}
 });
 return <><group ref={root}>{path.segments.map((s,i)=><mesh key={i} position={s.position} quaternion={s.rotation} raycast={()=>null}><cylinderGeometry args={[.106,.106,s.length+.015,6]}/><meshStandardMaterial color="#941b10" roughness={.85}/></mesh>)}</group><group ref={fire} visible={false}><mesh><sphereGeometry args={[.18,10,8]}/><meshBasicMaterial color="#fff2ad"/></mesh><mesh position={[0,.17,0]}><coneGeometry args={[.2,.55,8]}/><meshBasicMaterial color="#ff790d" transparent opacity={.85}/></mesh><pointLight color="#ff9a20" intensity={5} distance={2}/></group></>;
}
export default function DemoFuse({cinematic}){return <>{[-1,1].map(side=><BurningFuse key={side} side={side} cinematic={cinematic}/>)}</>}
