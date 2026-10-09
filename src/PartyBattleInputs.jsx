import { useEffect, useRef, useState } from 'react'

// Keep editable text (including a blank field or trailing decimal) until submit.
export function readBattleNumber(text, integer = false) {
  const value = String(text).trim().replace(',', '.')
  if (!/^\d+(?:\.\d*)?$/.test(value)) return null
  const number = Number(value)
  return Number.isFinite(number) && (!integer || Number.isInteger(number)) ? number : null
}

export function NumericEntry({ label = 'Value', onSubmit, integer = false, disabled = false }) {
  const [value, setValue] = useState('')
  const parsed = readBattleNumber(value, integer)
  return <form className="bc-inline" onSubmit={event => {
    event.preventDefault()
    if (disabled || parsed === null) return
    onSubmit(parsed)
    setValue('')
  }}>
    <label>{label}<input type="text" inputMode={integer ? 'numeric' : 'decimal'}
      enterKeyHint="done" autoComplete="off" autoCorrect="off" spellCheck={false}
      value={value} disabled={disabled} onChange={event => setValue(event.target.value)} /></label>
    <button type="submit" disabled={disabled || parsed === null}>Submit</button>
  </form>
}

export function DraftCount({ label, value, onChange, disabled }) {
  const parsed = readBattleNumber(value, true)
  const count = Math.min(100, parsed ?? 0)
  const change = delta => onChange(String(Math.max(0, Math.min(100, count + delta))))
  return <div className="bc-draft-count">
    <label><span>{label}</span><input aria-label={label} type="text" inputMode="numeric"
      enterKeyHint="done" autoComplete="off" value={value} disabled={disabled}
      aria-invalid={value !== '' && (parsed === null || parsed > 100)}
      onChange={event => onChange(event.target.value)} /></label>
    <div className="bc-count-buttons">
      <button type="button" aria-label={`Subtract one ${label}`} disabled={disabled || count <= 0} onClick={() => change(-1)}>−</button>
      <button type="button" aria-label={`Add one ${label}`} disabled={disabled || count >= 100} onClick={() => change(1)}>+</button>
    </div>
  </div>
}

// Mobile keyboards can shrink the visual viewport without changing 100dvh.
export function useBattleKeyboardViewport(dialog) {
  const [style, setStyle] = useState(undefined)
  const pending = useRef(0)
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const refresh = () => {
      setStyle({ top: viewport.offsetTop, left: viewport.offsetLeft,
        width: viewport.width, height: viewport.height, bottom: 'auto', right: 'auto',
        '--bc-visible-height': `${viewport.height}px` })
      cancelAnimationFrame(pending.current)
      pending.current = requestAnimationFrame(() => {
        const focused = document.activeElement
        if (dialog.current?.contains(focused) && focused.matches('input,textarea,select')) {
          focused.scrollIntoView({ block: 'nearest', inline: 'nearest' })
        }
      })
    }
    refresh()
    viewport.addEventListener('resize', refresh)
    viewport.addEventListener('scroll', refresh)
    document.addEventListener('focusin', refresh)
    return () => {
      cancelAnimationFrame(pending.current)
      viewport.removeEventListener('resize', refresh)
      viewport.removeEventListener('scroll', refresh)
      document.removeEventListener('focusin', refresh)
    }
  }, [dialog])
  return style
}
