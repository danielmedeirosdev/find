/**
 * Abstração de pagamentos (gateway / tokenização).
 * Nunca armazenar PAN, CVV ou cartão bruto — só referências do provedor.
 */

export interface CreatePaymentInput {
  shopId: string
  amount: number
  currency?: string
  description: string
  customerReference?: string
  bookingId?: string
  metadata?: Record<string, string>
}

export interface PaymentResult {
  id: string
  status: 'pending' | 'paid' | 'cancelled' | 'refunded' | 'failed'
  checkoutUrl?: string
  providerReference?: string
}

export interface PaymentMethodReference {
  id: string
  customerReference: string
  providerToken: string
  brand?: string
  last4?: string
}

export interface PaymentProvider {
  isConfigured(): boolean
  createPayment(input: CreatePaymentInput): Promise<PaymentResult>
  getPayment(id: string): Promise<PaymentResult | null>
  cancelPayment(id: string): Promise<PaymentResult>
  refundPayment(id: string, amount?: number): Promise<PaymentResult>
  createCustomer(name: string, phone: string, shopId: string): Promise<string>
  savePaymentMethodReference(
    customerReference: string,
    providerToken: string
  ): Promise<PaymentMethodReference>
}

class NullPaymentProvider implements PaymentProvider {
  isConfigured() {
    return false
  }
  async createPayment(): Promise<PaymentResult> {
    throw new Error('Payment provider not configured')
  }
  async getPayment(): Promise<PaymentResult | null> {
    return null
  }
  async cancelPayment(): Promise<PaymentResult> {
    throw new Error('Payment provider not configured')
  }
  async refundPayment(): Promise<PaymentResult> {
    throw new Error('Payment provider not configured')
  }
  async createCustomer(): Promise<string> {
    throw new Error('Payment provider not configured')
  }
  async savePaymentMethodReference(): Promise<PaymentMethodReference> {
    throw new Error('Payment provider not configured')
  }
}

let provider: PaymentProvider = new NullPaymentProvider()

export const PaymentService = {
  setProvider(next: PaymentProvider) {
    provider = next
  },
  isConfigured() {
    return provider.isConfigured()
  },
  createPayment: (input: CreatePaymentInput) => provider.createPayment(input),
  getPayment: (id: string) => provider.getPayment(id),
  cancelPayment: (id: string) => provider.cancelPayment(id),
  refundPayment: (id: string, amount?: number) => provider.refundPayment(id, amount),
  createCustomer: (name: string, phone: string, shopId: string) =>
    provider.createCustomer(name, phone, shopId),
  savePaymentMethodReference: (customerReference: string, providerToken: string) =>
    provider.savePaymentMethodReference(customerReference, providerToken),
}
