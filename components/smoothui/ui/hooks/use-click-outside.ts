'use client'

import { useEffect } from 'react'

export function useClickOutside<T extends HTMLElement>(
  ref: React.RefObject<T>,
  onClickOutside: () => void
) {
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) onClickOutside()
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [ref, onClickOutside])
}

export default useClickOutside


