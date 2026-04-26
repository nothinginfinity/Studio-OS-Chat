# Studio-OS-Chat — Phase 4 Roadmap
## UI/UX Polish: Visual Design · Animations · Empty States · Typography · Dark Mode

> **Phase 4 goal:** Every screen built in Phases 1–3 gets a visual quality pass.
> By the end of this phase the app feels finished to a user — not just functional.
> No new features are added. Every task is a polish, refinement, or missing-state fix.

---

## Where We Are After Phase 3

All functional wiring is complete:

| Feature | Status |
|---|---|
| FilesPanel → FileViewerModal → per-type viewer | ✅ wired |
| CSV auto-charts (template engine) | ✅ wired |
| OCR mode selector (screenshot / document / code / receipt) | ✅ wired |
| LLM chartspec blocks → inline charts in MessageList | ✅ wired |
| FileViewerModal toolbar (open in chat, copy, share, re-index, remove) | ✅ wired |
| JsonTreeView, MarkdownView, OcrImageView, CsvTableView, CsvChartPanel | ✅ mounted |

What is missing: **visual quality**. Screens are functional but unpolished —
no loading states, no empty states, inconsistent spacing, no dark mode audit,
no transitions.

---

## Phase 4 Tracks

Tracks A–D are largely independent and can be built in parallel.
Track A (design tokens) should land first as it unblocks consistent
application of color and spacing in all other tracks.

---

### Track A — Design Tokens + Theme Foundation
**Prerequisite for consistent application of color and spacing across all tracks.**

#### A-1 · Audit and consolidate design tokens

**File:** `src/styles/tokens.ts` (create if absent)

Extract all hardcoded colors, font sizes, spacing values, border radii,
and shadow definitions from every component into a single tokens file.

```ts
export const tokens = {
  color: {
    surface: { default: '#FFFFFF', elevated: '#F7F7F8', ... },
    text:    { primary: '#111827', secondary: '#6B7280', muted: '#9CA3AF' },
    accent:  { primary: '#6366F1', hover: '#4F46E5' },
    status:  { success: '#22C55E', warning: '#F59E0B', error: '#EF4444' },
  },
  space: { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 },
  radius: { sm: 6, md: 12, lg: 20, full: 9999 },
  font: { xs: 11, sm: 13, md: 15, lg: 18, xl: 22, xxl: 28 },
  shadow: { card: '0 1px 4px rgba(0,0,0,0.08)', modal: '0 8px 32px rgba(0,0,0,0.16)' },
}
```

**Acceptance criteria:**
- [ ] No hardcoded hex color strings remain in any component file
- [ ] No hardcoded numeric spacing or font-size values remain outside tokens
- [ ] All existing visual output is unchanged after token substitution

---

#### A-2 · Dark mode token set + system preference detection

**File:** `src/styles/tokens.ts` + `src/hooks/useTheme.ts`

Add a `dark` variant for every `color.*` token. Implement `useTheme()` hook
that reads `prefers-color-scheme` via `window.matchMedia` and returns the
active token set. Expose a manual override stored in `localStorage`.

**Acceptance criteria:**
- [ ] App switches to dark palette automatically when OS is in dark mode
- [ ] Manual toggle persists across reloads
- [ ] All surfaces, text, borders, and icons invert correctly — no hard-to-read combinations

---

### Track B — Loading Skeletons + Empty States
**Independent. Can start immediately after A-1 lands.**

#### B-1 · Global skeleton component

**New file:** `src/components/Skeleton.tsx`

A composable shimmer-animation skeleton block. Accepts `width`, `height`,
`borderRadius` props. Used by all loading states below.

```tsx
<Skeleton width="100%" height={48} borderRadius={tokens.radius.md} />
```

**Acceptance criteria:**
- [ ] Skeleton has CSS shimmer animation (left-to-right gradient sweep)
- [ ] Respects dark mode token set
- [ ] Used in at least FilesPanel and MessageList loading states

---

#### B-2 · FilesPanel empty state

**File:** `src/components/FilesPanel.tsx`

When no files are indexed, show a centered illustration + heading +
subtext + CTA button:

- Heading: "No files yet"
- Subtext: "Drop a CSV, image, PDF, or Markdown file to get started."
- CTA: "Add a file" → opens IngestDropZone

**Acceptance criteria:**
- [ ] Empty state renders when `sources.length === 0`
- [ ] CTA button opens the ingest drop zone
- [ ] Empty state does not flash during initial load (respect loading skeleton)

---

#### B-3 · MessageList empty state

**File:** `src/components/MessageList.tsx`

When a session has no messages, show:

- Heading: "Start a conversation"
- Subtext: "Ask anything, or attach a file to analyse it."
- Optional: 2–3 suggested prompt chips

**Acceptance criteria:**
- [ ] Empty state renders when `messages.length === 0`
- [ ] Suggested prompt chips (if present) pre-fill the input on tap

---

#### B-4 · FileViewerModal loading state

**File:** `src/components/FileViewerModal.tsx`

While the `IndexedDocument` is being loaded from IndexedDB, show a
skeleton layout matching the modal structure (toolbar skeleton + body skeleton).

**Acceptance criteria:**
- [ ] Skeleton renders between modal open and document ready
- [ ] No layout shift when document loads in
- [ ] Skeleton matches approximate shape of real content

---

#### B-5 · Error states for all viewers

**File:** `src/components/ViewerErrorBoundary.tsx` (already exists from Phase 6)

Extend the error boundary UI to be visually polished:
- File-type icon (based on `sourceType`)
- Human-readable error heading: "Couldn't load this file"
- Subtext with the error reason (collapsed by default, expandable)
- "Try re-indexing" action button

**Acceptance criteria:**
- [ ] Error boundary wraps every viewer (`CsvTableView`, `OcrImageView`, `JsonTreeView`, `MarkdownView`, `CsvChartPanel`)
- [ ] Error UI is visually consistent with the rest of the app
- [ ] Re-index button triggers `reIndexFile(doc.id)` without a page reload

---

### Track C — Animations + Transitions
**Independent. Can start after A-1.**

#### C-1 · Modal open/close animation

**File:** `src/components/FileViewerModal.tsx`

Add enter/exit transitions using CSS transitions or a lightweight animation
library (prefer `framer-motion` if already in deps, else CSS only):

- Enter: slide up + fade in (200 ms ease-out)
- Exit: slide down + fade out (150 ms ease-in)
- Backdrop: fade in/out independently

**Acceptance criteria:**
- [ ] Modal animates on open and close
- [ ] Animation does not block interaction (no pointer-events during exit)
- [ ] `prefers-reduced-motion` disables the animation

---

#### C-2 · Tab switch transition in FileViewerModal

**File:** `src/components/FileViewerModal.tsx`

When the user switches between Table and Charts tabs, crossfade the
content panel (150 ms). Do not animate height — use a fixed-height
content area to avoid layout shift.

**Acceptance criteria:**
- [ ] Tab content crossfades on switch
- [ ] No height jump
- [ ] `prefers-reduced-motion` skips the crossfade

---

#### C-3 · Message bubble enter animation

**File:** `src/components/MessageList.tsx`

New messages (both user and assistant) slide up + fade in as they are
appended (120 ms ease-out). Streaming assistant tokens do not re-trigger
the animation on each token — only on first mount of the bubble.

**Acceptance criteria:**
- [ ] New message bubbles animate in
- [ ] Streaming does not cause jank or re-animation
- [ ] `prefers-reduced-motion` disables the animation

---

#### C-4 · IngestDropZone drag-over feedback

**File:** `src/components/IngestDropZone.tsx`

When a file is dragged over the drop zone:
- Border animates to accent color
- Background tints to `color.accent.primary` at 8% opacity
- Icon scales up to 1.1× (spring)

On drop: brief success flash (green border, 300 ms) then resets.

**Acceptance criteria:**
- [ ] Drag-over state is visually distinct
- [ ] Drop success flash works
- [ ] `prefers-reduced-motion` reduces to a color-only change (no scale/spring)

---

### Track D — Typography + Spacing Consistency Pass
**Independent. Alice-led audit track.**

#### D-1 · Typography audit

Audit every text-rendering component against the token scale. Fix any
instances of:
- Font sizes outside the token scale
- Line-height not set (default browser line-height is too tight for body text)
- Letter-spacing inconsistencies
- Font-weight misuse (avoid `400`/`700` only — use `500` for UI labels)

**Files affected:** All components. Create a tracking checklist in this doc.

**Acceptance criteria:**
- [ ] All font sizes use `tokens.font.*`
- [ ] Body text has `line-height: 1.6`, UI labels have `line-height: 1.3`
- [ ] No `font-weight: 400` on interactive labels

---

#### D-2 · Spacing consistency pass

Audit padding and margin values across all components. Replace all
hardcoded values with `tokens.space.*`. Pay special attention to:
- Chat bubble padding
- Modal inner padding
- FilesPanel row height and padding
- Toolbar button spacing

**Acceptance criteria:**
- [ ] All padding/margin values use `tokens.space.*`
- [ ] No component has inconsistent vertical rhythm vs. its siblings

---

#### D-3 · Icon audit + consistency

Audit all icon usages. Ensure:
- Single icon library used throughout (no mixing Heroicons + Lucide + emoji)
- All icons have `aria-hidden="true"` + adjacent visible label or `aria-label`
- Icon sizes follow a consistent scale: 16 / 20 / 24 px only

**Acceptance criteria:**
- [ ] One icon library in use
- [ ] All icons are accessible
- [ ] Icon sizes are from the approved scale

---

## Build Order

```
Track A (tokens + dark mode — do first)
  └── A-1 · Design token consolidation      [Bob]
  └── A-2 · Dark mode tokens + useTheme     [Bob]

Track B (loading + empty states — after A-1)
  └── B-1 · Skeleton component              [Bob]
  └── B-2 · FilesPanel empty state          [Alice]
  └── B-3 · MessageList empty state         [Alice]
  └── B-4 · FileViewerModal loading state   [Bob]
  └── B-5 · Error states polish             [Alice]

Track C (animations — after A-1)
  └── C-1 · Modal open/close animation      [Bob]
  └── C-2 · Tab switch crossfade            [Bob]
  └── C-3 · Message bubble enter animation  [Alice]
  └── C-4 · IngestDropZone drag feedback    [Alice]

Track D (typography + spacing — Alice-led audit)
  └── D-1 · Typography audit                [Alice]
  └── D-2 · Spacing consistency pass        [Alice]
  └── D-3 · Icon audit + consistency        [Alice]
```

---

## Acceptance Criteria — Phase 4 Complete

- [ ] No hardcoded colors, spacing, or font sizes remain in any component
- [ ] Dark mode works correctly on all screens, respects OS preference
- [ ] Every loading state has a skeleton — no blank screens or layout shifts
- [ ] Every empty state has a meaningful illustration + CTA
- [ ] Error states are polished and offer a recovery action
- [ ] Modal, tab, message, and drop zone animations are smooth and respect `prefers-reduced-motion`
- [ ] Typography and spacing are consistent across all screens
- [ ] One icon library, all icons accessible
- [ ] No regressions in any Phase 1–3 functionality

---

## What Phase 4 Is NOT

- Not new features — nothing functional is added
- Not a redesign — existing layout and information architecture is preserved
- Not performance optimization — that is Phase 5
- Not new file type support

---

## Phase 5 Preview (Not Specced Here)

Phase 5 will cover:
- Performance profiling + optimization (bundle size, render cost, IndexedDB query speed)
- Large file handling (streaming ingest, virtual scroll stress tests)
- Offline / PWA hardening
- End-to-end test suite

---

*Roadmap authored: 2026-04-26 · Alice (alice.mmcp) · Studio-OS-Chat*
