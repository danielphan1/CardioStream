import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// Self-hosted fonts — no CDN requests (SEC-03 discipline). One family, two
// weights: Atkinson Hyperlegible at 400 (body) and 700 (labels, headings,
// display). Atkinson Hyperlegible is restored here because it is the face
// DESIGN.md documents, and because it is the only one that satisfies the
// Two-Weight Rule without a synthesized weight: the package ships static
// files for 400 and 700 only, so any other weight request would make the
// browser fake-bold the face, which DESIGN.md calls a regression.
import '@fontsource/atkinson-hyperlegible/400.css'
import '@fontsource/atkinson-hyperlegible/700.css'
import './index.css'
import App from './App.tsx'
import { useTheme } from './store/theme'
import { useSpeech } from './store/speech'
import { useFilters } from './store/filters'

const queryClient = new QueryClient()

// Apply persisted theme before first paint (D-15)
useTheme.getState().initTheme()
// Apply persisted spoken-replies mute preference (or the safe on-by-default)
// before first paint (D-03, TTS-02)
useSpeech.getState().initSpeech()
// Restore the persisted filter/overlay session before first paint (impeccable
// P1, 2026-08-27 re-critique) — survives a Safari/iOS involuntary reload
useFilters.getState().initFilters()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
