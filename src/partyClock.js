import { onValue, ref } from 'firebase/database'
import { db } from './firebase'
let offset=0,ready
export const partyNow=()=>Date.now()+offset
export function ensurePartyClock(){
  if(!ready)ready=new Promise(resolve=>{
    const timeout=setTimeout(resolve,1500)
    const finish=()=>{clearTimeout(timeout);resolve()}
    // .info is client-local metadata. Subscribe; never send a get() for it.
    onValue(ref(db,'.info/serverTimeOffset'),snapshot=>{offset=Number(snapshot.val())||0;finish()},finish)
  })
  return ready
}
