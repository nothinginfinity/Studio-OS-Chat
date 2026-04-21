# postOcrGeometry integration boundary

This folder is the single app-facing integration boundary for deterministic post-OCR processing.

## Rule

InfinityPaste should import from this folder only.

Do not import engine internals directly from random app files.

## Current status

This boundary is scaffolded first so the app can stabilize its integration surface before the real geometry engine is wired in.

## Next step

Replace the placeholder `DefaultPostOcrRunner` implementation with the real `post-ocr-geometry-engine` adapter call.

## Recommended next commits

### Engine
```
feat(score): add block confidence and ambiguity flags for inferred structures
```

### InfinityPaste
```
feat(ocr): add app-level normalized OCR result model
```

Then:
```
feat(ocr): add deterministic geometry engine runner
```
That is when the placeholder runner gets replaced with the real adapter.
