import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { PredictCalculator } from './predict-calculator'
import { usePredictStore } from '@/lib/stores/predict-store'

// 8/10 СОР + 10/10 СОЧ weight to 0.5×80% + 0.5×100% = 90%.
const rubricData = {
  sumChapterCriteria: [{ title: { ru: 'Тест' }, mark: '8', maxMark: '10' }],
  sumQuarterCriteria: [{ title: { ru: 'СОЧ' }, mark: '10', maxMark: '10' }],
}

const renderCalculator = (
  data: typeof rubricData = rubricData,
  props: Partial<Parameters<typeof PredictCalculator>[0]> = {},
) =>
  render(
    <MemoryRouter>
      <PredictCalculator
        quarter="2"
        subjectId="algebra"
        journalPercent={90}
        data={data}
        error={undefined}
        mutate={() => {}}
        {...props}
      />
    </MemoryRouter>,
  )

beforeEach(() => {
  usePredictStore.setState({ last: null })
})

describe('PredictCalculator', () => {
  it('prefills editable rows from the received rubrics and computes the score', () => {
    renderCalculator()

    const chapter = screen.getByRole('region', { name: 'СОР' })
    expect(within(chapter).getByText('Тест')).toBeInTheDocument()
    expect(within(chapter).getByText('8/10 — 40%')).toBeInTheDocument()
    expect(
      within(screen.getByRole('region', { name: 'СОЧ' })).getByText('10/10 — 50%'),
    ).toBeInTheDocument()
    expect(screen.getByText('90%')).toBeInTheDocument()
  })

  it('remembers the selection on mount before any edit', () => {
    renderCalculator()

    const last = usePredictStore.getState().last
    expect(last?.subjectId).toBe('algebra')
    expect(last?.quarter).toBe('2')
    expect(last?.chapterEntries).toHaveLength(1)
  })

  it('recalculates live and updates the remembered sandbox while typing', async () => {
    const user = userEvent.setup()
    renderCalculator()

    const markInput = screen.getByLabelText('Тест: балл')
    await user.clear(markInput)
    await user.type(markInput, '4')

    // 4/10 is 40% — 0.5×40% + 0.5×100% = 70%.
    expect(screen.getByText('70%')).toBeInTheDocument()
    expect(usePredictStore.getState().last?.chapterEntries[0]?.mark).toBe('4')
  })

  it('adds and removes a custom rubric row', async () => {
    const user = userEvent.setup()
    renderCalculator()

    await user.click(within(screen.getByRole('region', { name: 'СОР' })).getByRole('button'))
    expect(screen.getByLabelText('Балл')).toBeInTheDocument()

    await user.click(screen.getByLabelText('Удалить рубрику'))
    expect(screen.queryByLabelText('Балл')).not.toBeInTheDocument()
  })

  it('resets both sections back to the rubric prefill', async () => {
    const user = userEvent.setup()
    renderCalculator()

    await user.clear(screen.getByLabelText('Тест: балл'))
    await user.click(screen.getByRole('button', { name: 'Сбросить' }))

    expect(screen.getByLabelText('Тест: балл')).toHaveDisplayValue('8')
    expect(usePredictStore.getState().last?.chapterEntries[0]?.mark).toBe('8')
  })
})
