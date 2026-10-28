import type { ComponentProps } from 'react'

type LogoProps = Omit<ComponentProps<'svg'>, 'viewBox'> & {
  label?: string
}

function Logo({ label = 'Crashed NIS', ...props }: LogoProps) {
  return (
    <svg
      aria-label={label}
      fill="none"
      role="img"
      viewBox="0 0 256 256"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M128 40v176M48 80l160 96M48 176l160-96"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="16"
      />
    </svg>
  )
}

export { Logo }
