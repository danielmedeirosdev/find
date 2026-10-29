import { useState } from 'react'
import { CONFIRMATION_REMINDER_OPTIONS, confirmationWhatsappUrl } from '../lib/bookingReminders'
import { supabase } from '../lib/supabase'
import { userFacingError } from '../lib/userFacingError'
import type { BookingWithDetails } from '../lib/types'

export function BookingConfirmationReminder({ booking, shopName, due = false, onUpdate }: { booking: BookingWithDetails; shopName: string; due?: boolean; onUpdate: () => void | Promise<void> }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  if ((booking.status || 'scheduled') !== 'scheduled') return null
  const url = confirmationWhatsappUrl(booking, shopName)
  const save = async (value: string) => {
    setSaving(true); setError(''); setNotice('')
    const { error: saveError } = await supabase.rpc('set_booking_confirmation_reminder', { p_booking_id: booking.id, p_minutes: value ? Number(value) : null })
    if (saveError) setError(userFacingError(saveError, 'Não foi possível salvar o lembrete.'))
    else { await onUpdate(); setNotice(value ? 'Lembrete programado.' : 'Lembrete desativado.') }
    setSaving(false)
  }
  return <section className="my-3 space-y-3 rounded-xl border border-brass/25 bg-brass/5 p-3" aria-label="Confirmação e lembrete">
    {url && <a href={url} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-center rounded-xl border border-brass/40 px-3 py-2 text-center text-sm font-semibold text-brass">Confirmar pelo WhatsApp</a>}
    <label className="grid gap-2 text-sm text-white">Lembrar de confirmar<select value={booking.confirmation_reminder_minutes ?? ''} disabled={saving} onChange={event => void save(event.target.value)} className="min-h-11 w-full rounded-lg border border-charcoal-light bg-charcoal px-3 text-white"><option value="">Sem lembrete</option>{CONFIRMATION_REMINDER_OPTIONS.map(option => <option key={option.minutes} value={option.minutes}>{option.label}</option>)}</select></label>
    <p className="text-xs text-charcoal-muted">Lembrete no painel, sem envio automático.</p>
    {(due || booking.confirmation_reminder_sent_at) && <p role="status" className="text-sm font-medium text-brass">Hora de confirmar este atendimento.</p>}
    {notice && <p role="status" className="text-xs text-brass">{notice}</p>}
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
  </section>
}
