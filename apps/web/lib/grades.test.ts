import { describe, expect, it } from 'vitest'
import { gradeStatusFor } from './grades'

const THRESHOLDS = { redOrange: 65, orangeGreen: 85 }

describe('gradeStatusFor', () => {
  it('follows the configured percentage bands', () => {
    expect(gradeStatusFor(64, undefined, THRESHOLDS)).toBe('red')
    expect(gradeStatusFor(65, undefined, THRESHOLDS)).toBe('orange')
    expect(gradeStatusFor(84, undefined, THRESHOLDS)).toBe('orange')
    expect(gradeStatusFor(85, undefined, THRESHOLDS)).toBe('green')
    expect(gradeStatusFor(0, 5, THRESHOLDS)).toBe('red')
  })

  it('falls back to the mark itself when no current score exists', () => {
    expect(gradeStatusFor(null, 5, THRESHOLDS)).toBe('green')
    expect(gradeStatusFor(null, 4.5, THRESHOLDS)).toBe('orange')
    expect(gradeStatusFor(null, 3, THRESHOLDS)).toBe('red')
  })

  it('is null without a percentage and a mark', () => {
    expect(gradeStatusFor(null, undefined, THRESHOLDS)).toBeNull()
  })
})
