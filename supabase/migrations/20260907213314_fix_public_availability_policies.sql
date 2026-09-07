-- As tabelas públicas abaixo já possuem privilégios SELECT e RLS. Suas
-- políticas antigas consultavam public.shops, que é privada para visitantes.
-- A projeção public_shops contém somente os dados seguros e já exclui lojas
-- bloqueadas, por isso é a fonte correta para autorizar a leitura pública.

DROP POLICY IF EXISTS "Public reads safe professional time off"
  ON public.barber_time_off;
CREATE POLICY "Public reads safe professional time off"
  ON public.barber_time_off
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.public_shops ps
      WHERE ps.id = barber_time_off.shop_id
    )
  );

DROP POLICY IF EXISTS "Public reads custom service fields"
  ON public.service_custom_fields;
CREATE POLICY "Public reads custom service fields"
  ON public.service_custom_fields
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.public_shops ps
      WHERE ps.id = service_custom_fields.shop_id
    )
  );

DROP POLICY IF EXISTS "Public reads custom field options"
  ON public.service_custom_field_options;
CREATE POLICY "Public reads custom field options"
  ON public.service_custom_field_options
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.public_shops ps
      WHERE ps.id = service_custom_field_options.shop_id
    )
  );

DROP POLICY IF EXISTS "Public reads weekday discounts"
  ON public.service_weekday_discounts;
CREATE POLICY "Public reads weekday discounts"
  ON public.service_weekday_discounts
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.public_shops ps
      WHERE ps.id = service_weekday_discounts.shop_id
    )
  );

DROP POLICY IF EXISTS "Public reads pet transport settings"
  ON public.service_pet_transport;
CREATE POLICY "Public reads pet transport settings"
  ON public.service_pet_transport
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.public_shops ps
      WHERE ps.id = service_pet_transport.shop_id
    )
  );

GRANT SELECT ON public.barber_time_off TO anon, authenticated;
GRANT SELECT ON public.service_custom_fields TO anon, authenticated;
GRANT SELECT ON public.service_custom_field_options TO anon, authenticated;
GRANT SELECT ON public.service_weekday_discounts TO anon, authenticated;
GRANT SELECT ON public.service_pet_transport TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
