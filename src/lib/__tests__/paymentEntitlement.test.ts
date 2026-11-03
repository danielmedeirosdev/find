import { describe, expect, it } from 'vitest';
import { hasPaidCurrentCycle, type BillingPayment } from '../../../supabase/functions/_shared/payment-entitlement';
const payment: BillingPayment = { id: 'pay_test', customer: 'cus_test', subscription: 'sub_test', status: 'RECEIVED', value: 60, dueDate: '2026-11-04' };
const check = (payments: BillingPayment[]) => hasPaidCurrentCycle(payments, 'cus_test', 'sub_test', '2026-11-03');
describe('subscription payment recovery', () => {
  it('accepts Pix received and confirmed card payments for the current cycle', () => {
    expect(check([payment])).toBe(true);
    expect(check([{...payment, status:'CONFIRMED'}])).toBe(true);
  });
  it('rejects unpaid, refunded, deleted and underpaid charges', () => {
    for (const status of ['PENDING','OVERDUE','REFUNDED','CHARGEBACK_REQUESTED']) expect(check([{...payment,status}])).toBe(false);
    expect(check([{...payment, deleted:true}])).toBe(false);
    expect(check([{...payment, value:59}])).toBe(false);
  });
  it('requires the exact customer and subscription', () => {
    expect(check([{...payment, customer:'other'}])).toBe(false);
    expect(check([{...payment, subscription:'other'}])).toBe(false);
  });
  it('does not unlock using an old monthly payment', () => {
    expect(check([{...payment,dueDate:'2026-10-03'}])).toBe(false);
    expect(check([{...payment,dueDate:'2026-10-04'}])).toBe(true);
  });
  it('does not ignore a more recent overdue installment', () => {
    expect(check([{...payment,dueDate:'2026-10-10'}, {...payment,id:'new',dueDate:'2026-11-01',status:'OVERDUE'}])).toBe(false);
  });
  it('ignores next month unpaid invoices', () => {
    expect(check([payment,{...payment,id:'next',status:'PENDING',dueDate:'2026-12-04'}])).toBe(true);
  });
  it('rejects empty and malformed provider data', () => {
    expect(check([])).toBe(false);
    expect(check([{...payment,dueDate:undefined}])).toBe(false);
    expect(check([{...payment,value:undefined}])).toBe(false);
  });
});
