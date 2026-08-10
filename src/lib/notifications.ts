import { supabase } from './supabase'

export async function notifyShopOwner(input: {
  shopId: string
  kind: string
  title: string
  body?: string
  bookingId?: string
}) {
  const { error } = await supabase.rpc('notify_shop_owner', {
    p_shop_id: input.shopId,
    p_kind: input.kind,
    p_title: input.title,
    p_body: input.body ?? null,
    p_booking_id: input.bookingId ?? null,
  })
  if (error) {
    console.warn('[notifyShopOwner]', error.message)
  }
}

export function packageRemaining(total: number, used: number): number {
  return Math.max(0, total - used)
}
