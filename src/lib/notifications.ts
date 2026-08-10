import { supabase } from './supabase'
import { WhatsAppService } from './whatsapp'
import type { WhatsAppMessageKind } from './whatsapp'

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

/** Tenta WhatsApp oficial; se não configurado, apenas registra intenção (sem fingir sucesso). */
export async function notifyCustomerWhatsApp(input: {
  toPhone: string
  kind: WhatsAppMessageKind
  body: string
  shopId: string
  bookingId?: string
}) {
  const digits = input.toPhone.replace(/\D/g, '')
  if (digits.length < 10) {
    return { ok: false as const, skipped: true, reason: 'invalid_phone' }
  }
  return WhatsAppService.send({
    toPhone: digits,
    kind: input.kind,
    body: input.body,
    shopId: input.shopId,
    bookingId: input.bookingId,
  })
}

export function packageRemaining(total: number, used: number): number {
  return Math.max(0, total - used)
}
