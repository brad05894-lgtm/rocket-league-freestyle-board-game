// Monetary state lives in the room transaction; animations never award money.
export function boardRanks(room){
 const ids=Object.keys(room.players||{}).filter(id=>!room.departedPlayers?.[id]);
 const score=id=>[Number(room.playerSetup?.[id]?.trophies)||0,Number(room.playerSetup?.[id]?.tokens)||0];
 return Object.fromEntries(ids.map(id=>{const [t,c]=score(id);return [id,1+ids.filter(other=>{const [ot,oc]=score(other);return ot>t||ot===t&&oc>c}).length]}));
}
export function fundVsPot(room,b,stake,seed){
 if(b.source!=='battle-space'||b.stage!=='stake'||b.pot||![2,4,6].includes(stake))throw Error('Choose an available VS stake.');
 const ranks=boardRanks(room),ids=b.participantIds;
 if(ids.some(id=>!room.players?.[id]||room.departedPlayers?.[id]))throw Error('The participants changed. Cancel this battle.');
 // Random fallback is captured once and reused for tied overall standings.
 let x=seed>>>0;const random=()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296};
 const priority=[...ids];for(let i=priority.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[priority[i],priority[j]]=[priority[j],priority[i]]}
 const contributions={};for(const id of ids){const s=room.playerSetup[id];const balance=Math.max(0,Math.floor(Number(s.tokens)||0));contributions[id]=Math.min(stake,balance);s.tokens=balance-contributions[id]}
 b.pot={stake,contributions,total:Object.values(contributions).reduce((a,b)=>a+b,0),ranks,priority,settled:false};b.stage='pot';b.version++;
}
export function refundVsPot(room,b){
 if(!b?.pot||b.pot.settled)return;
 for(const [id,n] of Object.entries(b.pot.contributions))if(room.playerSetup?.[id])room.playerSetup[id].tokens=(Number(room.playerSetup[id].tokens)||0)+n;
 b.pot.settled=true;b.pot.refunded=true;
}
export function vsPotRewards(b){
 const p=b.pot,ids=b.participantIds,out=Object.fromEntries(ids.map(id=>[id,0])),groups=b.game?.result?.placements||[];
 if(!p||!groups.length)return out;
 const flat=groups.flat();if(flat.length!==ids.length||new Set(flat).size!==ids.length||flat.some(id=>!ids.includes(id)))throw Error('Every participant needs one placement.');
 if(groups.length===1)return {...p.contributions};
 const order=group=>[...group].sort((a,b)=>(p.ranks[b]||1)-(p.ranks[a]||1)||p.priority.indexOf(a)-p.priority.indexOf(b));
 const split=(total,group)=>{const base=Math.floor(total/group.length),extra=total%group.length;order(group).forEach((id,i)=>out[id]+=base+(i<extra?1:0))};
 const ffa=['1v1v1','1v1v1v1'].includes(b.format);
 if(!ffa){const winners=groups[0],losers=ids.filter(id=>!winners.includes(id));
  // Medium/high trio wins retain the agreed solo pity remainder. Low splits 3/3/2.
  if(['1v2','1v3'].includes(b.format)&&winners.length>1&&losers.length===1&&!(b.format==='1v3'&&p.stake===2)){
   const each=Math.floor(p.total/winners.length);winners.forEach(id=>out[id]=each);out[losers[0]]=p.total-each*winners.length;
  }else split(p.total,winners);return out;
 }
 if(groups[0].length>1){split(p.total,groups[0]);return out}
 const scale=b.format==='1v1v1'?[2,1,0]:p.stake===2?[5,2,1,0]:p.stake===4?[8,5,3,0]:[12,8,4,0];
 const sum=scale.reduce((a,b)=>a+b,0),raw=scale.map(n=>p.total*n/sum),slots=raw.map(Math.floor);
 let left=p.total-slots.reduce((a,b)=>a+b,0);const remainder=raw.map((n,i)=>({i,f:n-slots[i]})).sort((a,b)=>b.f-a.f||a.i-b.i);for(let i=0;i<left;i++)slots[remainder[i].i]++;
 let rank=0;for(const group of groups){split(slots.slice(rank,rank+group.length).reduce((a,b)=>a+b,0),group);rank+=group.length}return out;
}
