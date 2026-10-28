import { cn } from 'cn'
import { SpinnerIcon } from '@phosphor-icons/react'

function Spinner({ className, ...props }: Omit<React.ComponentProps<'svg'>, 'color'>) {
  return (
    <SpinnerIcon
      data-slot="spinner"
      role="status"
      aria-label="Loading"
      className={cn('size-4 animate-spin', className)}
      {...props}
    />
  )
}

export { Spinner }
