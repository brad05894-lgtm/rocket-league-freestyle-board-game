import { useEffect, useRef, useState } from 'react'

export default function RouletteReel({ title, options, winner, onComplete }) {
  const [index, setIndex] = useState(0)
  const [settled, setSettled] = useState(false)
  const completeRef = useRef(onComplete)
  const optionsKey = JSON.stringify(options || [])

  useEffect(() => {
    completeRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    if (!options?.length) return undefined

    setSettled(false)
    let step = 0
    let timer
    const totalSteps = 24
    const winnerIndex = Math.max(0, options.indexOf(winner))

    const advance = () => {
      step += 1
      if (step >= totalSteps) {
        setIndex(winnerIndex)
        setSettled(true)
        return
      }

      setIndex((current) => (current + 1) % options.length)
      const progress = step / totalSteps
      timer = window.setTimeout(advance, 60 + Math.round(progress * progress * 340))
    }

    setIndex(0)
    timer = window.setTimeout(advance, 80)
    return () => window.clearTimeout(timer)
  }, [optionsKey, winner])

  return (
    <div className="selection-roulette">
      <p className="home-mode-card__eyebrow">Random Selection</p>
      <h1>{title}</h1>
      <div className="selection-roulette__window">
        <div className="selection-roulette__track">
          <div className="selection-roulette__option" key={`${index}-${options[index]}`}>
            {options[index]}
          </div>
        </div>
        <div className="selection-roulette__selector" aria-hidden="true" />
      </div>
      <p>{settled ? `Selected: ${winner}` : 'The selector is slowing down…'}</p>
      {settled && (
        <button
          type="button"
          className="selection-roulette__continue"
          onClick={() => completeRef.current?.()}
        >
          Continue
        </button>
      )}
    </div>
  )
}
