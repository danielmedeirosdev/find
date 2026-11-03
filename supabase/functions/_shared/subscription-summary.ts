import { addCalendarMonths } from './asaas-billing.ts';
import type { BillingPayment } from './payment-entitlement.ts';
export type ProviderSubscription = {
  id: string; customer?: string; status?: string; nextDueDate?: string;
  billingType?: string; value?: number; cycle?: string;
  creditCard?: { creditCardNumber?: string; creditCardBrand?: string } | null;
};
export function summarizeSubscription(subscription: ProviderSubscription | null, payments: BillingPayment[],
  customer: string | null, today: string, complimentaryUntil?: string | null) {
  const relevant = subscription ? payments.filter(p => !p.deleted && p.customer === customer && p.subscription === subscription.id) : [];
  const paid = relevant.filter(p => ['RECEIVED','CONFIRMED'].includes(p.status ?? '') &&
    typeof p.value === 'number' && p.value >= 60 && /^\d{4}-\d{2}-\d{2}$/.test(p.dueDate ?? ''));
  const lastPaidDue = paid.map(p => p.dueDate!).sort().slice(-1)[0];
  let paidUntil = lastPaidDue ? addCalendarMonths(lastPaidDue, 1) : null;
  const complimentary = complimentaryUntil?.slice(0,10);
  if (complimentary && complimentary > today && (!paidUntil || complimentary > paidUntil)) paidUntil = complimentary;
  const unpaid = relevant.filter(p => ['PENDING','OVERDUE'].includes(p.status ?? '') && p.dueDate).sort((a,b)=>a.dueDate!.localeCompare(b.dueDate!));
  const nextDueDate = unpaid[0]?.dueDate ?? (subscription?.status === 'ACTIVE' ? subscription.nextDueDate ?? null : null);
  const cardLast4 = subscription?.creditCard?.creditCardNumber?.replace(/\D/g,'').slice(-4) || null;
  return {
    paidUntil,
    daysRemaining: paidUntil ? Math.max(0, Math.ceil((Date.parse(paidUntil+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000)) : null,
    nextDueDate, billingType: subscription?.billingType ?? null,
    automaticRenewal: subscription?.status === 'ACTIVE' && subscription.billingType === 'CREDIT_CARD' && Boolean(cardLast4),
    cardLast4, cardBrand: subscription?.creditCard?.creditCardBrand ?? null,
    canConfigureCard: subscription?.status === 'ACTIVE' && Boolean(paidUntil && paidUntil > today) &&
      subscription.cycle === 'MONTHLY' && subscription.value === 60 &&
      !unpaid.some(p=>p.dueDate!<=today),
  };
}
