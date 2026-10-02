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
import { useView } from '../store/view'

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
  // Same reasoning for the view store (16.1-09): the readings and upload tests
  // below seed it, and every other test in this file assumes the dashboard is
  // what mounts.
  useView.setState({ view: 'dashboard' })
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

  // The tabular records left this view in 16.1-09 (UI-SPEC §5.8) — they are
  // their own rail destination now, not a block pinned under the chart. The
  // overlay-event list is the companion that STAYS (CR-02 suppression intact).
  expect(
    screen.queryByRole('heading', { level: 2, name: 'Readings' }),
  ).toBeNull()
  expect(screen.queryByRole('region', { name: 'Readings table' })).toBeNull()
  expect(screen.queryByRole('table', { name: 'Readings' })).toBeNull()
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

// The Readings destination (16.1-09, UI-SPEC §5.8). The load-bearing claim is
// not "the table renders" — it is that the table renders TOGETHER WITH the
// controls that state how it is narrowed (T-16.1-39), from the shell's single
// filter cluster rather than a second copy (T-16.1-41).
test('renders the Readings destination with the shell, Command Bar and one filter cluster', async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  useView.setState({ view: 'readings' })

  render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  )

  // jsdom measures 0px, so ReadingsTable renders its table layout, not the
  // sub-640px cards. Awaiting it also settles the stubbed queries.
  expect(
    await screen.findByRole('table', { name: 'Readings' }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('heading', { level: 2, name: 'Readings' }),
  ).toBeInTheDocument()

  // The shell's filter cluster, exactly once each.
  expect(document.querySelectorAll('#dates-trigger-button')).toHaveLength(1)
  expect(document.querySelectorAll('#filters-trigger-button')).toHaveLength(1)
  expect(screen.getByRole('region', { name: 'Command bar' })).toBeInTheDocument()

  // ONE polite region inside <main> — the state block, from the shell's
  // single filter cluster, not a per-view copy (T-16.1-41).
  //
  // Scoped to <main> deliberately, and the scope is the honest form of the
  // claim rather than a weakening of it. The never-inert top band holds
  // polite regions of its own that are nothing to do with this view's filter
  // state: the Command Bar's reply line, and AgentStatusBanner — which the
  // stubbed /health here actually renders, and which FilterStateBlock's own
  // header names as the fallback announcement channel for exactly the case
  // where <main> has gone inert. A bare document-wide count of 1 would
  // therefore assert that those two cannot exist, which is the opposite of
  // the design.
  expect(document.querySelector('main')).not.toBeNull()
  const regions = document.querySelectorAll('main [aria-live]')
  expect(regions).toHaveLength(1)
  expect(regions[0].getAttribute('aria-live')).toBe('polite')
  expect(document.querySelectorAll('[aria-live="assertive"]')).toHaveLength(0)

  // Chart-side surfaces stay on the dashboard. The view switcher is the
  // chart's own control, and the overlay-event list is the companion to the
  // plotted markers — neither belongs on a table-only surface.
  expect(screen.queryByRole('group', { name: 'Chart view' })).toBeNull()
  expect(screen.queryByRole('region', { name: 'Overlaid events' })).toBeNull()
  expect(
    screen.queryByRole('heading', {
      level: 2,
      name: 'No readings match these filters',
    }),
  ).toBeNull()
})

// The other half of the §5.8 contract: the Command Bar and the filter cluster
// are on the two DATA views only. A caregiver typing into an upload form has
// no filter state to state, and nothing for a voice command to apply.
test('the caregiver write surfaces carry no Command Bar, no filter triggers and no live region', async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  useView.setState({ view: 'upload' })

  render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  )

  // The shell itself is still here — only the two data-view clusters are not.
  expect(
    await screen.findByRole('heading', {
      level: 1,
      name: "Chris's Health Dashboard",
    }),
  ).toBeInTheDocument()

  expect(screen.queryByRole('region', { name: 'Command bar' })).toBeNull()
  expect(document.querySelector('#dates-trigger-button')).toBeNull()
  expect(document.querySelector('#filters-trigger-button')).toBeNull()
  expect(document.querySelectorAll('[aria-live]')).toHaveLength(0)
})
