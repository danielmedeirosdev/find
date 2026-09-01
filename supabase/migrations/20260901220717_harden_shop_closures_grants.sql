-- Supabase aplica privilégios padrão aos papéis da API em tabelas novas.
-- Mantemos apenas as operações realmente usadas; a RLS continua sendo a
-- autoridade para decidir quais registros cada usuário pode acessar.

REVOKE ALL ON public.shop_closures FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.shop_closures TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_closures TO authenticated;
