"use client"

import React from "react"

type Props = {
  children: string
  speed?: number
  loop?: boolean
  className?: string
}

export default function TypewriterText({ children, speed = 5, loop, className }: Props) {
  const [count, setCount] = React.useState(0)

  // Interpret small values as characters per second; larger values as ms per char
  const intervalMs = React.useMemo(() => {
    if (speed <= 10) {
      const cps = Math.max(speed, 0.1)
      return Math.max(50, Math.round(1000 / cps))
    }
    return speed
  }, [speed])

  React.useEffect(() => {
    if (!children) return
    let cancelled = false
    let idx = 0
    function tick() {
      if (cancelled) return
      setCount(idx + 1)
      idx += 1
      const done = idx >= children.length
      if (done) {
        if (loop) {
          idx = 0
          setTimeout(tick, intervalMs * 4)
        }
        return
      }
      setTimeout(tick, intervalMs)
    }
    tick()
    return () => {
      cancelled = true
    }
  }, [children, intervalMs, loop])

  return <span className={className}>{children.slice(0, Math.min(count, children.length))}</span>
}


