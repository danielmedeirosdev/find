export function formatPrice(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function formatTime(timeStr: string): string {
  return timeStr.slice(0, 5)
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length <= 2) return digits
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`
}

export function subscriptionLabel(status: string): string {
  switch (status) {
    case 'trial':
      return 'Período de teste'
    case 'active':
      return 'Ativa'
    case 'blocked':
      return 'Bloqueada'
    default:
      return status
  }
}

export function getTrialDaysRemaining(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null
  const end = new Date(trialEndsAt)
  const now = new Date()
  const diffMs = end.getTime() - now.getTime()
  if (diffMs <= 0) return 0
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

export function bookingStatusLabel(status: string): string {
  switch (status) {
    case 'scheduled':
      return 'Agendado'
    case 'confirmed':
      return 'Confirmado'
    case 'in_progress':
      return 'Em andamento'
    case 'awaiting_payment':
      return 'Aguardando pagamento'
    case 'completed':
      return 'Concluído'
    case 'no_show':
      return 'Não compareceu'
    case 'cancelled':
      return 'Cancelado'
    default:
      return status
  }
}

export function paymentMethodLabel(method: string | null | undefined): string {
  switch (method) {
    case 'pix':
      return 'Pix'
    case 'cartao':
      return 'Cartão'
    case 'dinheiro':
      return 'Dinheiro'
    default:
      return '—'
  }
}

/** Ex.: "há 2 dias", "há 3 horas", "agora" */
export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diffSec = Math.round((now - then) / 1000)
  if (diffSec < 45) return 'agora'
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return diffMin === 1 ? 'há 1 minuto' : `há ${diffMin} minutos`
  const diffHour = Math.round(diffMin / 60)
  if (diffHour < 24) return diffHour === 1 ? 'há 1 hora' : `há ${diffHour} horas`
  const diffDay = Math.round(diffHour / 24)
  if (diffDay < 30) return diffDay === 1 ? 'há 1 dia' : `há ${diffDay} dias`
  const diffMonth = Math.round(diffDay / 30)
  if (diffMonth < 12) return diffMonth === 1 ? 'há 1 mês' : `há ${diffMonth} meses`
  const diffYear = Math.round(diffMonth / 12)
  return diffYear === 1 ? 'há 1 ano' : `há ${diffYear} anos`
}
