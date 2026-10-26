import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import assert from 'node:assert/strict'
const env=fs.readFileSync('.env.local','utf8');
const key=env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];
const url=env.match(/VITE_SUPABASE_URL=(.*)/)[1];
const account=JSON.parse(fs.readFileSync(process.env.ONEFIND_QA_ACCOUNT || '/tmp/onefind-qa-account.json','utf8'));
const api=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,init)=>fetch(url,{...init,signal:AbortSignal.timeout(20000)})}});
function ok(r){if(r.error)throw new Error(r.error.message);return r.data}
console.log('Authenticating QA account');
ok(await api.auth.signInWithPassword({email:account.email,password:account.password}));
console.log('Authenticated');
const owner=ok(await api.auth.getUser()).user;
let shop=ok(await api.from('shops').select('*').eq('owner_user_id',owner.id).maybeSingle());
if(!shop)shop=ok(await api.from('shops').insert({owner_user_id:owner.id,name:'QA Onefind — fictício',segment:'pet',onboarding_completed:true,pet_business_type:'grooming',address:'Rua de Teste, 123',phone:'19999990000'}).select().single());
assert.equal(shop.owner_user_id,owner.id);
console.log('QA shop ready');
let fixture={shopId:shop.id};
const customer=ok(await api.from('shop_customers').insert({shop_id:shop.id,name:'Tutor QA',phone:`1999${String(Date.now()).slice(-7)}`.slice(0,11)}).select().single());
const pet=ok(await api.from('pets').insert({shop_id:shop.id,customer_id:customer.id,name:'Luna QA',size:'medio',species:'cao'}).select().single());
const services=ok(await api.from('services').insert([{shop_id:shop.id,name:'Banho QA',price:59.90,duration_minutes:30},{shop_id:shop.id,name:'Hidratação QA',price:20.10,duration_minutes:15},{shop_id:shop.id,name:'Unhas QA',price:10,duration_minutes:15}]).select());
const staff=ok(await api.from('barbers').insert({shop_id:shop.id,name:'Profissional QA'}).select().single());
const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);const date=tomorrow.toISOString().slice(0,10);
console.log('Customer, pet and catalogue ready');
const bookingId=ok(await api.rpc('create_operational_booking',{p_shop_id:shop.id,p_barber_id:staff.id,p_customer_id:customer.id,p_pet_id:pet.id,p_date:date,p_time:'10:00',p_service_ids:services.slice(0,2).map(s=>s.id)}));
const getBooking=async()=>ok(await api.from('bookings').select('*,booking_services(*)').eq('id',bookingId).single());
assert.equal(Number((await getBooking()).quoted_amount),80);
ok(await api.rpc('edit_operational_booking',{p_booking_id:bookingId,p_service_ids:services.map(s=>s.id),p_date:date,p_time:'11:00',p_notes:'QA editado'}));
assert.equal(Number((await getBooking()).quoted_amount),90);assert.equal((await getBooking()).duration_minutes,60);
ok(await api.rpc('update_booking_status',{p_booking_id:bookingId,p_status:'confirmed'}));
ok(await api.rpc('update_booking_status',{p_booking_id:bookingId,p_status:'in_progress'}));
assert.equal((await getBooking()).status,'in_progress');
assert.ok((await api.rpc('complete_booking',{p_booking_id:bookingId,p_service_ids:services.map(s=>s.id),p_payment_method:'pix',p_amount:-1})).error);
ok(await api.rpc('complete_booking',{p_booking_id:bookingId,p_service_ids:services.map(s=>s.id),p_payment_method:'pix',p_amount:90}));
ok(await api.rpc('complete_booking',{p_booking_id:bookingId,p_service_ids:services.map(s=>s.id),p_payment_method:'pix',p_amount:90}));
const ledger=ok(await api.from('financial_transactions').select('*').eq('booking_id',bookingId));assert.equal(ledger.length,1);assert.equal(Number(ledger[0].amount),90);
const template=ok(await api.from('service_packages').insert({shop_id:shop.id,name:'QA 4 banhos',total_sessions:4,price:200,validity_days:90,active:true}).select().single());
const pkg=ok(await api.from('customer_packages').insert({shop_id:shop.id,package_id:template.id,customer_id:customer.id,pet_id:pet.id,total_sessions:4,used_sessions:0,status:'active'}).select().single());
ok(await api.rpc('consume_package_session',{p_customer_package_id:pkg.id,p_booking_id:bookingId,p_note:'QA'}));
ok(await api.rpc('consume_package_session',{p_customer_package_id:pkg.id,p_booking_id:bookingId,p_note:'QA retry'}));
const consumed=ok(await api.from('customer_packages').select('*').eq('id',pkg.id).single());assert.equal(consumed.used_sessions,1);
ok(await api.from('customer_packages').update({total_sessions:6}).eq('id',pkg.id));
assert.equal(ok(await api.from('customer_packages').select('*').eq('id',pkg.id).single()).total_sessions,6);
// A second operational booking is reserved for browser interactions.
const interactiveId=ok(await api.rpc('create_operational_booking',{p_shop_id:shop.id,p_barber_id:staff.id,p_customer_id:customer.id,p_pet_id:pet.id,p_date:new Date().toISOString().slice(0,10),p_time:'16:00',p_service_ids:services.slice(0,2).map(s=>s.id)}));
fixture={...fixture,customerId:customer.id,petId:pet.id,staffId:staff.id,serviceIds:services.map(s=>s.id),bookingId,interactiveId,packageId:pkg.id};
fs.writeFileSync('/tmp/onefind-qa-fixture.json',JSON.stringify(fixture));
ok(await api.auth.signOut());ok(await api.auth.signInWithPassword({email:account.email,password:account.password}));
assert.equal(ok(await api.from('bookings').select('status').eq('id',bookingId).single()).status,'completed');
console.log('PASS: authenticated setup, customer, pet, services, professional, booking, edit, add service, start, finish, payment, duplicate retry, package usage/edit, persistence after relogin');
