import { BOOSTSTONE_RUINS } from './booststoneRuins'
import layout from './demoMinesLayout.json'
const events = {
 'royal-explosion':{name:'Central Bomb'},
 'conveyor-reversal':{name:'Switch the Conveyor'},
 'minecart':{name:'All Aboard!'},
 'gold-mine':{name:'Dig for Gold!'},
}
export const CONVEYOR_NODE_IDS=['d31','d32','d33','d34','d35','d36','egg-stop']
const minesNodes=[...layout.nodes,...layout.stops].map(n=>({...n,next:[...n.next],
 type:n.type==='Steal'?'Lakitu':n.type==='Egg'?'BombPickup':n.type,
 special:['d29','d49'].includes(n.id)?'minecart':['d44','d46'].includes(n.id)?'gold-mine':n.special,
}))
export const DEMO_MINES_BOARD={...layout,prototypeOnly:false,subtitle:'Minecarts, risky gold mining and a ticking central bomb',nodes:minesNodes,boardEvents:events,gates:[],garageGatePairs:[],
 trophySpots:minesNodes.filter(n=>!CONVEYOR_NODE_IDS.includes(n.id)&&!['Event','Junction','Shop','Lakitu','BombPickup'].includes(n.type)).map(n=>n.id),
}
const DEMO_VARIANTS=Object.fromEntries(['lower','upper'].map(lane=>[lane,{...DEMO_MINES_BOARD,nodes:DEMO_MINES_BOARD.nodes.map(n=>n.id==='d31'?{...n,next:[lane==='upper'?'d34':'d32']}:n)}]))
export function getPartyBoard(room={}) {
 return room?.settings?.mapId==='demo-mines'?DEMO_VARIANTS[room.boardState?.conveyorLane==='upper'?'upper':'lower']:BOOSTSTONE_RUINS
}
export const PARTY_NODE_BY_ID=Object.fromEntries([...BOOSTSTONE_RUINS.nodes,...minesNodes].map(n=>[n.id,n]))
export function partyNext(room,id){return getPartyBoard(room).nodes.find(n=>n.id===id)?.next||[]}
export const CENTRAL_LOOP_IDS=['d03','d04','d05','d06','j-northeast','d07','d08','d09','d10','d11','d12','d13','d14','d15','j-southwest','d16']
export function demoPoint(id){
 if(id==='start-deck')return [0,.73,(layout.startDeck.y-510)/40]
 const n=PARTY_NODE_BY_ID[id];return n?[(n.x-620)/40,Number(n.worldHeight||.65)+.08,(n.y-510)/40]:[0,2.7,0]
}
