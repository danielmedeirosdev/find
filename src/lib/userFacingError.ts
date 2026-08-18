/**
 * Converts technical/backend errors into short Portuguese messages for the UI.
 * Keep raw details in console for debugging — never show stack traces to users.
 */
export function userFacingError(err: unknown, fallback: string): string {
  const raw =
    typeof err === 'string'
      ? err
      : err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : ''

  const message = raw.trim()
  if (!message) return fallback

  const lower = message.toLowerCase()

  if (/pgrst|postgrest|42501|permission denied|row-level security|rls/i.test(message)) {
    return 'Você não tem permissão para esta ação.'
  }
  if (/jwt|not authenticated|session|invalid claim/i.test(lower)) {
    return 'Sua sessão expirou. Entre novamente para continuar.'
  }
  if (/failed to fetch|network|load failed|timeout|econnrefused/i.test(lower)) {
    return 'Não foi possível conectar. Verifique sua internet e tente novamente.'
  }
  if (/500|internal server|unexpected/i.test(lower)) {
    return fallback
  }
  if (/duplicate|unique|already exists|23505/i.test(lower)) {
    return 'Este registro já existe. Verifique os dados e tente novamente.'
  }
  if (/overlap|conflito|indispon|ocupado|slot/i.test(lower)) {
    return 'Este horário conflita com outro agendamento. Escolha outro horário.'
  }

  // Already human (Portuguese) messages from our RPCs / edge functions.
  if (/[áàâãéêíóôõúç]/i.test(message) || /não|voce|você|senha|agendamento|permissão/i.test(message)) {
    // Strip postgres codes if mixed in
    return message.replace(/\bPGRST\d+\b/gi, '').replace(/\s{2,}/g, ' ').trim() || fallback
  }

  return fallback
}
