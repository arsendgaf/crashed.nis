import { beforeEach, describe, expect, it } from 'vitest'
import { usePredictStore, type LastPrediction } from './predict-store'

const sandbox = (subjectId: string): LastPrediction => ({
  quarter: '2',
  subjectId,
  chapterEntries: [{ key: 'rubric-0', title: 'Тест', mark: '3', max: '5', custom: false }],
  quarterEntries: [],
})

beforeEach(() => {
  usePredictStore.setState({ last: null })
})

describe('usePredictStore', () => {
  it('starts empty', () => {
    expect(usePredictStore.getState().last).toBeNull()
  })

  it('keeps the single last slot overwritten by every remember', () => {
    usePredictStore.getState().remember(sandbox('subject-a'))
    usePredictStore.getState().remember(sandbox('subject-b'))

    expect(usePredictStore.getState().last?.subjectId).toBe('subject-b')
  })

  it('forgets on logout-style reset', () => {
    usePredictStore.getState().remember(sandbox('subject-a'))
    usePredictStore.getState().forget()

    expect(usePredictStore.getState().last).toBeNull()
  })
})
