import {demoPoint} from './partyBoards'
const clamp=x=>Math.max(0,Math.min(1,x))
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*clamp(t))
// The centerlines match the v11-v13 Blender rail builder, converted to Three Y-up.
export function stationRail(id){
 if(id==='d49'){
  const p=[[-10.4,.14,10]]
  for(let i=1;i<=40;i++){const a=Math.PI/2-i*Math.PI/80;p.push([-10.4+1.6*Math.cos(a),.14,11.6-1.6*Math.sin(a)])}
  p.push([-8.8,.14,11.7]);return p
 }
 const p=[[10.4,3.83,-15.5],[9.6,3.83,-15.5]]
 for(let i=39;i>=0;i--){const a=Math.PI+i*Math.PI/80;p.push([9.6+1.6*Math.cos(a),3.83,-17.1-1.6*Math.sin(a)])}
 p.push([8,3.83,-17.2]);return p
}
function walkStation(id,a,b,t){
 const p=mix(a,b,t)
 if(id==='d49'){const steps=6,u=clamp(t)*steps,k=Math.floor(u),f=u-k;p[1]=a[1]+(b[1]-a[1])*Math.min(steps,k)/steps+Math.sin(f*Math.PI)*.10}
 return p
}
function along(points,t){
 const lengths=points.slice(1).map((p,i)=>Math.hypot(...p.map((v,j)=>v-points[i][j])))
 let d=clamp(t)*lengths.reduce((a,b)=>a+b,0)
 for(let i=0;i<lengths.length;i++){if(d<=lengths[i])return mix(points[i],points[i+1],lengths[i]?d/lengths[i]:0);d-=lengths[i]}
 return points.at(-1)
}
export function minecartFrame(c,now){
 const age=Math.max(0,now-c.startedAt),from=stationRail(c.from),to=stationRail(c.to)
 const departure=from[0],arrival=to[0],a=demoPoint(c.from),b=demoPoint(c.to)
 let player,cart,riding=false,travel=0,rail=from
 if(age<2000){player=walkStation(c.from,a,departure,age/2000);cart=departure}
 else if(age<2700){const t=(age-2000)/700;cart=departure;player=mix(departure,[departure[0],departure[1]+.55,departure[2]],t);player[1]+=Math.sin(t*Math.PI)*.75}
 else if(age<5500){travel=clamp((age-2700)/2500);cart=along(from,travel);player=[cart[0],cart[1]+.55,cart[2]];riding=true}
 else if(age<8800){rail=to;travel=1-clamp((age-6100)/2700);cart=along(to,travel);player=[cart[0],cart[1]+.55,cart[2]];riding=true}
 else if(age<9500){const t=(age-8800)/700;rail=to;cart=arrival;player=mix([arrival[0],arrival[1]+.55,arrival[2]],arrival,t);player[1]+=Math.sin(t*Math.PI)*.7}
 else {rail=to;cart=arrival;player=walkStation(c.to,arrival,b,(age-9500)/2200)}
 const tangentA=along(rail,Math.max(0,travel-.01)),tangentB=along(rail,Math.min(1,travel+.01))
 return {player,cart,riding,yaw:Math.atan2(tangentB[0]-tangentA[0],tangentB[2]-tangentA[2])+(age>=5500?Math.PI:0),age}
}
