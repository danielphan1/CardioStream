// Smoke test proving jsdom + RTL wiring (plan 02-02 Task 2).
// Replaced by real tests in later plans; kept as the suite floor.
import { render, screen } from '@testing-library/react'
import App from '../App'

test('renders the app with a top-level heading', () => {
  render(<App />)
  expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
})
