import {useState} from 'react'
export default function PartyRulesPanel(){
 const [open,setOpen]=useState(false)
 return <><button className="party-showcase-rules-button" aria-expanded={open} onClick={()=>setOpen(!open)}>📖 Rules</button>{open&&<aside className="party-showcase-rules" aria-label="Party rules"><header><strong>How to play</strong><button onClick={()=>setOpen(false)} aria-label="Minimize rules">✕</button></header><div>
 <h3>The goal</h3><p>Collect the most Trophies. Tokens break a tie. After the final round, one random bonus category awards a Trophy to every player tied for that category.</p>
 <h3>Your turn</h3><p>Everyone begins on the start deck. Roll a normal die to set turn order. On your turn, use an eligible Action Card, choose your normal or car’s special die, and press Stop. Each movement point advances one playable space. A zero or Token-only roll does not activate your current space again.</p>
 <h3>Spaces</h3><ul>
 <li><b>Blue — Mechanic:</b> Complete the displayed mechanic within its attempts and time limit to earn Tokens. The screen shows the difficulty and payout.</li>
 <li><b>Red — Danger Mechanic:</b> Complete the mechanic to avoid a penalty. Success gives no Tokens; missing costs the displayed amount. Balances never go below zero.</li>
 <li><b>Action Card:</b> Receive a Card, subject to the inventory limit. Each Card explains when and how to use it.</li>
 <li><b>Shamrock — Lucky:</b> Spin for a helpful reward.</li>
 <li><b>Spiky !? — Bad Luck:</b> Spin for a setback. Dark purple marks Very Bad Luck with stronger outcomes.</li>
 <li><b>Orange VS triangle:</b> Follow the Battle selection and rules shown on screen. End-of-round Challenges also award Tokens.</li>
 <li><b>White ! — Event:</b> Trigger that location’s board event.</li></ul>
 <h3>Events and junctions</h3><ul>
 <li><b>Garage gates:</b> Each pair alternates which route is closed. Take the open path or choose the closed path and pay its toll. You can go back before paying, or stop at the previous playable space.</li>
 <li><b>Boost Boulder:</b> The ball rolls down the back lane. Affected players lose up to 6 Tokens and return to the space before the lane; that space does not activate.</li>
 <li><b>Choose a Treasure Chest:</b> Walk to the raised platform and choose one of three hidden rewards, then return to the Event space.</li>
 <li><b>Token sign — Action Shop:</b> Preview a Card’s description and price before buying, or pass.</li>
 <li><b>Bench and wing sign — Transportation:</b> Pay the displayed fare to travel to another player. The arrival space does not activate.</li>
 <li><b>Cloud — Steal:</b> Pay the displayed fee to take Tokens or a Trophy from another player.</li>
 <li><b>Black junctions:</b> Choose a route or service without spending a movement point. Minimize Turn and open Board to look around before deciding.</li></ul>
 <h3>Trophies and surprises</h3><p>The golden Trophy temporarily replaces a playable space. Buy it at the displayed price when offered. After collection, it floats to another eligible, unoccupied space. Events and junctions cannot hold it.</p><p>A Hidden Gift may be waiting on a blue space. You must land exactly on it to reveal its spinner. Collect Tokens or an extra Trophy; an extra Trophy does not move the board’s Trophy. Another gift is then hidden elsewhere.</p>
 <h3>Cards and Challenges</h3><p>Read the Card’s timing and any target restrictions. Hidden Hands keeps unrevealed Cards private. For a Challenge, follow its own rules and enter only the results requested. The host can recover a stuck event or Battle from the available recovery controls.</p>
 <h3>Final stretch and bonus</h3><p>The final three rounds increase the displayed mechanic rewards and penalties and the Hidden Gift’s Token reward. Watch each space’s current amounts.</p><p>The final bonus can reward minigame Tokens, total Tokens collected, Event visits, Card use, most or fewest spaces traveled, or the most Red and Bad Luck landings. Tied bonus winners each receive a Trophy.</p>
 </div></aside>}</>
}
