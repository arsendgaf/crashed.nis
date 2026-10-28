import { cn } from '@crashednis/ui/lib/utils'
import {
  markText,
  parseNumericMark,
  type MarkField,
  type Thresholds,
  type TranscriptRow,
} from '@/lib/transcript'
import { gradeStatusFor, GRADE_TEXT } from '@/lib/grades'

// One stacked marks group: its own header row plus value row, welded into the
// shared table right below the previous chunk.
type MarkChunk = readonly MarkField[]

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))

// Chunks with different column counts share one base grid, so each chunk still
// fills the full width: the common multiple of their column counts.
const gridColumnCount = (chunks: readonly MarkChunk[]): number =>
  chunks.reduce((count, chunk) => (count * chunk.length) / gcd(count, chunk.length), 1)

/**
 * Marks table where the groups stay separate — the finals keep their own
 * 2-column header row, the quarters their 4-column one — but merge into a
 * single table that runs flush to its container's edges: full width, square,
 * no own frame — the container's border and rounding carry the outer edge and
 * clip the table's corners. Used by the phone transcript cards (finals +
 * quarters) and the subject modal (quarters + half-years + totals) alike.
 */
export function MarksMiniTable({
  chunks,
  labelKind,
  row,
  thresholds,
  caption,
  emphasize,
}: {
  chunks: readonly MarkChunk[]
  /** `short` for compact numerals («I»), `full` for self-describing ones («Четверть I»). */
  labelKind: 'short' | 'full'
  row: TranscriptRow
  thresholds: Thresholds
  caption: string
  emphasize: 'resultMark' | undefined
}) {
  const columns = gridColumnCount(chunks)

  // Header and value rows of every chunk in order, so the class-level rules
  // can drop the bottom rule only on the table's very last row.
  const entries = chunks.flatMap((chunk) => {
    const span = columns / chunk.length

    return [
      { kind: 'head' as const, chunk, span },
      { kind: 'value' as const, chunk, span },
    ]
  })

  return (
    <table className="w-full table-fixed border-collapse text-center">
      <caption className="sr-only">{caption}</caption>
      <tbody>
        {entries.map((entry, index) => {
          const rowRule = index === entries.length - 1 ? 'border-b-0' : 'border-b border-border'

          if (entry.kind === 'head') {
            return (
              <tr key={`head-${index}`} className={rowRule}>
                {entry.chunk.map((field) => (
                  <th
                    scope="col"
                    key={field.key}
                    colSpan={entry.span > 1 ? entry.span : undefined}
                    className="border-r border-border px-2 py-1.5 text-xs font-normal text-muted-foreground last:border-r-0"
                  >
                    {labelKind === 'short' ? field.label : field.fullLabel}
                  </th>
                ))}
              </tr>
            )
          }

          return (
            <tr key={`value-${index}`} className={rowRule}>
              {entry.chunk.map((field) => {
                const text = markText(row[field.key])
                const numeric = parseNumericMark(text)
                const status = numeric === null ? null : gradeStatusFor(null, numeric, thresholds)

                return (
                  <td
                    key={field.key}
                    colSpan={entry.span > 1 ? entry.span : undefined}
                    className={cn(
                      'border-r border-border px-2 py-2 align-middle tabular-nums last:border-r-0',
                      emphasize === field.key && 'font-medium',
                      status !== null && GRADE_TEXT[status],
                    )}
                  >
                    {text === '' ? <span className="text-muted-foreground">—</span> : text}
                  </td>
                )
              })}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
