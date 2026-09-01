import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from './AppIcon'
import { ReleaseNotes } from './ReleaseNotes'
import { PRODUCT_RELEASES } from '../lib/releases'

const SEEN_RELEASE_KEY = 'onefind:last-seen-release'

interface Props {
  variant?: 'public' | 'dashboard'
  className?: string
}

export function UpdatesButton({ variant = 'public', className = '' }: Props) {
  const [open, setOpen] = useState(false)
  const [hasUnread, setHasUnread] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const latestReleaseId = PRODUCT_RELEASES[0]?.id
  const isDashboard = variant === 'dashboard'

  useEffect(() => {
    if (!latestReleaseId) return
    try {
      setHasUnread(window.localStorage.getItem(SEEN_RELEASE_KEY) !== latestReleaseId)
    } catch {
      setHasUnread(true)
    }
  }, [latestReleaseId])

  const closeUpdates = useCallback(() => {
    setOpen(false)
    window.requestAnimationFrame(() => triggerRef.current?.focus())
  }, [])

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    const handleDialogKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeUpdates()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleDialogKeys)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleDialogKeys)
    }
  }, [closeUpdates, open])

  const showUpdates = () => {
    setOpen(true)
    setHasUnread(false)
    if (latestReleaseId) {
      try {
        window.localStorage.setItem(SEEN_RELEASE_KEY, latestReleaseId)
      } catch {
        // O painel continua funcionando mesmo quando o navegador bloqueia armazenamento local.
      }
    }
  }

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        onClick={showUpdates}
        className={`${className} relative inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-[border-color,background-color,color,transform] hover:-translate-y-0.5 ${
          isDashboard
            ? 'border-charcoal-light bg-charcoal-light/40 text-charcoal-muted hover:border-brass/50 hover:text-white'
            : 'border-ink/10 bg-white/35 text-ink-muted hover:border-brass hover:text-brass'
        }`}
        aria-haspopup="dialog"
        aria-label="Abrir novidades do ONEFIND"
        title="Novidades do ONEFIND"
      >
        <AppIcon name="sparkles" size={17} />
        <span className={isDashboard ? '' : 'hidden lg:inline'}>Novidades</span>
        {hasUnread ? (
          <span className="absolute -right-1 -top-1 flex h-3 w-3" aria-label="Nova atualização disponível">
            <span className="updates-unread-pulse absolute inline-flex h-full w-full animate-ping rounded-full bg-brass opacity-60" aria-hidden="true" />
            <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-paper bg-brass" aria-hidden="true" />
          </span>
        ) : null}
      </button>

      {open
        ? createPortal(
            <div className="fixed inset-0 z-[100] flex justify-end" role="presentation">
              <button
                type="button"
                className="absolute inset-0 cursor-default bg-black/55 backdrop-blur-[2px]"
                onClick={closeUpdates}
                aria-label="Fechar novidades"
              />
              <section
                role="dialog"
                ref={dialogRef}
                aria-modal="true"
                aria-labelledby="updates-dialog-title"
                className={`updates-drawer relative z-10 flex h-full w-full max-w-2xl flex-col shadow-[-24px_0_80px_rgba(0,0,0,0.24)] ${
                  isDashboard ? 'bg-charcoal' : 'bg-paper'
                }`}
              >
                <header className={`flex items-start justify-between gap-4 border-b p-5 sm:p-6 ${
                  isDashboard ? 'border-charcoal-light' : 'border-ink/10'
                }`}>
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brass/10 text-brass">
                      <AppIcon name="megaphone" size={20} />
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brass">
                        O que há de novo
                      </p>
                      <h2 id="updates-dialog-title" className={`mt-1 text-xl font-semibold ${
                        isDashboard ? 'text-white' : 'text-ink'
                      }`}>
                        Atualizações do ONEFIND
                      </h2>
                      <p className={`mt-1 text-sm ${
                        isDashboard ? 'text-charcoal-muted' : 'text-ink-muted'
                      }`}>
                        Melhorias organizadas por data, sem sair da tela atual.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={closeUpdates}
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                      isDashboard
                        ? 'border-charcoal-light text-charcoal-muted hover:border-brass hover:text-white'
                        : 'border-ink/10 text-ink-muted hover:border-brass hover:text-ink'
                    }`}
                    aria-label="Fechar novidades"
                    autoFocus
                  >
                    <AppIcon name="x" size={20} />
                  </button>
                </header>
                <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
                  <ReleaseNotes variant={isDashboard ? 'dashboard' : 'public'} />
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
