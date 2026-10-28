import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@crashednis/ui/components/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@crashednis/ui/components/drawer'
import { useMediaQuery } from '@crashednis/ui/hooks/use-media-query'
import { MarksMiniTable } from '@/components/marks-mini-table'
import {
  MODAL_MINI_CHUNKS,
  type Thresholds,
  type TranscriptRow,
  transcriptSubjectName,
} from '@/lib/transcript'

type SubjectReportModalProps = {
  /** The transcript row to show in full; null closes the dialog. */
  row: TranscriptRow | null
  yearLabel: string
  thresholds: Thresholds
  onClose: () => void
}

/**
 * Everything NIS holds for one subject of one school year, grouped into
 * quarters, half-years, and final marks. Static data, so the body renders
 * synchronously; the dialog/drawer wiring mirrors the rubric modal.
 */
export function SubjectReportModal({
  row,
  yearLabel,
  thresholds,
  onClose,
}: SubjectReportModalProps) {
  const isDesktop = useMediaQuery('(min-width: 64rem)')
  const open = row !== null

  if (isDesktop) {
    return (
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            onClose()
          }
        }}
      >
        <DialogContent className="max-h-[90dvh] w-full overflow-y-auto gap-4 p-0 sm:max-w-md">
          <DialogHeader className="gap-y-1 px-6 pt-6">
            {row !== null && (
              <>
                <DialogTitle className="text-2xl font-extrabold leading-snug" render={<h1 />}>
                  {transcriptSubjectName(row, 0)}
                </DialogTitle>
                <DialogDescription>{yearLabel}</DialogDescription>
              </>
            )}
          </DialogHeader>
          <ReportBody row={row} thresholds={thresholds} />
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer
      showSwipeHandle
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose()
        }
      }}
    >
      <DrawerContent className="max-h-[90dvh]">
        <DrawerHeader className="mb-4">
          {row !== null && (
            <>
              <DrawerTitle className="text-2xl font-extrabold leading-snug" render={<h1 />}>
                {transcriptSubjectName(row, 0)}
              </DrawerTitle>
              <DrawerDescription>{yearLabel}</DrawerDescription>
            </>
          )}
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ReportBody row={row} thresholds={thresholds} />
        </div>
      </DrawerContent>
    </Drawer>
  )
}

export function ReportBody({
  row,
  thresholds,
}: {
  row: TranscriptRow | null
  thresholds: Thresholds
}) {
  const safeRow: TranscriptRow = row ?? {}

  return (
    <MarksMiniTable
      chunks={MODAL_MINI_CHUNKS}
      labelKind="full"
      row={safeRow}
      thresholds={thresholds}
      caption={`Все оценки: ${transcriptSubjectName(row ?? undefined, 0)}`}
      emphasize="resultMark"
    />
  )
}
