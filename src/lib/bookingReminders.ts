import { customerLabel, formatTime, whatsappUrl } from './format'
import type { BookingWithDetails } from './types'

export const CONFIRMATION_REMINDER_OPTIONS = [
  { minutes: 30, label: '30 min antes' },
  { minutes: 60, label: '1 hora antes' },
  { minutes: 120, label: '2 horas antes' },
  { minutes: 1440, label: '24 horas antes' },
] as const

export function confirmationWhatsappUrl(booking: BookingWithDetails, shopName: string): string | null {
  const base = whatsappUrl(booking.client_phone)
  if (!base) return null
  const name = customerLabel({ name: booking.shop_customers?.name ?? booking.client_name, phone: booking.client_phone })
  const greeting = name === 'Nome não informado' ? 'Oi!' : `Oi, ${name}!`
  const pets = booking.booking_pets?.map(item => item.pets?.name).filter(Boolean).join(' e ') || booking.pets?.name
  const services = [...new Set(booking.booking_services?.map(item => item.services.name) || [])].join(' + ')
  const date = booking.date.split('-').reverse().join('/')
  const message = `${greeting} Passando para confirmar ${pets ? `o atendimento de ${pets}` : 'seu atendimento'} na ${shopName}, dia ${date} às ${formatTime(booking.time)}.${services ? `\nServiços: ${services}.` : ''}\nEstá tudo certo para você? Pode confirmar por aqui?`
  return `${base}?text=${encodeURIComponent(message)}`
}
