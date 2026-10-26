-- Read eligibility through the safe public projection, not the private shops table.
alter policy "Public reads service professionals" on public.service_barbers
using (exists(select 1 from public.public_shops s where s.id=service_barbers.shop_id));
revoke insert,update,delete,truncate,references,trigger on public.service_barbers from anon;
grant select on public.service_barbers to anon,authenticated;
