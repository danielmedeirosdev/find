import { addCalendarMonths } from './asaas-billing.ts';

export type BillingPayment = {
  id: string;
  customer?: string;
  subscription?: string;
  status?: string;
  dueDate?: string;
  value?: number;
  deleted?: boolean;
};

// Only a verified payment for the current subscription cycle grants access.
// Future unpaid invoices do not invalidate a paid current month.
export function hasPaidCurrentCycle(
  payments: BillingPayment[], customer: string, subscription: string, today: string,
): boolean {
  const paid = (p: BillingPayment) => p.status === 'RECEIVED' || p.status === 'CONFIRMED';
  const relevant = payments.filter(p => !p.deleted && p.customer === customer &&
    p.subscription === subscription && /^\d{4}-\d{2}-\d{2}$/.test(p.dueDate ?? '') &&
    (p.dueDate! <= today || paid(p)));
  const latestDue = relevant.reduce((latest, p) => p.dueDate! > latest ? p.dueDate! : latest, '');
  return relevant.some(p => p.dueDate === latestDue && paid(p) &&
    typeof p.value === 'number' && p.value >= 60 &&
    addCalendarMonths(p.dueDate!, 1) > today);
}
