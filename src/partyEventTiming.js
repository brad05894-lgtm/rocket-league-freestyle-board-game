export const chestOpenDelay = index => index === 1 ? 0 : 700
export const chestCloseDelay = index => index === 1 ? 3100 : 2400
const clamp = n => Math.max(0, Math.min(1, n))
export function chestOpenAmount(age, index) {
  const opening = clamp((age - chestOpenDelay(index)) / 650)
  const closing = clamp((age - chestCloseDelay(index)) / 650)
  return opening * (1 - closing)
}
export function boardEventCues(effect, moveEnd = 0) {
  const start = Number(effect?.animationStartedAt) || 0
  if (!start) return []
  if (effect.id?.startsWith('gate-switch-')) return [900, 3300].map((delay, i) => ({id:`gate-${start}-${i}`,kind:'gate',at:start+delay,duration:1050}))
  if (effect.id === 'reactor-trigger-c') return [{id:`ball-${start}`,kind:'ball',at:Math.max(start,moveEnd),duration:3200}]
  const opened = Number(effect.openedAt) || 0
  if (effect.id === 'supply-crates' && opened > 1) return [
    {id:`chest-open-${opened}`,kind:'chest-open',at:opened+chestOpenDelay(effect.selectedCrateIndex),duration:650},
    {id:`chest-close-${opened}`,kind:'chest-close',at:opened+chestCloseDelay(effect.selectedCrateIndex),duration:650},
  ]
  return []
}

export function tokenSoundCues(presentation) {
 if(!presentation||presentation.holdForLuck)return []
 return (presentation.beats||[]).flatMap((beat,index)=>beat.kind==='tokens'&&beat.amount ? [{id:`tokens-${presentation.id}-${index}`,kind:beat.amount>0?'token-gain':'token-loss',at:presentation.startedAt+index*2200,duration:1800}] : [])
}
