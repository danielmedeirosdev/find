-- Disposable tenant only; caller must wrap this in BEGIN / ROLLBACK.
DO $$
DECLARE
 owner_id uuid:=gen_random_uuid(); sid uuid; cid uuid:=gen_random_uuid(); pid uuid:=gen_random_uuid();
 staff uuid:=gen_random_uuid(); tpl uuid:=gen_random_uuid(); pkg uuid:=gen_random_uuid();
 bid uuid:=gen_random_uuid(); req uuid:=gen_random_uuid(); tid uuid; rejected boolean; d date:=(now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(owner_id,'qa.dates.'||owner_id||'@example.com','{"role":"barber","segment":"pet","shop_name":"QA rollback"}');
 SELECT id INTO sid FROM public.shops WHERE owner_user_id=owner_id;
 INSERT INTO barbers(id,shop_id,name) VALUES(staff,sid,'QA');
 INSERT INTO shop_customers(id,shop_id,name,phone) VALUES(cid,sid,'Tutor teste','19999990000');
 INSERT INTO pets(id,shop_id,customer_id,name) VALUES(pid,sid,cid,'Pet teste');
 INSERT INTO service_packages(id,shop_id,name,total_sessions,price) VALUES(tpl,sid,'Pacote teste',4,200);
 PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
 PERFORM sell_customer_package(pkg,sid,tpl,cid,pid,false,null);
 PERFORM receive_package_payment_dated(pkg,200,80,'pix',req,d-5);
 PERFORM receive_package_payment_dated(pkg,200,80,'pix',req,d-5);
 SELECT id INTO tid FROM financial_transactions WHERE payment_request_id=req;
 IF (SELECT count(*) FROM financial_receipts WHERE customer_package_id=pkg)<>1 OR
    (SELECT paid_on FROM financial_transactions WHERE id=tid)<>d-5 OR
    (SELECT balance FROM package_balances(sid) WHERE package_id=pkg)<>120 THEN RAISE EXCEPTION 'FAIL partial/idempotency'; END IF;
 IF NOT EXISTS(SELECT 1 FROM financial_receipts WHERE id=tid AND customer_name='Tutor teste' AND pet_name='Pet teste' AND service_name='Pacote teste' AND payment_status='Pagamento parcial') THEN RAISE EXCEPTION 'FAIL identity'; END IF;
 PERFORM receive_package_payment_dated(pkg,200,120,'pix',gen_random_uuid(),d);
 IF (SELECT sum(amount) FROM financial_receipts WHERE customer_package_id=pkg)<>200 OR (SELECT balance FROM package_balances(sid) WHERE package_id=pkg)<>0 THEN RAISE EXCEPTION 'FAIL total'; END IF;
 PERFORM correct_payment_date(tid,d-4,'Data corrigida pelo responsável');
 IF (SELECT cash_date FROM financial_receipts WHERE id=tid)<>d-4 OR NOT EXISTS(SELECT 1 FROM payment_date_history WHERE transaction_id=tid AND previous_date=d-5 AND new_date=d-4 AND changed_by=owner_id) THEN RAISE EXCEPTION 'FAIL correction/audit'; END IF;
 rejected:=false; BEGIN PERFORM receive_package_payment_dated(pkg,200,80,'pix',req,d-3); EXCEPTION WHEN OTHERS THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'FAIL changed retry'; END IF;
 INSERT INTO bookings(id,shop_id,barber_id,client_name,client_phone,date,time,status,amount_due,shop_customer_id,pet_id,historical_entry) VALUES(bid,sid,staff,'Tutor teste','19999990000',d-10,'10:00','completed',100,cid,pid,true);
 PERFORM receive_booking_payment_dated(bid,40,'pix',gen_random_uuid(),d-2);
 PERFORM receive_booking_payment_dated(bid,60,'dinheiro',gen_random_uuid(),d);
 IF (SELECT sum(amount) FROM financial_receipts WHERE booking_id=bid)<>100 OR (SELECT count(*) FROM financial_receipts WHERE booking_id=bid AND booking_date=d-10)<>2 THEN RAISE EXCEPTION 'FAIL delayed booking'; END IF;
 INSERT INTO financial_transactions(shop_id,type,description,amount,paid_on) VALUES(sid,'entrada','Legado teste',7,null);
 IF NOT EXISTS(SELECT 1 FROM financial_receipts WHERE shop_id=sid AND paid_on IS NULL AND description='Legado teste' AND cash_date=d) THEN RAISE EXCEPTION 'FAIL legacy'; END IF;

 PERFORM sell_customer_package(gen_random_uuid(),sid,tpl,cid,pid,true,'pix');
 IF NOT EXISTS(SELECT 1 FROM financial_receipts WHERE shop_id=sid AND amount=200 AND paid_on=d AND payment_status='Quitação do pacote') THEN RAISE EXCEPTION 'FAIL same day full package'; END IF;
 EXECUTE 'SET LOCAL ROLE authenticated';
 IF NOT EXISTS(SELECT 1 FROM financial_receipts WHERE id=tid) THEN RAISE EXCEPTION 'FAIL owner visibility'; END IF;
 EXECUTE 'RESET ROLE';
 PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 IF EXISTS(SELECT 1 FROM financial_receipts WHERE id=tid) OR EXISTS(SELECT 1 FROM payment_date_history WHERE transaction_id=tid) THEN RAISE EXCEPTION 'FAIL cross-tenant visibility'; END IF;
 EXECUTE 'RESET ROLE';

 rejected:=false; BEGIN PERFORM correct_payment_date(tid,d,'Indevido'); EXCEPTION WHEN OTHERS THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'FAIL authorization'; END IF;
 PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
 rejected:=false; BEGIN PERFORM correct_payment_date(tid,d+1,'Futuro'); EXCEPTION WHEN OTHERS THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'FAIL future date'; END IF;
END $$;
