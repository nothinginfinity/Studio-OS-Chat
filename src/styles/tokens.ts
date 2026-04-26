/**
 * Design Tokens — Studio-OS-Chat
 * Single source of truth for all colors, spacing, radii, fonts, and shadows.
 * No component file should contain hardcoded hex strings or raw numeric spacing.
 */

export const tokens = {
  color: {
    surface: {
      default:  '#FFFFFF',
      elevated: '#F7F7F8',
      overlay:  '#F3F4F6',
      border:   '#E5E7EB',
    },
    text: {
      primary:   '#111827',
      secondary: '#6B7280',
      muted:     '#9CA3AF',
      inverse:   '#FFFFFF',
    },
    accent: {
      primary: '#6366F1',
      hover:   '#4F46E5',
      subtle:  'rgba(99,102,241,0.08)',
    },
    status: {
      success: '#22C55E',
      warning: '#F59E0B',
      error:   '#EF4444',
      info:    '#3B82F6',
    },
    backdrop: 'rgba(0,0,0,0.45)',
  },
  dark: {
    surface: {
      default:  '#1C1C1E',
      elevated: '#2C2C2E',
      overlay:  '#3A3A3C',
      border:   '#48484A',
    },
    text: {
      primary:   '#F2F2F7',
      secondary: '#AEAEB2',
      muted:     '#636366',
      inverse:   '#1C1C1E',
    },
    accent: {
      primary: '#818CF8',
      hover:   '#A5B4FC',
      subtle:  'rgba(129,140,248,0.12)',
    },
    status: {
      success: '#34D399',
      warning: '#FBBF24',
      error:   '#F87171',
      info:    '#60A5FA',
    },
    backdrop: 'rgba(0,0,0,0.65)',
  },
  space: {
    xs:  4,
    sm:  8,
    md:  16,
    lg:  24,
    xl:  40,
    xxl: 64,
  },
  radius: {
    sm:   6,
    md:   12,
    lg:   20,
    full: 9999,
  },
  font: {
    xs:  11,
    sm:  13,
    md:  15,
    lg:  18,
    xl:  22,
    xxl: 28,
  },
  shadow: {
    card:  '0 1px 4px rgba(0,0,0,0.08)',
    modal: '0 8px 32px rgba(0,0,0,0.16)',
    focus: '0 0 0 3px rgba(99,102,241,0.35)',
  },
  duration: {
    fast:   150,
    normal: 200,
    slow:   300,
  },
} as const

export type Tokens = typeof tokens
