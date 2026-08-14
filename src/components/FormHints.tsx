import { useMemo, type ReactNode } from 'react'

export function FieldHint({
  children,
  tone = 'dark',
}: {
  children: ReactNode
  tone?: 'dark' | 'light'
}) {
  return (
    <p
      className={`mt-1.5 text-xs leading-relaxed ${
        tone === 'dark' ? 'text-charcoal-muted' : 'text-ink-muted'
      }`}
    >
      {children}
    </p>
  )
}

export function FieldLabel({
  children,
  htmlFor,
  tone = 'dark',
}: {
  children: ReactNode
  htmlFor?: string
  tone?: 'dark' | 'light'
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={`mb-1 block text-sm font-medium ${
        tone === 'dark' ? 'text-charcoal-muted' : 'text-ink'
      }`}
    >
      {children}
    </label>
  )
}

export type PasswordChecks = {
  minLength: boolean
  uppercase: boolean
  number: boolean
  special: boolean
}

export function getPasswordChecks(password: string): PasswordChecks {
  return {
    minLength: password.length >= 8,
    uppercase: /[A-ZÀ-Ý]/.test(password),
    number: /\d/.test(password),
    special: /[!@#$%&*]/.test(password),
  }
}

export function isPasswordStrong(password: string): boolean {
  const c = getPasswordChecks(password)
  return c.minLength && c.uppercase && c.number && c.special
}

export function PasswordRequirements({
  password,
  tone = 'dark',
}: {
  password: string
  tone?: 'dark' | 'light'
}) {
  const checks = useMemo(() => getPasswordChecks(password), [password])
  const items: { key: keyof PasswordChecks; label: string }[] = [
    { key: 'minLength', label: 'Mínimo de 8 caracteres' },
    { key: 'uppercase', label: 'Pelo menos uma letra maiúscula' },
    { key: 'number', label: 'Pelo menos um número' },
    { key: 'special', label: 'Pelo menos um caractere especial (! @ # $ % & *)' },
  ]

  const idle = tone === 'dark' ? 'text-charcoal-muted' : 'text-ink-muted'
  const done = tone === 'dark' ? 'text-green-400' : 'text-green-600'

  return (
    <ul className="mt-2 space-y-1" aria-live="polite">
      {items.map(({ key, label }) => {
        const ok = checks[key]
        return (
          <li
            key={key}
            className={`flex items-start gap-2 text-xs transition-colors ${ok ? done : idle}`}
          >
            <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center" aria-hidden>
              {ok ? (
                <span className="block h-1.5 w-1.5 rounded-sm bg-current" />
              ) : (
                <span className="block h-1.5 w-1.5 rounded-sm border border-current" />
              )}
            </span>
            <span>{label}</span>
          </li>
        )
      })}
    </ul>
  )
}
