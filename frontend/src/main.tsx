import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// Self-hosted fonts — no CDN requests (SEC-03 discipline). One family, two
// weights: Plus Jakarta Sans at 400 (body) and 700 (labels, headings, display),
// the face DESIGN.md documents since the 2026-10-05 client typeface swap that
// retired Atkinson Hyperlegible.
//
// THESE TWO LINES ARE WHAT ENFORCES THE TWO-WEIGHT RULE. Atkinson Hyperlegible
// shipped static files for 400 and 700 and nothing else, so the package itself
// used to guarantee the rule. Plus Jakarta Sans ships 200-800, so that
// guarantee is gone: the rule now holds precisely because only these two
// weights are imported. Importing a third — or swapping these for the variable
// face — would silently let a 500- or 600-weight utility resolve to a real file
// instead of nothing, and DESIGN.md's weight grep gate is the only other thing
// standing between that and a third weight on screen.
//
// That gate matches the literal utility class names, so this comment names
// those weights numerically on purpose: spelling them as class names here
// would trip the gate on prose, the same false positive the chart swap's
// structural gate had to be taught to ignore. Do not add a third.
import '@fontsource/plus-jakarta-sans/400.css'
import '@fontsource/plus-jakarta-sans/700.css'
import './index.css'
import App from './App.tsx'
import { useTheme } from './store/theme'
import { useSpeech } from './store/speech'
import { useFilters } from './store/filters'
import { useAssistant } from './store/assistant'

const queryClient = new QueryClient()

// Apply persisted theme before first paint (D-15)
useTheme.getState().initTheme()
// Apply persisted spoken-replies mute preference (or the safe on-by-default)
// before first paint (D-03, TTS-02)
useSpeech.getState().initSpeech()
// Restore the persisted filter/overlay session before first paint (impeccable
// P1, 2026-08-27 re-critique) — survives a Safari/iOS involuntary reload
useFilters.getState().initFilters()
// Restore the persisted assistant-popup dismissal before first paint (quick
// 261002-kem) — a popup the user closed must not flash open on the way in
useAssistant.getState().initAssistant()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
