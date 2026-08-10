export type SubscriptionStatus = 'trial' | 'active' | 'blocked'
export type ShopSegment = 'barbershop' | 'pet'
export type PetSize = 'pequeno' | 'medio' | 'grande'

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
  trial_ends_at: string | null
  logo_url?: string | null
  slug?: string | null
  segment?: ShopSegment
  created_at: string
}

export interface ShopPhoto {
  id: string
  shop_id: string
  url: string
  sort_order: number
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
  photo_url?: string | null
  role?: string | null
  commission_percent?: number | null
}

export type BookingStatus = 'scheduled' | 'in_progress' | 'completed' | 'no_show' | 'cancelled'
export type PaymentMethod = 'pix' | 'cartao' | 'dinheiro'

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

export type ReviewStatus = 'awaiting' | 'reviewed' | 'unavailable'

export interface Booking {
  id: string
  shop_id: string
  barber_id: string
  client_id: string | null
  client_name: string
  client_phone: string
  date: string
  time: string
  status?: BookingStatus
  payment_method?: PaymentMethod | null
  completed_at?: string | null
  review_status?: ReviewStatus | null
  pet_id?: string | null
  shop_customer_id?: string | null
  duration_minutes?: number | null
  created_at: string
}

export interface Review {
  id: string
  booking_id: string
  shop_id: string
  barber_id: string
  client_id: string
  rating: number
  comment: string | null
  created_at: string
  updated_at: string
}

export interface RatingStats {
  avg_rating: number
  review_count: number
  star_5: number
  star_4: number
  star_3: number
  star_2: number
  star_1: number
}

export interface BarberRatingStats extends RatingStats {
  barber_id: string
  shop_id: string
}

export interface ShopRatingStats extends RatingStats {
  shop_id: string
}

export interface ReviewPublic extends Review {
  barbers?: Pick<Barber, 'id' | 'name' | 'photo_url'> | null
}

export interface ShopCustomer {
  id: string
  shop_id: string
  name: string
  phone: string
  notes: string | null
  created_at: string
}

export interface Pet {
  id: string
  shop_id: string
  customer_id: string
  name: string
  photo_url: string | null
  species: string
  breed: string | null
  size: PetSize
  weight_kg: number | null
  birth_date: string | null
  sex: 'macho' | 'femea' | null
  notes: string | null
  behavior: string | null
  special_needs: string | null
  allergies: string | null
  preferences: string | null
  created_at: string
  shop_customers?: ShopCustomer
}

export interface ServiceSizeRule {
  id: string
  service_id: string
  size: PetSize
  duration_minutes: number
  price: number | null
}

export interface FinancialTransaction {
  id: string
  shop_id: string
  booking_id: string | null
  type: 'entrada' | 'saida'
  description: string
  amount: number
  payment_method: string | null
  created_at: string
}

export interface PublicBookingSlot {
  shop_id: string
  barber_id: string
  date: string
  time: string
  duration_minutes?: number
}

export interface BookingConfirmationState {
  shopName: string
  shopAddress: string | null
  shopPhone: string | null
  barberName: string
  date: string
  time: string
  clientName: string
  clientPhone: string
  services: Service[]
  petName?: string
  petSize?: string
  durationMinutes?: number
}

export interface BookingService {
  booking_id: string
  service_id: string
}

export interface BookingWithDetails extends Booking {
  barbers?: Barber
  shops?: Shop
  pets?: Pet
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

export const PET_SIZES: { value: PetSize; label: string }[] = [
  { value: 'pequeno', label: 'Pequeno' },
  { value: 'medio', label: 'Médio' },
  { value: 'grande', label: 'Grande' },
]

export const SUBSCRIPTION_PRICE = 60

export type BillingType = 'PIX' | 'CREDIT_CARD'
export type SubscribeHandler = (billingType: BillingType) => void
