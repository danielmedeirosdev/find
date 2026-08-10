/**
 * Abstração WhatsApp Business / API.
 * Sem provedor configurado, métodos no-opam e registram intenção.
 * Trocar o adapter sem reescrever o domínio.
 */

export type WhatsAppMessageKind =
  | 'booking_confirmation'
  | 'booking_reminder'
  | 'booking_cancelled'
  | 'booking_updated'
  | 'review_request'
  | 'custom'

export interface WhatsAppSendInput {
  toPhone: string
  kind: WhatsAppMessageKind
  body: string
  shopId: string
  bookingId?: string
  metadata?: Record<string, string>
}

export interface WhatsAppSendResult {
  ok: boolean
  providerMessageId?: string
  skipped?: boolean
  reason?: string
}

export interface WhatsAppProvider {
  isConfigured(): boolean
  send(input: WhatsAppSendInput): Promise<WhatsAppSendResult>
}

class NullWhatsAppProvider implements WhatsAppProvider {
  isConfigured() {
    return false
  }
  async send(_input: WhatsAppSendInput): Promise<WhatsAppSendResult> {
    return {
      ok: false,
      skipped: true,
      reason: 'WhatsApp provider not configured',
    }
  }
}

let provider: WhatsAppProvider = new NullWhatsAppProvider()

export const WhatsAppService = {
  setProvider(next: WhatsAppProvider) {
    provider = next
  },
  isConfigured() {
    return provider.isConfigured()
  },
  async send(input: WhatsAppSendInput): Promise<WhatsAppSendResult> {
    return provider.send(input)
  },
}
