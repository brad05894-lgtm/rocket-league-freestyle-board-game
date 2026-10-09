import {useEffect,useState} from 'react'
import {challengeNow} from './partyChallengeTransport'
import TokenIcon from './TokenIcon'
export default function PartyHiddenGift({gift,name,canCollect,onCollect,onRecover,isHost,busy}) {
 const [now,setNow]=useState(challengeNow())
 useEffect(()=>{const t=setInterval(()=>setNow(challengeNow()),50);return()=>clearInterval(t)},[])
 const age=now-gift.startedAt,done=age>=5200,angle=gift.kind==='trophies'?342:162
 const progress=Math.min(1,Math.max(0,(age-800)/4400)),rotation=(360*7+(360-angle))*(1-Math.pow(1-progress,4))
 return <div className="party-gift-overlay" role="dialog" aria-modal="true" aria-label="Hidden Gift"><section><p>🎁 A HIDDEN GIFT!</p><h2>{name} found a surprise!</h2><p>Land exactly on a hidden gift to reveal its reward.</p><div className="party-gift-wheel-wrap"><span className="party-gift-pointer">▼</span><div className="party-gift-wheel" style={{transform:`rotate(${rotation}deg)`}}><span className="gift-coin"><TokenIcon/></span><span className="gift-trophy">🏆</span></div></div><strong aria-live="polite">{done?gift.kind==='trophies'?'+1 Trophy!':`+${gift.amount} Tokens!`:'Opening your gift…'}</strong>{canCollect&&<button disabled={!done||busy} onClick={onCollect}>Collect Gift</button>}{!canCollect&&<p>Waiting for {name}…</p>}{isHost&&<button className="party-small-recovery" onClick={onRecover}>Skip gift (recovery)</button>}</section></div>
}
