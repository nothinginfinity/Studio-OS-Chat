/**
 * FileViewerModal — Phase 4 enhanced:
 *   • Loading skeleton while IndexedDocument is fetched (B-4)
 *   • Open/close animation: slide-up + fade (C-1)
 *   • Tab switch crossfade (C-2)
 *   • Uses design tokens throughout (A-1)
 *   • Respects prefers-reduced-motion
 */
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { tokens } from '../styles/tokens'
import { useTheme } from '../hooks/useTheme'
import { Skeleton } from './Skeleton'

// ─── Types ───────────────────────────────────────────────────────────────────

export type TabId = 'table' | 'charts'

export interface IndexedDocument {
  id: string
  name: string
  sourceType: 'csv' | 'image' | 'json' | 'markdown' | 'pdf' | 'unknown'
  content?: unknown
  [key: string]: unknown
}

interface FileViewerModalProps {
  /** Pass null / undefined to keep modal closed */
  docId: string | null
  /** Async loader — modal shows skeleton until this resolves */
  loadDocument: (id: string) => Promise<IndexedDocument>
  onClose: () => void
  /** Called when user clicks "open in chat" */
  onOpenInChat?: (doc: IndexedDocument) => void
  /** Called when user clicks re-index */
  onReIndex?: (id: string) => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

const ANIMATION_ENTER_MS = tokens.duration.normal  // 200
const ANIMATION_EXIT_MS  = tokens.duration.fast    // 150
const CROSSFADE_MS       = tokens.duration.fast    // 150

// ─── Component ───────────────────────────────────────────────────────────────

export function FileViewerModal({
  docId,
  loadDocument,
  onClose,
  onOpenInChat,
  onReIndex,
}: FileViewerModalProps) {
  const { theme, colors } = useTheme()
  const isDark = theme === 'dark'

  // ── Document loading state ──
  const [doc,     setDoc]     = useState<IndexedDocument | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  // ── Animation state ──
  const [visible,  setVisible]  = useState(false)
  const [entering, setEntering] = useState(false)
  const [exiting,  setExiting]  = useState(false)
  const [open,     setOpen]     = useState(false)

  // ── Tab state ──
  const [activeTab,   setActiveTab]   = useState<TabId>('table')
  const [crossfading, setCrossfading] = useState(false)
  const crossfadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load document when docId changes ──
  useEffect(() => {
    if (!docId) return
    let cancelled = false
    setDoc(null)
    setError(null)
    setLoading(true)
    setOpen(true)
    requestAnimationFrame(() => {
      setVisible(true)
      if (!prefersReducedMotion()) {
        setEntering(true)
        setTimeout(() => { if (!cancelled) setEntering(false) }, ANIMATION_ENTER_MS)
      }
    })
    loadDocument(docId)
      .then(d  => { if (!cancelled) { setDoc(d); setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(String(e?.message ?? e)); setLoading(false) } })
    return () => { cancelled = true }
  }, [docId, loadDocument])

  // ── Close handler — play exit animation first ──
  const handleClose = useCallback(() => {
    if (prefersReducedMotion()) {
      setVisible(false)
      setOpen(false)
      onClose()
      return
    }
    setExiting(true)
    setTimeout(() => {
      setExiting(false)
      setVisible(false)
      setOpen(false)
      setDoc(null)
      setError(null)
      onClose()
    }, ANIMATION_EXIT_MS)
  }, [onClose])

  // ── Tab switch with crossfade ──
  const handleTabSwitch = useCallback((tab: TabId) => {
    if (tab === activeTab) return
    if (prefersReducedMotion()) { setActiveTab(tab); return }
    setCrossfading(true)
    if (crossfadeTimer.current) clearTimeout(crossfadeTimer.current)
    crossfadeTimer.current = setTimeout(() => {
      setActiveTab(tab)
      setCrossfading(false)
    }, CROSSFADE_MS)
  }, [activeTab])

  // ── Keyboard escape ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleClose])

  if (!open) return null

  const surf  = colors.surface
  const txt   = colors.text
  const acc   = colors.accent

  const backdropStyle: React.CSSProperties = {
    position:        'fixed',
    inset:           0,
    background:      isDark ? tokens.dark.backdrop : tokens.color.backdrop,
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          1000,
    opacity:         visible ? 1 : 0,
    transition:      prefersReducedMotion() ? 'none' : `opacity ${ANIMATION_ENTER_MS}ms ease`,
    padding:         `${tokens.space.lg}px`,
  }

  const panelStyle: React.CSSProperties = {
    background:    surf.default,
    borderRadius:  `${tokens.radius.lg}px`,
    boxShadow:     tokens.shadow.modal,
    width:         '90vw',
    maxWidth:      880,
    maxHeight:     '85vh',
    display:       'flex',
    flexDirection: 'column',
    overflow:      'hidden',
    transform:     entering ? 'translateY(24px)' : exiting ? 'translateY(16px)' : 'translateY(0)',
    opacity:       exiting ? 0 : 1,
    transition:    prefersReducedMotion()
      ? 'none'
      : entering
        ? `transform ${ANIMATION_ENTER_MS}ms ease-out, opacity ${ANIMATION_ENTER_MS}ms ease-out`
        : `transform ${ANIMATION_EXIT_MS}ms ease-in, opacity ${ANIMATION_EXIT_MS}ms ease-in`,
  }

  const SkeletonContent = (
    <div style={{ padding: `${tokens.space.md}px`, display: 'flex', flexDirection: 'column', gap: `${tokens.space.sm}px` }}>
      <div style={{ display: 'flex', gap: `${tokens.space.sm}px`, marginBottom: `${tokens.space.sm}px` }}>
        <Skeleton width={80}  height={32} borderRadius={tokens.radius.sm} />
        <Skeleton width={80}  height={32} borderRadius={tokens.radius.sm} />
        <Skeleton width={120} height={32} borderRadius={tokens.radius.sm} />
      </div>
      <div style={{ display: 'flex', gap: `${tokens.space.sm}px`, marginBottom: `${tokens.space.md}px` }}>
        <Skeleton width={80} height={36} borderRadius={tokens.radius.sm} />
        <Skeleton width={80} height={36} borderRadius={tokens.radius.sm} />
      </div>
      <Skeleton height={240} borderRadius={tokens.radius.md} />
      <Skeleton height={20}  width="60%" />
      <Skeleton height={20}  width="80%" />
      <Skeleton height={20}  width="50%" />
    </div>
  )

  return (
    <div
      data-testid="file-viewer-modal"
      role="dialog"
      aria-modal="true"
      aria-label={doc ? doc.name : 'Loading file…'}
      style={backdropStyle}
      onClick={e => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div style={panelStyle}>
        {/* ── Header / toolbar ── */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        `${tokens.space.sm}px ${tokens.space.md}px`,
          borderBottom:   `1px solid ${surf.border}`,
          background:     surf.elevated,
          flexShrink:     0,
        }}>
          <span style={{ fontSize: `${tokens.font.md}px`, fontWeight: 600, color: txt.primary }}>
            {loading ? <Skeleton width={180} height={18} /> : (doc?.name ?? 'File Viewer')}
          </span>
          <div style={{ display: 'flex', gap: `${tokens.space.xs}px`, alignItems: 'center' }}>
            {doc && onOpenInChat && (
              <button
                onClick={() => onOpenInChat(doc)}
                style={toolbarBtn(acc.primary, txt.inverse)}
              >
                Open in chat
              </button>
            )}
            {doc && onReIndex && (
              <button
                onClick={() => onReIndex(doc.id)}
                style={toolbarBtn(surf.overlay, txt.secondary)}
              >
                Re-index
              </button>
            )}
            <button
              data-testid="modal-close-button"
              onClick={handleClose}
              aria-label="Close"
              style={{ ...toolbarBtn(surf.overlay, txt.secondary), fontWeight: 700, fontSize: `${tokens.font.lg}px`, lineHeight: 1 }}
            >
              ×
            </button>
          </div>
        </div>

        {/* ── Tab bar ── */}
        {!loading && doc && (
          <div
            role="tablist"
            style={{
              display:      'flex',
              gap:          `${tokens.space.xs}px`,
              padding:      `${tokens.space.xs}px ${tokens.space.md}px`,
              background:   surf.elevated,
              borderBottom: `1px solid ${surf.border}`,
              flexShrink:   0,
            }}
          >
            {(['table', 'charts'] as TabId[]).map(tab => (
              <button
                key={tab}
                role="tab"
                data-value={tab}
                aria-selected={activeTab === tab}
                onClick={() => handleTabSwitch(tab)}
                style={{
                  padding:      `${tokens.space.xs}px ${tokens.space.sm}px`,
                  borderRadius: `${tokens.radius.sm}px`,
                  border:       'none',
                  cursor:       'pointer',
                  fontSize:     `${tokens.font.sm}px`,
                  fontWeight:   activeTab === tab ? 600 : 400,
                  background:   activeTab === tab ? acc.primary : 'transparent',
                  color:        activeTab === tab ? txt.inverse  : txt.secondary,
                  transition:   `background ${CROSSFADE_MS}ms ease, color ${CROSSFADE_MS}ms ease`,
                }}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        )}

        {/* ── Body ── */}
        <div
          style={{
            flex:          1,
            overflow:      'auto',
            height:        480,
            opacity:       crossfading ? 0 : 1,
            transition:    prefersReducedMotion() ? 'none' : `opacity ${CROSSFADE_MS}ms ease`,
          }}
        >
          {loading && SkeletonContent}
          {!loading && error && (
            <div style={{ padding: `${tokens.space.lg}px`, color: colors.status.error, fontSize: `${tokens.font.sm}px` }}>
              <strong>Couldn't load this file</strong>
              <pre style={{ marginTop: `${tokens.space.xs}px`, whiteSpace: 'pre-wrap', fontSize: `${tokens.font.xs}px`, color: txt.secondary }}>
                {error}
              </pre>
              {onReIndex && doc && (
                <button onClick={() => onReIndex(doc.id)} style={toolbarBtn(colors.status.error, txt.inverse)}>
                  Try re-indexing
                </button>
              )}
            </div>
          )}
          {!loading && !error && doc && (
            <div style={{ padding: `${tokens.space.md}px` }}>
              <p style={{ color: txt.secondary, fontSize: `${tokens.font.sm}px` }}>
                [{activeTab} content for {doc.name}]
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function toolbarBtn(bg: string, color: string): React.CSSProperties {
  return {
    background:   bg,
    color,
    border:       'none',
    borderRadius: `${tokens.radius.sm}px`,
    padding:      `${tokens.space.xs}px ${tokens.space.sm}px`,
    fontSize:     `${tokens.font.sm}px`,
    cursor:       'pointer',
    fontWeight:   500,
  }
}
