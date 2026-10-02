// Smoke test proving the assembled App renders (plans 02-02 / 02-07).
// App now wires TanStack Query hooks, so the test provides a fresh
// QueryClientProvider (retry: false) and stubs global.fetch: /readings
// returns [] and /stats/summary a minimal zero-count StatsSummary.
// No chart internals are asserted (Pitfall 2 — jsdom has no layout).
//
// jsdom implements no matchMedia, so useMediaQuery returns false, AppShell's
// isDesktop is false, and the <1024px slim-bar shell is what mounts here
// (UI-SPEC §5.2). That is what makes the Guide path below assertable in a
// unit test at all, rather than browser-only.
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import type { StatsSummary } from '../api/types'
import App from '../App'
import { useAuth } from '../store/auth'
import { useGuide } from '../store/guide'

const zeroStats: StatsSummary = {
  count: 0,
  systolic: null,
  diastolic: null,
  pulse: null,
  categories: [
    { category: 'Hypotension', count: 0, percent: 0 },
    { category: 'Normal', count: 0, percent: 0 },
    { category: 'Elevated', count: 0, percent: 0 },
    { category: 'Stage 1', count: 0, percent: 0 },
    { category: 'Stage 2', count: 0, percent: 0 },
    { category: 'Hypertensive Crisis', count: 0, percent: 0 },
  ],
  latest_reading: null,
}

beforeEach(() => {
  // App is now gated (D-01) — seed a token so the dashboard renders instead of
  // the LoginGate. The gate itself is covered in LoginGate.test.tsx.
  useAuth.setState({ token: 'test-token' })
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      const body: unknown = url.includes('/stats/summary') ? zeroStats : []
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(body),
      } as Response)
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  useAuth.setState({ token: null })
  // useGuide is a module-level store shared by every test in this file — reset
  // it so an open guide can never leak into the dashboard-heading test above
  // (or into plan 16.1-09's readings test).
  useGuide.setState({ open: false })
})

test('renders the assembled dashboard heading', async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  )

  expect(
    screen.getByRole('heading', { level: 1, name: "Chris's Health Dashboard" }),
  ).toBeInTheDocument()

  // Zero readings resolve into the guided empty state — waiting on it also
  // settles the stubbed queries before the test ends.
  expect(
    await screen.findByRole('heading', {
      level: 2,
      name: 'No readings match these filters',
    }),
  ).toBeInTheDocument()
})

// Compensating unit coverage for what used to be browser-only (UI-SPEC §5.2
// superseding note). The Guide is its own always-visible control in the slim
// top bar, so reaching it never involves the nav panel — which is what makes
// the two overlays unable to stack, and what keeps GuideOverlay's
// focus-restore target mounted at every width.
test('opens the Guide from the slim top bar and restores focus to it on close', async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  )

  // Settle the stubbed queries first, so no late cache update lands in the
  // middle of the interaction below.
  expect(
    await screen.findByRole('heading', {
      level: 2,
      name: 'No readings match these filters',
    }),
  ).toBeInTheDocument()

  // Exactly one control with the focus-restore id exists in the DOM, because
  // exactly one shell is mounted.
  const guideButton = screen.getByRole('button', { name: 'Guide' })
  expect(document.querySelectorAll('#guide-toggle-button')).toHaveLength(1)
  expect(document.querySelector('#nav-panel')).toBeNull()

  fireEvent.click(guideButton)
  expect(useGuide.getState().open).toBe(true)
  expect(
    await screen.findByRole('button', { name: 'Close' }),
  ).toBeInTheDocument()
  // The nav panel plays no part in reaching the Guide.
  expect(document.querySelector('#nav-panel')).toBeNull()

  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(useGuide.getState().open).toBe(false)
  // GuideOverlay's getElementById restore found its target: the control sits
  // in the top band, which is never made inert, so it is still focusable.
  expect(document.activeElement).toBe(guideButton)
  expect(document.querySelector('#nav-panel')).toBeNull()
})
