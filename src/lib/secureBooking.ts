import { supabase } from './supabase'
import type {
  BookingWithDetails,
  CustomFieldAnswerInput,
  Pet,
  PetSize,
  ShopCustomer,
} from './types'

const RECEIPT_PHONE_PREFIX = 'find:booking-phone:'

export function rememberBookingPhone(bookingId: string, phone: string) {
  sessionStorage.setItem(`${RECEIPT_PHONE_PREFIX}${bookingId}`, phone.replace(/\D/g, ''))
}

export function readBookingPhone(bookingId: string): string {
  return sessionStorage.getItem(`${RECEIPT_PHONE_PREFIX}${bookingId}`) || ''
}

function rpcMissingMessage(action: string) {
  return `Não foi possível ${action}. Atualize a página. Se o problema continuar, fale com o suporte.`
}

export async function lookupPetCustomer(
  shopId: string,
  phone: string
): Promise<{ customer: ShopCustomer | null; pets: Pet[] }> {
  const { data, error } = await supabase.rpc('lookup_pet_customer', {
    p_shop_id: shopId,
    p_phone: phone,
  })
  if (error) throw new Error(error.message || rpcMissingMessage('localizar o cliente'))
  const result = data as { customer?: ShopCustomer | null; pets?: Pet[] } | null
  return {
    customer: result?.customer || null,
    pets: result?.pets || [],
  }
}

export async function upsertPetCustomer(
  shopId: string,
  phone: string,
  name: string
): Promise<ShopCustomer> {
  const { data, error } = await supabase.rpc('upsert_pet_customer', {
    p_shop_id: shopId,
    p_phone: phone,
    p_name: name,
  })
  if (error) throw new Error(error.message || rpcMissingMessage('salvar o cliente'))
  return data as ShopCustomer
}

export async function createPetForCustomer(input: {
  shopId: string
  phone: string
  name: string
  size: PetSize
  breed?: string
}): Promise<Pet> {
  const { data, error } = await supabase.rpc('create_pet_for_customer', {
    p_shop_id: input.shopId,
    p_phone: input.phone,
    p_name: input.name,
    p_size: input.size,
    p_breed: input.breed?.trim() || null,
  })
  if (error) throw new Error(error.message || rpcMissingMessage('cadastrar o pet'))
  return data as Pet
}

export async function createPublicBooking(input: {
  shopId: string
  barberId: string
  clientName: string
  clientPhone: string
  date: string
  time: string
  petId?: string | null
  shopCustomerId?: string | null
  durationMinutes?: number | null
  notes?: string | null
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_public_booking', {
    p_shop_id: input.shopId,
    p_barber_id: input.barberId,
    p_client_name: input.clientName,
    p_client_phone: input.clientPhone,
    p_date: input.date,
    p_time: input.time,
    p_pet_id: input.petId || null,
    p_shop_customer_id: input.shopCustomerId || null,
    p_duration_minutes: input.durationMinutes || null,
    p_notes: input.notes?.trim() || null,
  })
  if (error) throw error
  return data as string
}

export async function finalizePublicBooking(input: {
  bookingId: string
  phone: string
  serviceIds: string[]
  petIds?: string[]
  customAnswers?: CustomFieldAnswerInput[]
  petTransport?: boolean
  transportAddress?: string
  transportNotes?: string
}) {
  const { error } = await supabase.rpc('finalize_public_booking', {
    p_booking_id: input.bookingId,
    p_phone: input.phone,
    p_service_ids: input.serviceIds,
    p_pet_ids: input.petIds || [],
    p_custom_answers: input.customAnswers || [],
    p_pet_transport: Boolean(input.petTransport),
    p_transport_address: input.transportAddress?.trim() || null,
    p_transport_notes: input.transportNotes?.trim() || null,
  })
  if (error) throw error
}

export async function getBookingReceipt(
  bookingId: string,
  phone: string
): Promise<BookingWithDetails | null> {
  const { data, error } = await supabase.rpc('get_booking_receipt', {
    p_booking_id: bookingId,
    p_phone: phone,
  })
  if (error) throw new Error(error.message || rpcMissingMessage('carregar a confirmação'))
  return (data as BookingWithDetails | null) || null
}

export async function getGuestReviewEligibility(bookingId: string): Promise<{
  eligible: boolean
  shop_name: string
  pet_name: string | null
} | null> {
  const { data, error } = await supabase.rpc('get_guest_review_eligibility', {
    p_booking_id: bookingId,
  })
  if (error) throw new Error(error.message || rpcMissingMessage('verificar a avaliação'))
  return (data as {
    eligible: boolean
    shop_name: string
    pet_name: string | null
  } | null) || null
}
