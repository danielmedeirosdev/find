import { useEffect, useRef, useState, type ReactNode } from 'react'

export function Toast({
  message,
  onClose,
}: {
  message: string | null
  onClose: () => void
}) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onClose, 2800)
    return () => clearTimeout(t)
  }, [message, onClose])

  if (!message) return null

  return (
    <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 animate-[fadeIn_0.2s_ease-out]">
      <div className="rounded-lg border border-brass/40 bg-charcoal px-5 py-3 text-sm text-white shadow-lg">
        {message}
      </div>
    </div>
  )
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-charcoal-light">
      <div
        className="h-full rounded-full bg-brass transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg bg-charcoal-light/50 ${className}`} />
  )
}

interface DropzoneProps {
  onFiles: (files: File[]) => void
  multiple?: boolean
  disabled?: boolean
  className?: string
  children: ReactNode
}

export function ImageDropzone({
  onFiles,
  multiple,
  disabled,
  className = '',
  children,
}: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleFiles = (list: FileList | null) => {
    if (!list || disabled) return
    const files = Array.from(list).filter((f) =>
      ['image/jpeg', 'image/png', 'image/webp'].includes(f.type)
    )
    if (files.length) onFiles(files)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
      }}
      onDragEnter={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        handleFiles(e.dataTransfer.files)
      }}
      className={`cursor-pointer transition-colors ${
        dragging ? 'border-brass bg-brass/10' : ''
      } ${disabled ? 'pointer-events-none opacity-50' : ''} ${className}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = ''
        }}
      />
      {children}
    </div>
  )
}

export function DefaultAvatar({ name, className = '' }: { name: string; className?: string }) {
  const letter = (name.trim()[0] || '?').toUpperCase()
  return (
    <div
      className={`flex items-center justify-center rounded-full bg-charcoal-light font-display text-brass ${className}`}
      aria-hidden
    >
      {letter}
    </div>
  )
}
