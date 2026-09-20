import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {initializeTestEnvironment,assertFails} from '@firebase/rules-unit-testing'
import {ref,get,set,onValue} from 'firebase/database'
import {classic,party,useTestPlayer} from './api-bundle.mjs'
const env=await initializeTestEnvironment({projectId:'demo-rl-security',database:{host:'127.0.0.1',port:9000,rules:readFileSync(new URL('../database.rules.json',import.meta.url),'utf8')}})
const subscriptions=[];
async function watch(database,path) { await new Promise((resolve,reject)=>{ subscriptions.push(onValue(ref(database,path),()=>resolve(),reject)) }) }
const dbs={};const use=uid=>{dbs[uid] ||= env.authenticatedContext(uid).database();useTestPlayer(dbs[uid],uid);return dbs[uid]}
try {
await env.clearDatabase()
use('host');const code=await classic.createRoom('Host');assert.equal(code.length,8)
for(const id of ['guest','third','fourth']){use(id);await classic.joinRoom(code,id)}
use('fifth');await assert.rejects(classic.joinRoom(code,'Fifth'))
console.log('PASS actual Classic API: create, four members, full-room rejection')
use('host');await classic.startRoom(code)
use('guest');await classic.saveGameState(code,{screen:'rules',players:[{id:'host'},{id:'guest'}]},'guest')
await classic.saveClassicCarSelection(code,'guest','fennec')
const state=JSON.parse((await get(ref(dbs.guest,`secureRooms/${code}/game`))).val().stateJson)
assert.equal(state.players[1].carId,'fennec')
console.log('PASS actual Classic API: start, state sync, guest car selection')
use('host');await classic.kickPlayer(code,'host','guest')
use('guest');await assertFails(get(ref(dbs.guest,`secureRooms/${code}`)))
await assert.rejects(classic.joinRoom(code,'Guest'))
console.log('PASS actual Classic API: kick revokes access and blocks rejoin')
use('host');await classic.endRoom(code,'host')
const pc=await party.createPartyRoom('Host')
use('guest');await party.joinPartyRoom(pc,'Guest')
await party.selectPartyCar(pc,'guest','fennec')
use('host');await party.selectPartyCar(pc,'host','octane');await party.updatePartyRounds(pc,'host',15);await party.updatePartyCardVisibility(pc,'host','open');await party.startPartyRoom(pc,'host')
console.log('PASS actual Party API: join, both car choices, host settings, start')
await watch(dbs.host,`securePartyRooms/${pc}`);await party.rollPartyTurnOrder(pc,'host')
use('guest');await watch(dbs.guest,`securePartyRooms/${pc}`);await party.rollPartyTurnOrder(pc,'guest')
let room=(await get(ref(dbs.guest,`securePartyRooms/${pc}`))).val();assert.equal(room.phase,'board')
use(room.turnState.playerId);await get(ref(dbs[room.turnState.playerId],`securePartyRooms/${pc}`));await party.rollPartyDie(pc,room.turnState.playerId,'normal')
console.log('PASS actual Party API: turn-order transactions and normal die roll')
use('guest');await party.leavePartyRoom(pc,'guest');await assertFails(get(ref(dbs.guest,`securePartyRooms/${pc}`)))
use('host');await party.leavePartyRoom(pc,'host')
console.log('PASS actual Party API: member leave, host ends room')
} finally { subscriptions.forEach(off=>off()); await env.cleanup() }
