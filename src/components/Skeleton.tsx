import React from 'react'
import { tokens } from '../styles/tokens'
import { useTheme } from '../hooks/useTheme'

interface SkeletonProps {
  width?: string | number
  height?: string | number
  borderRadius?: number
  /** Override shimmer color for special contexts */
  baseColor?: string
  /** className forwarded for layout positioning */
  className?: string
  style?: React.CSSProperties
}

/**
 * Skeleton — composable shimmer-animation placeholder.
 *
 * Usage:
 *   <Skeleton width="100%" height={48} borderRadius={tokens.radius.md} />
 *
 * Respects dark mode via useTheme. Shimmer is CSS-only (no JS timing).
 */
export function Skeleton({
  width = '100%',
  height = 20,
  borderRadius = tokens.radius.sm,
  className,
  style,
}: SkeletonProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const base  = isDark ? tokens.dark.surface.elevated : tokens.color.surface.elevated
  const shine = isDark ? 'rgba(255,255,255,0.06)'     : 'rgba(255,255,255,0.65)'

  return (
    <div
      className={className}
      style={{
        width:        typeof width  === 'number' ? `${width}px`  : width,
        height:       typeof height === 'number' ? `${height}px` : height,
        borderRadius: `${borderRadius}px`,
        background:   `linear-gradient(90deg, ${base} 25%, ${shine} 50%, ${base} 75%)`,
        backgroundSize: '200% 100%',
        animation:    'skeleton-shimmer 1.4s ease-in-out infinite',
        flexShrink:   0,
        ...style,
      }}
      aria-hidden="true"
    />
  )
}

/** SkeletonRow — convenience wrapper for a horizontal row of skeletons */
export function SkeletonRow({
  heights = [20],
  gap = tokens.space.sm,
  style,
}: {
  heights?: number[]
  gap?: number
  style?: React.CSSProperties
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: `${gap}px`,
        ...style,
      }}
    >
      {heights.map((h, i) => (
        <Skeleton key={i} height={h} />
      ))}
    </div>
  )
}

/**
 * Global keyframe injected once into <head>.
 * Using a module-level flag avoids duplicate injections.
 */
if (typeof document !== 'undefined') {
  const STYLE_ID = '__skeleton_kf__'
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style')
    style.id = STYLE_ID
    // Respect prefers-reduced-motion
    style.textContent = `
      @keyframes skeleton-shimmer {
        0%   { background-position: 200% center; }
        100% { background-position: -200% center; }
      }
      @media (prefers-reduced-motion: reduce) {
        [style*="skeleton-shimmer"] { animation: none !important; }
      }
    `
    document.head.appendChild(style)
  }
}
