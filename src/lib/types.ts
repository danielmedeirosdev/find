export type SubscriptionStatus = 'trial' | 'active' | 'blocked'

export interface Shop {
  id: string
  owner_user_id: string
  name: string
  slogan: string | null
  address: string | null
  phone: string | null
  hours_text: string | null
  cpf_cnpj: string | null
  asaas_customer_id: string | null
  subscription_status: SubscriptionStatus
  created_at: string
}

export interface Service {
  id: string
  shop_id: string
  name: string
  price: number
  duration_minutes: number
}

export interface Barber {
  id: string
  shop_id: string
  name: string
}

export interface BarberSchedule {
  id: string
  barber_id: string
  day_of_week: number
  is_active: boolean
  start_time: string
  end_time: string
}

export interface Client {
  id: string
  name: string
  phone: string | null
  created_at: string
}

export interface Booking {
  id: string
  shop_id: string
  barber_id: string
  client_id: string | null
  client_name: string
  client_phone: string
  date: string
  time: string
  created_at: string
}

export interface BookingService {
  booking_id: string
  service_id: string
}

export interface BookingWithDetails extends Booking {
  barbers?: Barber
  shops?: Shop
  booking_services?: Array<{
    service_id: string
    services: Service
  }>
}

export const DAY_NAMES = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
] as const

export const SUBSCRIPTION_PRICE = 60

export type BillingType = 'PIX' | 'CREDIT_CARD'
export type SubscribeHandler = (billingType: BillingType) => void
