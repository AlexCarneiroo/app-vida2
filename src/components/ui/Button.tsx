import { Loader2 } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'ghost' | 'danger'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean
  variant?: Variant
  icon?: ReactNode
  loadingLabel?: string
}

export function Button({
  loading = false,
  variant = 'primary',
  icon,
  loadingLabel,
  disabled,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const label =
    loading && loadingLabel != null ? loadingLabel : children

  return (
    <button
      type={type}
      className={`btn btn--${variant}${loading ? ' is-loading' : ''}${className ? ` ${className}` : ''}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <Loader2 size={16} className="btn__spinner" aria-hidden />
      ) : (
        icon
      )}
      {label != null && label !== false ? label : null}
    </button>
  )
}
