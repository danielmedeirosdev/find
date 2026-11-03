import { describe, expect, it } from 'vitest';
import { summarizeSubscription, type ProviderSubscription } from '../../../supabase/functions/_shared/subscription-summary';
import type { BillingPayment } from '../../../supabase/functions/_shared/payment-entitlement';
const sub:ProviderSubscription={id:'sub_test',customer:'cus_test',status:'ACTIVE',nextDueDate:'2027-01-04',cycle:'MONTHLY',value:60,billingType:'PIX'};
const paid:BillingPayment={id:'paid',customer:'cus_test',subscription:'sub_test',status:'RECEIVED',dueDate:'2026-11-04',value:60};
const summarize=(s:ProviderSubscription|null=sub,p:BillingPayment[]=[paid],gift?:string)=>summarizeSubscription(s,p,'cus_test','2026-11-03',gift);
describe('subscription dates and renewal status',()=>{
  it('calculates paid period from the paid invoice, not the provider next ungenerated bill',()=>{
    const r=summarize();expect(r.paidUntil).toBe('2026-12-04');expect(r.daysRemaining).toBe(31);
  });
  it('uses the earliest pending bill for next charge',()=>{
    const r=summarize(sub,[paid,{...paid,id:'next',status:'PENDING',dueDate:'2026-12-04'}]);expect(r.nextDueDate).toBe('2026-12-04');
  });
  it('never fabricates paid dates for manually activated or trial accounts',()=>{
    expect(summarize(null,[]).paidUntil).toBeNull();expect(summarize(sub,[]).paidUntil).toBeNull();
  });
  it('requires card confirmation before showing automatic renewal',()=>{
    expect(summarize({...sub,billingType:'CREDIT_CARD'}).automaticRenewal).toBe(false);
    const r=summarize({...sub,billingType:'CREDIT_CARD',creditCard:{creditCardNumber:'************1234',creditCardBrand:'VISA'}});
    expect(r.automaticRenewal).toBe(true);expect(r.cardLast4).toBe('1234');
  });
  it('shows manual Pix despite a previously saved card',()=>{
    expect(summarize({...sub,creditCard:{creditCardNumber:'1234'}}).automaticRenewal).toBe(false);
  });
  it('rejects cancelled subscriptions and overdue invoices for card setup',()=>{
    expect(summarize({...sub,status:'INACTIVE'}).canConfigureCard).toBe(false);
    expect(summarize(sub,[paid,{...paid,id:'due',status:'OVERDUE',dueDate:'2026-11-02'}]).canConfigureCard).toBe(false);
  });
  it('does not accept other customers, refunded or underpaid invoices as paid coverage',()=>{
    for(const change of [{customer:'other'},{subscription:'other'},{status:'REFUNDED'},{value:1},{deleted:true}]) expect(summarize(sub,[{...paid,...change}]).paidUntil).toBeNull();
  });
  it('keeps genuine complimentary coverage and clamps expired days',()=>{
    expect(summarize(sub,[paid],'2027-01-04T12:00:00Z').paidUntil).toBe('2027-01-04');
    expect(summarize(sub,[{...paid,dueDate:'2026-09-04'}]).daysRemaining).toBe(0);
  });
  it('handles month-end billing without rolling into another month',()=>{
    expect(summarize(sub,[{...paid,dueDate:'2026-01-31'}]).paidUntil).toBe('2026-02-28');
  });
});
