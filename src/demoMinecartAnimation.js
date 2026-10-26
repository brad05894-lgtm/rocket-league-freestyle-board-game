import {demoPoint} from './partyBoards'
const clamp=x=>Math.max(0,Math.min(1,x)),mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*clamp(t))
// Full rail centerlines from Blender v11. Always travel south -> west, east -> north.
export function stationPaths(id){
 if(id==='d49'){
  const incoming=[[-8.8,.14,11.7],[-8.8,.14,11.6]];
  for(let i=1;i<=40;i++){const a=i*Math.PI/80;incoming.push([-10.4+1.6*Math.cos(a),.14,11.6-1.6*Math.sin(a)])}
  incoming.push([-12.5,.14,10]);return {incoming,outgoing:[[-12.5,.14,10],[-17.4,.14,10]]};
 }
 const incoming=[[16.6,3.83,-15.5],[12,3.83,-15.5]],outgoing=[[12,3.83,-15.5],[9.6,3.83,-15.5]];
 for(let i=39;i>=0;i--){const a=Math.PI+i*Math.PI/80;outgoing.push([9.6+1.6*Math.cos(a),3.83,-17.1-1.6*Math.sin(a)])}
 outgoing.push([8,3.83,-17.2]);return {incoming,outgoing};
}
export const stationRail=id=>stationPaths(id).outgoing;
function along(points,t){const lens=points.slice(1).map((p,i)=>Math.hypot(...p.map((v,j)=>v-points[i][j])));let d=clamp(t)*lens.reduce((a,b)=>a+b,0);for(let i=0;i<lens.length;i++){if(d<=lens[i])return mix(points[i],points[i+1],lens[i]?d/lens[i]:0);d-=lens[i]}return points.at(-1)}
function heading(points,t){const a=along(points,Math.max(0,t-.01)),b=along(points,Math.min(1,t+.01));return Math.atan2(b[0]-a[0],b[2]-a[2])}
export function stationWalkPoint(id,t){
 const a=demoPoint(id),b=stationRail(id)[0],p=mix(a,b,t);
 if(id==='d49'){const u=clamp(t)*8,k=Math.min(8,Math.floor(u));p[1]=a[1]+(b[1]-a[1])*k/8+.06+Math.sin((u-k)*Math.PI)*.08}
 else p[1]+=.06;
 return p;
}
export function minecartFrame(c,now){
 const elapsed=Math.max(0,now-c.startedAt),pickup=Number(c.pickupMs)||0,from=stationPaths(c.from),to=stationPaths(c.to),stop=from.outgoing[0],end=to.incoming.at(-1);
 if(elapsed<pickup){const leaving=elapsed<3000,rail=leaving?stationPaths(c.cartFrom).outgoing:from.incoming,t=leaving?clamp(elapsed/2300):clamp((elapsed-3500)/2500);return {player:demoPoint(c.from),cart:along(rail,t),yaw:heading(rail,t),riding:false,waiting:true,walking:false,age:elapsed}}
 const age=elapsed-pickup;let player,cart,rail=from.outgoing,t=0,riding=false,walking=false;
 if(age<2400){player=stationWalkPoint(c.from,age/2400);cart=stop;walking=true}
 else if(age<3100){t=(age-2400)/700;cart=stop;player=mix(stationWalkPoint(c.from,1),[stop[0],stop[1]+.62,stop[2]],t);player[1]+=Math.sin(t*Math.PI)*.8;t=0}
 else if(age<6500){t=clamp((age-3100)/2900);cart=along(rail,t);player=[cart[0],cart[1]+.62,cart[2]];riding=true}
 else if(age<9500){rail=to.incoming;t=clamp((age-6500)/3000);cart=along(rail,t);player=[cart[0],cart[1]+.62,cart[2]];riding=true}
 else if(age<10200){rail=to.incoming;t=1;cart=end;const u=(age-9500)/700;player=mix([end[0],end[1]+.62,end[2]],stationWalkPoint(c.to,1),u);player[1]+=Math.sin(u*Math.PI)*.8}
 else {rail=to.incoming;t=1;cart=end;player=stationWalkPoint(c.to,1-clamp((age-10200)/2400));walking=true}
 return {player,cart,yaw:heading(rail,t),riding,walking,waiting:false,age};
}
export function minecartFade(c,now){const e=now-c.startedAt,p=c.pickupMs||0;if(e<p)return Math.max(0,Math.min(1,(e-2300)/500,(4000-e)/500));const age=e-p;return Math.max(0,Math.min(1,(age-5600)/500,(7100-age)/500))}
