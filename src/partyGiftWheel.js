export function tokenGiftWheel(seed,finalStretch=false){
 const unit=Math.max(0,Math.min(.999999999,Number.isFinite(seed)?seed:0)),angle=.001+unit*323.998;
 const distance=Math.min(angle,324-angle),tier=Math.min(5,Math.floor(distance/27));
 return {amount:(finalStretch?15:10)+5-tier,wheelAngle:angle};
}
