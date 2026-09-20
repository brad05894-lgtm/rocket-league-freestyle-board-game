import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { ref, get, set, update, runTransaction } from 'firebase/database'
const env = await initializeTestEnvironment({projectId:'demo-rl-security',database:{host:'127.0.0.1',port:9000,rules:readFileSync(new URL('../database.rules.json',import.meta.url),'utf8')}})
let passed = 0
async function check(label, fn) { await fn(); passed++; console.log('PASS',label) }
const db=uid=>uid?env.authenticatedContext(uid).database():env.unauthenticatedContext().database()
const host=db('host'), guest=db('guest'), stranger=db('stranger'), anonymous=db()
function room() { return {hostId:'host',createdAt:Date.now(),status:'lobby',seats:{0:'host'},players:{host:{id:'host',name:'Host',joinedAt:Date.now()}},settings:{cardVisibility:'hidden'}} }
try {
await env.clearDatabase()
for(const ns of ['secureRooms','securePartyRooms']) {
 const path=ns+'/ABCDEFGH'
 await check(ns+' create authenticated room',()=>assertSucceeds(set(ref(host,path),room())))
 await check(ns+' no unauthenticated read',()=>assertFails(get(ref(anonymous,path))))
 await check(ns+' no unauthenticated write',()=>assertFails(set(ref(anonymous,path+'/status'),'ended')))
 await check(ns+' no room list',()=>assertFails(get(ref(host,ns))))
 await check(ns+' outsider cannot read game',()=>assertFails(get(ref(stranger,path))))
 await check(ns+' outsider cannot modify game',()=>assertFails(set(ref(stranger,path+'/phase'),'board')))
 await check(ns+' cannot steal host seat',()=>assertFails(set(ref(guest,path+'/seats/0'),'guest')))
 await check(ns+' cannot forge player identity',()=>assertFails(set(ref(guest,path+'/players/host'),{id:'host',name:'Forged',joinedAt:Date.now()})))
 await check(ns+' reserve seat',()=>assertSucceeds(runTransaction(ref(guest,path+'/seats/1'),v=>v||'guest')))
 await check(ns+' cannot reserve second seat',()=>assertFails(set(ref(guest,path+'/seats/2'),'guest')))
 await check(ns+' join self',()=>assertSucceeds(runTransaction(ref(guest,path+'/players/guest'),v=>v||{id:'guest',name:'Guest',joinedAt:Date.now()})))
 await check(ns+' member reads room',()=>assertSucceeds(get(ref(guest,path))))
 await check(ns+' own car selection',()=>assertSucceeds(set(ref(guest,path+'/players/guest/carId'),'fennec')))
 await check(ns+' duplicate car blocked atomically',()=>assertFails(set(ref(host,path+'/players/host/carId'),'fennec')))
 await check(ns+' cannot edit other car',()=>assertFails(set(ref(guest,path+'/players/host/carId'),'octane')))
 await check(ns+' cannot become host',()=>assertFails(set(ref(guest,path+'/hostId'),'guest')))
 await check(ns+' cannot start',()=>assertFails(set(ref(guest,path+'/status'),'playing')))
 await check(ns+' cannot edit settings',()=>assertFails(set(ref(guest,path+'/settings/cardVisibility'),'open')))
 await check(ns+' cannot delete room',()=>assertFails(set(ref(guest,path),null)))
 await check(ns+' host can start',()=>assertSucceeds(update(ref(host,path),{status:'playing',startedAt:Date.now()})))
 await check(ns+' late join blocked',()=>assertFails(set(ref(stranger,path+'/seats/2'),'stranger')))
 if(ns==='securePartyRooms') {
  await check('Party full-room gameplay transaction preserves protected fields',()=>assertSucceeds(runTransaction(ref(guest,path),r=>r?{...r,turnIndex:1}:r)))
  await check('Party transaction cannot overwrite host',()=>assertFails(runTransaction(ref(guest,path),r=>r?{...r,hostId:'guest'}:r)))
  await check('Party transaction cannot overwrite settings',()=>assertFails(runTransaction(ref(guest,path),r=>r?{...r,settings:{cardVisibility:'open'}}:r)))
  await check('Party transaction cannot remove host',()=>assertFails(runTransaction(ref(guest,path),r=>r?{...r,players:{guest:r.players.guest}}:r)))
 } else {
  await check('Classic game write by member',()=>assertSucceeds(set(ref(guest,path+'/game'),{stateJson:'{"screen":"game"}',updatedBy:'guest',updatedAt:Date.now()})))
  await check('Classic spoofed updater blocked',()=>assertFails(set(ref(guest,path+'/game'),{stateJson:'{}',updatedBy:'host',updatedAt:Date.now()})))
 }
 await check(ns+' own leave is atomic',()=>assertSucceeds(update(ref(guest,path),{'players/guest':null,'departedPlayers/guest':{leftAt:Date.now()}})))
 await check(ns+' departed player loses access',()=>assertFails(get(ref(guest,path))))
 await check(ns+' departed player cannot write',()=>assertFails(set(ref(guest,path+'/turnIndex'),3)))
}
await check('legacy rooms blocked',()=>assertFails(get(ref(host,'rooms/ABCD'))))
await check('legacy Party blocked',()=>assertFails(get(ref(host,'partyRooms/ABCD'))))
console.log(`${passed} permission checks passed.`)
} finally { await env.cleanup() }
