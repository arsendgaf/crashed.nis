import { describe, expect, it } from 'vitest'
import {
  localizedText,
  markText,
  parseNumericMark,
  TABLE_MARK_FIELDS,
  transcriptSubjectName,
} from './transcript'

describe('parseNumericMark', () => {
  it('reads digits and comma decimals, rejects anything else', () => {
    expect(parseNumericMark('5')).toBe(5)
    expect(parseNumericMark('3,5')).toBe(3.5)
    expect(parseNumericMark('Зачтено')).toBeNull()
    expect(parseNumericMark('')).toBeNull()
  })
})

describe('markText and localizedText', () => {
  it('picks ru → kk → en and trims the mark text', () => {
    expect(localizedText({ ru: 'Математика', en: 'Math' }, '—')).toBe('Математика')
    expect(localizedText(null, '—')).toBe('—')
    expect(markText({ ru: ' 5 ' })).toBe('5')
    expect(markText(null)).toBe('')
  })
})

describe('table fields', () => {
  it('keeps the fixed column set without exam and half-year columns', () => {
    expect(TABLE_MARK_FIELDS.map((field) => field.key)).toEqual([
      'firstPeriod',
      'secondPeriod',
      'thirdPeriod',
      'fourthPeriod',
      'yearMark',
      'resultMark',
    ])
  })
})

describe('transcriptSubjectName', () => {
  it('falls back to a numbered placeholder', () => {
    expect(transcriptSubjectName({ subject: { name: { kk: 'Қазақ тілі' } } }, 0)).toBe('Қазақ тілі')
    expect(transcriptSubjectName(undefined, 2)).toBe('Предмет 3')
  })
})
