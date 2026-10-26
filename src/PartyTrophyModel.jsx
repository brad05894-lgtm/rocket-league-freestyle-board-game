import {useMemo,useRef} from 'react'
import {useGLTF} from '@react-three/drei'
import {useFrame,useThree} from '@react-three/fiber'
import * as THREE from 'three'
export function PartyTrophyModel({height=.95}){
 const gltf=useGLTF((import.meta.env.BASE_URL||'/')+'models/party-trophy.glb');
 const model=useMemo(()=>{const s=gltf.scene.clone(true);s.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(s),size=box.getSize(new THREE.Vector3()),mid=box.getCenter(new THREE.Vector3()),scale=height/Math.max(.01,size.y);s.position.set(-mid.x*scale,-box.min.y*scale,-mid.z*scale);s.scale.setScalar(scale);s.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.emissive?.set('#8c5d08');o.material.emissiveIntensity=.35;o.raycast=()=>null}});return s},[gltf.scene,height]);
 return <primitive object={model}/>;
}
export function TrophyBeacon({position,visible=true}){
 const ring=useRef(),invalidate=useThree(s=>s.invalidate);
 useFrame(({clock})=>{if(visible&&ring.current){ring.current.scale.setScalar(1+Math.sin(clock.elapsedTime*3)*.12);invalidate()}});
 if(!visible||!position)return null;
 return <group position={position}><mesh ref={ring} rotation={[-Math.PI/2,0,0]} position={[0,.08,0]} renderOrder={20}><ringGeometry args={[.48,.62,40]}/><meshBasicMaterial color="#ffe58c" transparent opacity={.95} depthTest={false} depthWrite={false}/></mesh><mesh position={[0,1.1,0]} renderOrder={19}><cylinderGeometry args={[.12,.4,2.1,24,1,true]}/><meshBasicMaterial color="#ffd66b" transparent opacity={.18} depthWrite={false} side={THREE.DoubleSide}/></mesh></group>
}
