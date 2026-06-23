'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'

type TestModeContext = {
  isActive: boolean
  toggle: () => void
}

const Ctx = createContext<TestModeContext>({ isActive: false, toggle: () => {} })

export function TestModeProvider({ children }: { children: React.ReactNode }) {
  const [isActive, setIsActive] = useState(false)

  useEffect(() => {
    try {
      setIsActive(localStorage.getItem('i2l:testMode') === '1')
    } catch {
      // localStorage not available
    }
  }, [])

  const toggle = useCallback(() => {
    setIsActive((prev) => {
      const next = !prev
      try { localStorage.setItem('i2l:testMode', next ? '1' : '0') } catch { /* ignore */ }
      return next
    })
  }, [])

  return <Ctx.Provider value={{ isActive, toggle }}>{children}</Ctx.Provider>
}

export const useTestMode = () => useContext(Ctx)
