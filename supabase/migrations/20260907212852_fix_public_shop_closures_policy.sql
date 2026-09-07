-- A política anterior consultava public.shops, que é deliberadamente privada
-- para visitantes. A projeção public_shops contém apenas os dados seguros e já
-- filtra estabelecimentos bloqueados pela própria RLS.
DROP POLICY IF EXISTS "Public reads closures of available shops"
  ON public.shop_closures;

CREATE POLICY "Public reads closures of available shops"
  ON public.shop_closures
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.public_shops ps
      WHERE ps.id = shop_closures.shop_id
    )
  );

REVOKE ALL ON public.shop_closures FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.shop_closures TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_closures TO authenticated;

NOTIFY pgrst, 'reload schema';
