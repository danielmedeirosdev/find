import type { CustomFieldAnswerInput, ServiceCustomFieldOption, ServicePetTransport, ServiceWeekdayDiscount } from './types'

export function applyWeekdayDiscount(price: number, serviceId: string, date: string | null, discounts: ServiceWeekdayDiscount[]): number {
  if (!date) return price
  const day = new Date(`${date}T12:00:00`).getDay()
  const discount = discounts.find((item) => item.service_id === serviceId && item.day_of_week === day)
  return price * (1 - Number(discount?.discount_percent || 0) / 100)
}

export function customAnswersExtra(answers: CustomFieldAnswerInput[], options: ServiceCustomFieldOption[]): number {
  const selected = new Set(answers.map((answer) => answer.option_id).filter(Boolean))
  return options.reduce((sum, option) => sum + (selected.has(option.id) ? Number(option.price_delta) : 0), 0)
}

export function petTransportFee(selectedServiceIds: Set<string>, settings: ServicePetTransport[]): number {
  const selectedSettings = settings.filter((item) => item.enabled && selectedServiceIds.has(item.service_id))
  if (selectedSettings.some((item) => item.pricing_mode === 'quote')) return 0
  return selectedSettings.reduce((highest, item) => Math.max(highest, Number(item.fee || 0)), 0)
}
