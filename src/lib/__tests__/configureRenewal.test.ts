import {describe,it,expect,vi} from 'vitest';
import {configureRenewal} from '../../../supabase/functions/_shared/configure-renewal';
describe('existing subscription renewal changes',()=>{
 it('registers without capture, preserves price/dates and verifies the same subscription',async()=>{
  const card={creditCard:{number:'fixture',ccv:'fixture'},remoteIp:'127.0.0.1'};
  const subscription={id:'sub_existing',billingType:'CREDIT_CARD'};
  const request=vi.fn().mockResolvedValueOnce({}).mockResolvedValueOnce({}).mockResolvedValueOnce(subscription);
  expect(await configureRenewal('sub_existing','enable_card',card,request)).toEqual(subscription);
  expect(request.mock.calls.map(c=>c[0])).toEqual([
   {path:'/subscriptions/sub_existing/updateCreditCard',method:'POST',timeoutMs:60000,body:card},
   {path:'/subscriptions/sub_existing',method:'PUT',body:{billingType:'CREDIT_CARD',updatePendingPayments:true}},
   {path:'/subscriptions/sub_existing'},
  ]);
 });
 it('does not enable renewal after card registration fails',async()=>{
  const request=vi.fn().mockRejectedValue(new Error('declined'));
  await expect(configureRenewal('sub_existing','enable_card',{},request)).rejects.toThrow('declined');
  expect(request).toHaveBeenCalledTimes(1);
 });
 it('does not repeat registration or claim success when the switch fails',async()=>{
  const request=vi.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('timeout'));
  await expect(configureRenewal('sub_existing','enable_card',{},request)).rejects.toThrow('timeout');
  expect(request).toHaveBeenCalledTimes(2);
 });
 it('switches to manual Pix without deleting the subscription or paid payments',async()=>{
  const request=vi.fn().mockResolvedValue({id:'sub_existing',billingType:'PIX'});
  await configureRenewal('sub_existing','use_pix',undefined,request);
  expect(request.mock.calls.map(c=>c[0])).toEqual([
   {path:'/subscriptions/sub_existing',method:'PUT',body:{billingType:'PIX',updatePendingPayments:true}},
   {path:'/subscriptions/sub_existing'},
  ]);
 });
 it('rejects missing card data before any provider request',async()=>{
  const request=vi.fn();
  await expect(configureRenewal('sub_existing','enable_card',undefined,request)).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
 });
});
