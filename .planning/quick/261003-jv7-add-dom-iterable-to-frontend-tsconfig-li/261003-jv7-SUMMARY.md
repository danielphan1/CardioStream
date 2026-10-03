---
phase: quick-261003-jv7
plan: 01
subsystem: frontend
status: complete
tags: [typescript, tsconfig, build, vercel, deploy]
dependency-graph:
  requires:
    - phase: quick-261003-iuc
      provides: CombinedTimelineCompact.test.tsx, the first file in the repo to spread a NodeList
  provides: ["a production build that typechecks", "DOM.Iterable in tsconfig.app.json"]
  affects: [any test or source file that iterates a DOM collection]
tech-stack:
  added: []
  patterns:
    - "`npm run build` is the only command that typechecks — vitest and vite dev strip types without checking them, so a type error can pass every local gate and still break the deploy"
    - "tsconfig include: [\"src\"] means a test-only type error fails the production build"
key-files:
  created: []
  modified:
    - frontend/tsconfig.app.json
decisions:
  - "Added DOM.Iterable rather than excluding tests from tsconfig.app.json: typechecking tests is worth keeping, and DOM.Iterable is the Vite react-ts template default this config had drifted from"
  - "Did not rewrite the three spreads as Array.from(): the spreads are correct code, the lib list was wrong"
  - "No CI gate added — out of scope for this task, but the gap is real: nothing runs `npm run build` before a push, so the next type error reaches Vercel the same way"
metrics:
  duration: ~10min
  completed: 2026-10-03
---

# Quick 261003-jv7: DOM.Iterable in the frontend tsconfig lib

## What broke

Both Vercel production deploys for `8b70bee` failed at 21:08 UTC on 2026-10-03;
Railway's two services succeeded. The failure was `tsc -b`, which runs ahead of
`vite build` in `frontend/package.json`:

```
src/components/charts/CombinedTimelineCompact.test.tsx(113,7): error TS2488:
  Type 'NodeListOf<SVGRectElement>' must have a '[Symbol.iterator]()' method
  that returns an iterator.                        (same at 130,23 and 141,23)
```

`tsconfig.app.json` had `"lib": ["ES2023", "DOM"]`. `NodeList`'s
`[Symbol.iterator]` declaration lives in `DOM.Iterable`, not `DOM`. The Vite
`react-ts` template ships `DOM.Iterable` by default; this config never had it,
and nothing in the repo spread a DOM collection until `3f1006a` added the three
`[...container.querySelectorAll(...)]` calls in the new compact-timeline test.

## Fix

One line — `frontend/tsconfig.app.json:5`:

```diff
-    "lib": ["ES2023", "DOM"],
+    "lib": ["ES2023", "DOM", "DOM.Iterable"],
```

Types only. `target: es2023` already emits native spread, so the generated
bundle is unchanged.

## Verification

- `npm run build` (the exact command Vercel runs) exits 0
- `npx vitest run`: 52 files, 784 tests, all passing
- Vercel deployment status on the pushed commit: `success` on both projects

## Known gap

The reason a type error reached production is that `npm run build` is never run
before a push: `vitest` and `vite dev` both strip types without checking them,
so the local gates are blind to this entire error class. A pre-push hook or a
CI job running `npm run build` would have caught it. Not added here — flagged
for a follow-up.
