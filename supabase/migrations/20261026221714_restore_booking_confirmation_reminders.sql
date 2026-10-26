create function public.set_booking_confirmation_reminder(p_booking_id uuid,p_minutes integer)
returns void language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype;
begin
 select * into b from public.bookings where id=p_booking_id for update;
 if b.id is null or not (public.is_shop_owner(b.shop_id) or public.is_booking_assignee(b.id)) then raise exception 'Sem permissão para configurar este lembrete.'; end if;
 if coalesce(b.status,'scheduled')<>'scheduled' then raise exception 'Este atendimento não está aguardando confirmação.'; end if;
 if p_minutes is not null and p_minutes not in (30,60,120,1440) then raise exception 'Escolha uma antecedência válida para o lembrete.'; end if;
 if b.confirmation_reminder_minutes is distinct from p_minutes then
   update public.bookings set confirmation_reminder_minutes=p_minutes,confirmation_reminder_sent_at=null where id=b.id;
 end if;
end; $$;
revoke all on function public.set_booking_confirmation_reminder(uuid,integer) from public,anon;
grant execute on function public.set_booking_confirmation_reminder(uuid,integer) to authenticated;

-- A scoped internal worker also allows isolated QA without processing real shops.
create function private.process_confirmation_reminders(p_shop_id uuid default null)
returns integer language plpgsql security definer set search_path='' as $$
declare v_count integer:=0; rec record; v_name text;
begin
 for rec in
   select b.* from public.bookings b
   where (p_shop_id is null or b.shop_id=p_shop_id)
     and coalesce(b.status,'scheduled')='scheduled'
     and b.confirmation_reminder_minutes is not null and b.confirmation_reminder_sent_at is null
     and ((b.date+b.time) at time zone 'America/Sao_Paulo')>now()
     and ((b.date+b.time) at time zone 'America/Sao_Paulo')-make_interval(mins=>b.confirmation_reminder_minutes)<=now()
   for update skip locked
 loop
   select coalesce(nullif(btrim(c.name),''),nullif(p.name,''),'Cliente sem nome informado') into v_name
     from public.bookings b left join public.shop_customers c on c.id=b.shop_customer_id left join public.pets p on p.id=b.pet_id where b.id=rec.id;
   insert into public.notifications(shop_id,audience,kind,title,body,booking_id)
   values(rec.shop_id,'owner','booking_confirmation_reminder','Hora de confirmar o atendimento',v_name||' · '||to_char(rec.date,'DD/MM')||' às '||to_char(rec.time,'HH24:MI'),rec.id);
   update public.bookings set confirmation_reminder_sent_at=now() where id=rec.id;
   v_count:=v_count+1;
 end loop;
 return v_count;
end; $$;
revoke all on function private.process_confirmation_reminders(uuid) from public,anon,authenticated,service_role;

create or replace function public.process_booking_confirmation_reminders()
returns integer language sql security definer set search_path='' as $$
 select private.process_confirmation_reminders(null);
$$;
revoke all on function public.process_booking_confirmation_reminders() from public,anon,authenticated;
grant execute on function public.process_booking_confirmation_reminders() to service_role;

create function private.reset_reminder_after_rescheduling()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.date is distinct from old.date or new.time is distinct from old.time then new.confirmation_reminder_sent_at:=null; end if;
 return new;
end; $$;
revoke all on function private.reset_reminder_after_rescheduling() from public,anon,authenticated;
create trigger bookings_reset_reminder_after_rescheduling before update of date,time on public.bookings
for each row execute function private.reset_reminder_after_rescheduling();

create function public.get_pending_confirmation_reminders(p_shop_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select coalesce(jsonb_agg(item),'[]'::jsonb) from (
   select distinct on (b.id) n.id,n.booking_id,n.body
   from public.notifications n join public.bookings b on b.id=n.booking_id
   where public.is_shop_owner(p_shop_id) and n.shop_id=p_shop_id and n.audience='owner'
     and n.kind='booking_confirmation_reminder' and n.read_at is null
     and coalesce(b.status,'scheduled')='scheduled' and b.confirmation_reminder_sent_at is not null
     and n.created_at>=b.confirmation_reminder_sent_at
     and ((b.date+b.time) at time zone 'America/Sao_Paulo')>now()
   order by b.id,n.created_at desc limit 5
 ) item;
$$;
revoke all on function public.get_pending_confirmation_reminders(uuid) from public,anon;
grant execute on function public.get_pending_confirmation_reminders(uuid) to authenticated;
