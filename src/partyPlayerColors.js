const COLORS=['#f8fafc','#fbbf24','#38bdf8','#f472b6']
export function partyPlayerColor(room,id){
 const seats=Object.entries(room.seats||{}).sort((a,b)=>Number(a[0])-Number(b[0]))
 const seat=seats.findIndex(([,uid])=>uid===id)
 const ids=Object.values(room.players||{}).sort((a,b)=>(a.joinedAt||0)-(b.joinedAt||0)||a.id.localeCompare(b.id)).map(p=>p.id)
 return COLORS[(seat>=0?seat:Math.max(0,ids.indexOf(id)))%COLORS.length]
}
