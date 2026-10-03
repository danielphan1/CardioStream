// Regression guard for quick 261003-iuc.
//
// rdpSizing's custom properties only take effect when they are set ON the
// react-day-picker root: the library declares all of them on `.rdp-root` in
// its own stylesheet, and a declaration on an element beats a value inherited
// from an ancestor. Spread onto a wrapper they are silently discarded and the
// calendar falls back to 42px day cells (under CLAUDE.md's >=48px floor) in
// the library's default `blue`.
//
// jsdom has no layout, so this asserts the mechanism rather than the painted
// size — which is the part that actually regressed, and the part no existing
// test could see.
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DateRangePicker } from '../components/DateRangePicker'
import { SingleDateField } from '../components/records/SingleDateField'
import { rdpSizing } from '../components/rdpSizing'

function rootOf(container: HTMLElement): HTMLElement {
  const root = container.querySelector<HTMLElement>('.rdp-root')
  if (!root) throw new Error('no .rdp-root rendered')
  return root
}

describe('rdpSizing lands on the day-picker root', () => {
  it('declares every variable it owns on .rdp-root, not an ancestor', () => {
    const { container } = render(
      <SingleDateField label="Date" value="" onChange={() => {}} />,
    )
    const root = rootOf(container)
    for (const [name, value] of Object.entries(rdpSizing)) {
      expect(root.style.getPropertyValue(name), `${name} missing from .rdp-root`).toBe(
        String(value),
      )
    }
  })

  it('keeps day cells at the 48px accessibility floor', () => {
    const { container } = render(
      <SingleDateField label="Date" value="" onChange={() => {}} />,
    )
    const root = rootOf(container)
    for (const name of [
      '--rdp-day-width',
      '--rdp-day-height',
      '--rdp-day_button-width',
      '--rdp-day_button-height',
    ]) {
      expect(root.style.getPropertyValue(name), name).toBe('48px')
    }
  })

  it('never leaves the library blue on the accent or today colour', () => {
    const { container } = render(
      <SingleDateField label="Date" value="" onChange={() => {}} />,
    )
    const root = rootOf(container)
    for (const name of ['--rdp-accent-color', '--rdp-today-color']) {
      const v = root.style.getPropertyValue(name)
      expect(v, `${name} must be a project token`).toBe('var(--color-accent)')
    }
  })

  it('applies the same treatment in the range picker', () => {
    const { container } = render(
      <DateRangePicker from="" to="" onApply={() => {}} />,
    )
    const root = rootOf(container)
    expect(root.style.getPropertyValue('--rdp-day_button-width')).toBe('48px')
    expect(root.style.getPropertyValue('--rdp-today-color')).toBe('var(--color-accent)')
  })
})
