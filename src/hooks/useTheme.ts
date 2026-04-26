import { useEffect, useState, useCallback } from 'react'
import { tokens } from '../styles/tokens'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'studio-os-theme-override'

function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getStoredOverride(): Theme | null {
  try {
    const val = localStorage.getItem(STORAGE_KEY)
    if (val === 'light' || val === 'dark') return val
  } catch {
    // localStorage unavailable
  }
  return null
}

/**
 * useTheme — returns active token color set + toggle.
 *
 * Priority: localStorage override > OS prefers-color-scheme.
 * The hook applies `data-theme="dark"` on <html> so pure-CSS dark-mode
 * selectors (`[data-theme="dark"]`) also work without consuming this hook.
 */
export function useTheme() {
  const [override, setOverride] = useState<Theme | null>(getStoredOverride)
  const [system, setSystem] = useState<Theme>(getSystemTheme)

  // Track OS preference changes.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setSystem(e.matches ? 'dark' : 'light')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const theme: Theme = override ?? system

  // Reflect on <html> for CSS consumers.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggle = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setOverride(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch { /* ignore */ }
  }, [theme])

  const colors = theme === 'dark' ? tokens.dark : tokens.color

  return { theme, colors, toggle } as const
}
