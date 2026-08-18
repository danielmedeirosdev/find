export function packageRemaining(total: number, used: number): number {
  return Math.max(0, total - used)
}

/** Rótulos em português para o campo `kind` das notificações (código interno em inglês). */
const NOTIFICATION_KIND_LABELS: Record<string, string> = {
  new_booking: 'Novo agendamento',
  booking_completed: 'Atendimento concluído',
  booking_cancelled: 'Agendamento cancelado',
  booking_reminder: 'Lembrete de agendamento',
  no_show: 'Não compareceu',
  referral_trial: 'Indicação em teste',
  referral_converted: 'Indicação convertida',
  referral_milestone: 'Marco de indicações',
}

export function notificationKindLabel(kind: string): string {
  const normalized = kind.trim().toLowerCase()
  if (NOTIFICATION_KIND_LABELS[normalized]) return NOTIFICATION_KIND_LABELS[normalized]

  // Aceita variantes em MAIÚSCULAS / snake (ex.: NEW_BOOKING)
  const fromSnake = NOTIFICATION_KIND_LABELS[normalized.replace(/-/g, '_')]
  if (fromSnake) return fromSnake

  return kind
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
