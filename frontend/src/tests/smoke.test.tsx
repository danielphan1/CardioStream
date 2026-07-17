// Smoke test proving the assembled App renders (plans 02-02 / 02-07).
// App now wires TanStack Query hooks, so the test provides a fresh
// QueryClientProvider (retry: false) and stubs global.fetch: /readings
// returns [] and /stats/summary a minimal zero-count StatsSummary.
// No chart internals are asserted (Pitfall 2 — jsdom has no layout).
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import type { StatsSummary } from '../api/types'
import App from '../App'

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
