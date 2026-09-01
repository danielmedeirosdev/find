-- Substitui a antiga promessa de ajuda humana por orientacao dentro do produto.
-- Registros existentes sao preservados e passam a usar o modo guiado.

ALTER TABLE public.shops
  DROP CONSTRAINT IF EXISTS shops_pet_onboarding_mode_check;

UPDATE public.shops
SET pet_onboarding_mode = 'guided'
WHERE pet_onboarding_mode = 'assisted';

ALTER TABLE public.shops
  ADD CONSTRAINT shops_pet_onboarding_mode_check CHECK (
    pet_onboarding_mode IS NULL OR pet_onboarding_mode IN ('self_service', 'guided')
  );

COMMENT ON COLUMN public.shops.pet_onboarding_mode IS
  'Experiencia escolhida no onboarding: configuracao rapida ou guiada no proprio produto.';
COMMENT ON COLUMN public.shops.pet_setup_help_requested_at IS
  'Campo legado preservado por compatibilidade; o onboarding atual nao solicita atendimento humano.';

NOTIFY pgrst, 'reload schema';
