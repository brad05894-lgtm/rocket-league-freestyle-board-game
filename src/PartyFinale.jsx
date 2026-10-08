import { useEffect, useState } from 'react'
import FinaleMusic from './FinaleMusic'
import { BONUS_CATEGORIES } from './partyProgress'
import { getPartyCar, getPartyCarImageUrl } from './partyCars'
export default function PartyFinale({ room, clockOffset=0, onLeave, isHost, isPreview=false }) {
  const [now,setNow]=useState(Date.now()+clockOffset)
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()+clockOffset),100);return()=>clearInterval(timer)},[clockOffset])
  const age=Math.max(0,(now-Number(room.finaleStartedAt||0))/1000)
  const bonus=Object.values(room.bonusResults||{})[0]
  const players=Object.values(room.players||{}).filter(p=>!room.departedPlayers?.[p.id])
  const score=id=>room.playerSetup?.[id]||{}
  const compare=(a,b)=>(score(b.id).trophies||0)-(score(a.id).trophies||0)||(score(b.id).tokens||0)-(score(a.id).tokens||0)
  const sorted=[...players].sort(compare)
  const ranks=sorted.map(p=>1+sorted.filter(other=>compare(other,p)<0).length)
  const reveals=Math.max(0,Math.floor((age-17)/3)+1), done=reveals>=sorted.length
  const winners=(bonus?.winners||[]).map(id=>room.players?.[id]?.name||'Player')
  const category=age<7?BONUS_CATEGORIES[Math.floor(age*5)%7]?.[1]:bonus?.name
  return <main className="party-finale" aria-live="polite"><div className="party-finale-glow"/><FinaleMusic done={done}/>{isPreview&&<header className="party-finale-preview"><strong>DEV preview — real balances unchanged</strong>{isHost?<button onClick={onLeave}>Return to Board</button>:<p>Waiting for the host to finish the preview.</p>}</header>}<section key={age<4?'intro':age<11?'category':age<17?'bonus':'results'} className="party-finale-card">
    {age<4?<><p>THE ADVENTURE IS COMPLETE</p><h1>One Trophy remains.</h1><div className="party-finale-trophy">🏆</div><p>It could change everything.</p></>:age<11?<><p>THIS GAME’S BONUS TROPHY</p><div className="party-finale-trophy">🏆</div><h1>{category}</h1>{age>=7&&<p>{bonus?.description}</p>}</>:age<17?<><p>{bonus?.name}</p><div className="party-finale-trophy">🏆</div><h1>{winners.join(' & ') || 'Player'}!</h1><p>{winners.length>1?'+1 Bonus Trophy each':'+1 Bonus Trophy'}</p>{bonus?.tiedPlayerIds?.length>1&&<p>Tied for this award — every tied winner receives a Trophy.</p>}</>:<><p>THE FINAL STANDINGS</p><h1>{done?'The results are in!':'Who takes the crown?'}</h1><div className="party-finale-placements">{sorted.map((p,index)=>{
      if(index<sorted.length-reveals)return null
      const car=getPartyCar(score(p.id).carId)
      return <article key={p.id} className={ranks[index]===1?'is-champion':''}><strong>#{ranks[index]}</strong>{car&&<img src={getPartyCarImageUrl(car)} alt={car.name}/>}<div><h2>{p.name}</h2><p>{score(p.id).trophies||0} Trophies · {score(p.id).tokens||0} Tokens</p></div></article>
    })}</div>{done&&<p>Trophies first, then Tokens. Equal totals share a place.</p>}</>}
    {done&&!isPreview&&<button onClick={onLeave}>Main Menu</button>}
  </section></main>
}
