import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  loading?: boolean
  children: ReactNode
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-gray-900 text-white hover:bg-gray-800 hover:shadow-md active:bg-gray-950 disabled:bg-gray-400',
  secondary:
    'border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 hover:border-gray-400 hover:shadow-sm active:bg-gray-100 disabled:bg-gray-100 disabled:text-gray-400',
  ghost:
    'bg-transparent text-gray-700 hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200 disabled:text-gray-400',
  danger:
    'bg-red-600 text-white hover:bg-red-700 hover:shadow-md active:bg-red-800 disabled:bg-red-300',
}

const sizeStyles: Record<ButtonSize, string> = {
  // min-h-11 (44px) 满足移动端可点击区域建议
  sm: 'min-h-11 px-3 text-sm',
  md: 'min-h-11 px-4 text-sm sm:text-base',
  lg: 'min-h-12 px-6 text-base',
}

function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ')
}

function Spinner() {
  return (
    <svg
      className="size-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    loading = false,
    disabled,
    className,
    children,
    type = 'button',
    ...props
  },
  ref,
) {
  const isDisabled = disabled || loading

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium cursor-pointer',
        'transition-all duration-200 ease-out',
        'touch-manipulation select-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-none disabled:active:scale-100',
        'active:scale-[0.98] active:shadow-none',
        variantStyles[variant],
        sizeStyles[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
})

export default Button
