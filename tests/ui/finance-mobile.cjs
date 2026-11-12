const {chromium,expect}=require('@playwright/test');
(async()=>{
 const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const session={access_token:'isolated',refresh_token:'isolated',token_type:'bearer',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'8426b290-e41c-4074-9f40-213b8d27d0fe',role:'authenticated',aud:'authenticated',email:'qa@example.test',app_metadata:{provider:'email'},user_metadata:{}}};
 const shop={id:'80242cb3-6a9e-4a68-a0fb-2630fb760830',name:'Loja de demonstração',owner_user_id:session.user.id,segment:'pet',subscription_status:'active',pet_business_type:'grooming',onboarding_completed:true};
 const tx={id:'receipt-test',shop_id:shop.id,customer_package_id:'pkg',type:'entrada',amount:120,description:'Recebimento de pacote',customer_name:'Rose teste',pet_name:'Meg teste',service_name:'Banho quinzenal',paid_on:'2026-11-10',cash_date:'2026-11-10',created_at:'2026-11-12T14:00:00Z',payment_method:'pix',payment_status:'Pagamento parcial'};
 for(const width of [320,390,430,1440]){
 const page=await b.newPage({viewport:{width,height:844}});let corrected=false;
 await page.addInitScript(s=>localStorage.setItem('sb-stub-auth-token',JSON.stringify(s)),session);
 await page.route('https://stub.supabase.test/**',async route=>{
 const u=new URL(route.request().url());const table=u.pathname.split('/').pop();let data=[];
 if(table==='shops')data=shop;
 if(table==='financial_receipts')data=[tx];
 if(table==='correct_payment_date'){const input=route.request().postDataJSON();if(input.p_transaction_id!=='receipt-test'||input.p_paid_on!=='2026-11-09')throw Error('wrong correction');tx.paid_on=input.p_paid_on;corrected=true;data=null;}
 await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto('http://127.0.0.1:4176/painel/dashboard?aba=cashflow');
 await expect(page.getByText('Recebimento de pacote — Meg teste (Rose teste)',{exact:true})).toBeVisible({timeout:20000});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('overflow '+width);
 await page.getByRole('button',{name:'Corrigir data / histórico'}).click();
 await page.getByLabel('Data efetiva do pagamento').fill('2026-11-09');
 await page.getByLabel('Motivo da correção').fill('Conferência do comprovante');
 await page.getByRole('button',{name:'Salvar data',exact:true}).click();
 await expect(page.getByText(/Pago em 09\/11\/2026/)).toBeVisible();if(!corrected)throw Error('not saved');
 await page.screenshot({path:'/tmp/finance-mobile-'+width+'.png',fullPage:true});
 console.log('PASS isolated receipt identity, date correction, reload and no overflow at '+width);await page.close();
 }
 await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
