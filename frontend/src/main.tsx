import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// Self-hosted font — no CDN requests (SEC-03 discipline)
import '@fontsource/atkinson-hyperlegible/400.css'
import '@fontsource/atkinson-hyperlegible/700.css'
import './index.css'
import App from './App.tsx'
import { useTheme } from './store/theme'
import { useSpeech } from './store/speech'

const queryClient = new QueryClient()

// Apply persisted theme before first paint (D-15)
useTheme.getState().initTheme()
// Apply persisted spoken-replies mute preference (or the safe on-by-default)
// before first paint (D-03, TTS-02)
useSpeech.getState().initSpeech()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
