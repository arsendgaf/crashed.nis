import { describe, expect, it } from 'vitest'
import {
  entriesTotals,
  formatPercent,
  formatSum,
  parseNumberField,
  predictPercent,
  rubricTitle,
  rubricViewFor,
} from './rubrics'

describe('rubricViewFor', () => {
  it('weights СОР and СОЧ 50/50', () => {
    const view = rubricViewFor(
      {
        sumChapterCriteria: [{ mark: '8', maxMark: '10' }],
        sumQuarterCriteria: [{ mark: '10', maxMark: '10' }],
      },
      90,
    )

    expect(view.percent).toBe(90)
    expect(view.byHalfYear).toBe(false)
    expect(view.chapter).toEqual({ sum: 8, max: 10, count: 1 })
  })

  it('doubles the percentage for a half-year assessed subject', () => {
    const view = rubricViewFor(
      {
        sumChapterCriteria: [],
        sumQuarterCriteria: [{ mark: '25', maxMark: '50' }],
      },
      50,
    )

    // A lone 50% СОЧ calculates to 25%, but the journal reports it as the
    // doubled half-year mark — the doubled value is the real percentage.
    expect(view.byHalfYear).toBe(true)
    expect(view.percent).toBe(50)
  })

  it('stays quarterly when the journal score is not the doubled value', () => {
    const view = rubricViewFor(
      {
        sumChapterCriteria: [],
        sumQuarterCriteria: [{ mark: '25', maxMark: '50' }],
      },
      90,
    )

    expect(view.byHalfYear).toBe(false)
    expect(view.percent).toBe(25)
  })

  it('yields a null percentage without usable rubrics', () => {
    const view = rubricViewFor({ sumChapterCriteria: [{ mark: '5', maxMark: '0' }] }, 40)

    expect(view.percent).toBeNull()
    expect(view.chapter).toBeNull()
    expect(view.quarter).toBeNull()
  })
})

describe('rubricTitle', () => {
  it('falls back ru → kk → en → fallback', () => {
    expect(rubricTitle({ ru: 'Тест', kk: 'Сынақ', en: 'Test' }, 'Ф')).toBe('Тест')
    expect(rubricTitle({ en: 'Test' }, 'Ф')).toBe('Test')
    expect(rubricTitle(undefined, 'Рубрика 1')).toBe('Рубрика 1')
  })
})

describe('formatSum', () => {
  it('prints whole values without decimals and fractions with one', () => {
    expect(formatSum(20)).toBe('20')
    expect(formatSum(12.5)).toBe('12.5')
  })
})

describe('formatPercent', () => {
  it('drops trailing zeros from the two fixed decimals', () => {
    expect(formatPercent(66.666)).toBe('66.67')
    expect(formatPercent(85.5)).toBe('85.5')
    expect(formatPercent(85)).toBe('85')
  })
})

describe('parseNumberField', () => {
  it('accepts comma decimals and rejects empty or non-numeric input', () => {
    expect(parseNumberField('4,5')).toBe(4.5)
    expect(parseNumberField('10')).toBe(10)
    expect(parseNumberField('')).toBeNull()
    expect(parseNumberField('abc')).toBeNull()
  })
})

describe('entriesTotals', () => {
  it('sums usable entries and skips ones without a positive max', () => {
    const totals = entriesTotals([
      { mark: '3', max: '5' },
      { mark: '4', max: '0' },
      { mark: '', max: '10' },
    ])

    expect(totals).toEqual({ sum: 3, max: 15, count: 2 })
  })

  it('is null when nothing is usable', () => {
    expect(entriesTotals([{ mark: '1', max: '' }])).toBeNull()
    expect(entriesTotals([])).toBeNull()
  })
})

describe('predictPercent', () => {
  it('mirrors the rubric weighting with respect to the fixed half-year shape', () => {
    expect(
      predictPercent({ sum: 8, max: 10, count: 1 }, { sum: 20, max: 20, count: 1 }, false),
    ).toBe(90)
    expect(predictPercent({ sum: 25, max: 50, count: 1 }, null, true)).toBe(50)
    expect(predictPercent(null, null, false)).toBeNull()
  })
})
