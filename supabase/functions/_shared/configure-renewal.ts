import type { ProviderSubscription } from './subscription-summary.ts';

type Request = {path:string;method?:string;body?:unknown;timeoutMs?:number};
/** Updates the existing subscription only. Never creates a payment or changes its price/dates. */
export async function configureRenewal(
  subscriptionId:string,
  action:'enable_card'|'use_pix',
  cardRegistration:Record<string,unknown>|undefined,
  request:(options:Request)=>Promise<unknown>,
):Promise<ProviderSubscription> {
  const path=`/subscriptions/${encodeURIComponent(subscriptionId)}`;
  if(action==='enable_card') {
    if(!cardRegistration) throw new Error('Card registration required');
    // Dedicated provider endpoint registers the card without capturing a payment.
    await request({path:`${path}/updateCreditCard`,method:'POST',timeoutMs:60000,body:cardRegistration});
  }
  await request({path,method:'PUT',body:{billingType:action==='enable_card'?'CREDIT_CARD':'PIX',updatePendingPayments:true}});
  return await request({path}) as ProviderSubscription;
}
