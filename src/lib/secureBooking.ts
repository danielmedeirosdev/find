import { supabase } from './supabase'
import type {
  BookingWithDetails,
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

export function isMissingSecurityRpc(error: { code?: string; message?: string } | null): boolean {
  return Boolean(
    error &&
      (error.code === 'PGRST202' ||
        /could not find the function|schema cache/i.test(error.message || ''))
  )
}

export async function lookupPetCustomer(
  shopId: string,
  phone: string
): Promise<{ customer: ShopCustomer | null; pets: Pet[] }> {
  const { data, error } = await supabase.rpc('lookup_pet_customer', {
    p_shop_id: shopId,
    p_phone: phone,
  })
  if (error && isMissingSecurityRpc(error)) {
    const digits = phone.replace(/\D/g, '')
    const { data: customer } = await supabase
      .from('shop_customers')
      .select('*')
      .eq('shop_id', shopId)
      .eq('phone', digits)
      .maybeSingle()
    if (!customer) return { customer: null, pets: [] }
    const { data: pets } = await supabase
      .from('pets')
      .select('*')
      .eq('shop_id', shopId)
      .eq('customer_id', customer.id)
      .order('name')
    return { customer: customer as ShopCustomer, pets: (pets as Pet[]) || [] }
  }
  if (error) throw error
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
  if (error && isMissingSecurityRpc(error)) {
    const digits = phone.replace(/\D/g, '')
    const { data: existing } = await supabase
      .from('shop_customers')
      .select('*')
      .eq('shop_id', shopId)
      .eq('phone', digits)
      .maybeSingle()
    if (existing) return existing as ShopCustomer
    const { data: inserted, error: insertError } = await supabase
      .from('shop_customers')
      .insert({ shop_id: shopId, phone: digits, name: name.trim() })
      .select('*')
      .single()
    if (insertError) throw insertError
    return inserted as ShopCustomer
  }
  if (error) throw error
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
  if (error && isMissingSecurityRpc(error)) {
    const customer = await upsertPetCustomer(input.shopId, input.phone, 'Cliente')
    const { data: inserted, error: insertError } = await supabase
      .from('pets')
      .insert({
        shop_id: input.shopId,
        customer_id: customer.id,
        name: input.name.trim(),
        size: input.size,
        breed: input.breed?.trim() || null,
        species: 'cao',
      })
      .select('*')
      .single()
    if (insertError) throw insertError
    return inserted as Pet
  }
  if (error) throw error
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
  if (error && isMissingSecurityRpc(error)) {
    const { data: inserted, error: insertError } = await supabase
      .from('bookings')
      .insert({
        shop_id: input.shopId,
        barber_id: input.barberId,
        client_name: input.clientName.trim(),
        client_phone: input.clientPhone.replace(/\D/g, ''),
        date: input.date,
        time: input.time,
        pet_id: input.petId || null,
        shop_customer_id: input.shopCustomerId || null,
        duration_minutes: input.durationMinutes || null,
        notes: input.notes?.trim() || null,
        status: 'scheduled',
      })
      .select('id')
      .single()
    if (insertError) throw insertError
    return inserted.id as string
  }
  if (error) throw error
  return data as string
}

export async function finalizePublicBooking(input: {
  bookingId: string
  phone: string
  serviceIds: string[]
  petIds?: string[]
}) {
  const { error } = await supabase.rpc('finalize_public_booking', {
    p_booking_id: input.bookingId,
    p_phone: input.phone,
    p_service_ids: input.serviceIds,
    p_pet_ids: input.petIds || [],
  })
  if (error && isMissingSecurityRpc(error)) {
    if (input.serviceIds.length) {
      const { error: serviceError } = await supabase.from('booking_services').insert(
        input.serviceIds.map((serviceId) => ({
          booking_id: input.bookingId,
          service_id: serviceId,
        }))
      )
      if (serviceError) throw serviceError
    }
    if (input.petIds?.length) {
      const { error: petError } = await supabase.from('booking_pets').insert(
        input.petIds.map((petId) => ({
          booking_id: input.bookingId,
          pet_id: petId,
        }))
      )
      if (petError) throw petError
    }
    return
  }
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
  if (error && isMissingSecurityRpc(error)) {
    const { data: booking, error: selectError } = await supabase
      .from('bookings')
      .select(`
        *,
        shops(name, address, phone, segment),
        barbers(name),
        pets(name, size),
        booking_services(service_id, services(*))
      `)
      .eq('id', bookingId)
      .eq('client_phone', phone.replace(/\D/g, ''))
      .maybeSingle()
    if (selectError) throw selectError
    return booking as BookingWithDetails | null
  }
  if (error) throw error
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
  if (error && isMissingSecurityRpc(error)) {
    const { data: booking, error: selectError } = await supabase
      .from('bookings')
      .select('status, review_status, shops(name), pets(name)')
      .eq('id', bookingId)
      .maybeSingle()
    if (selectError) throw selectError
    if (!booking) return null
    return {
      eligible: booking.status === 'completed' && booking.review_status === 'awaiting',
      shop_name: (booking.shops as { name?: string } | null)?.name || 'FIND',
      pet_name: (booking.pets as { name?: string } | null)?.name || null,
    }
  }
  if (error) throw error
  return (data as {
    eligible: boolean
    shop_name: string
    pet_name: string | null
  } | null) || null
}
