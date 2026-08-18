/**
 * Converts technical/backend errors into short Portuguese messages for the UI.
 * Keep raw details in console for debugging — never show stack traces, SQL or vendor jargon.
 */
function extractMessage(err: unknown): string {
  if (typeof err === 'string') return err
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message)
  }
  return ''
}

function isLikelyPortuguese(message: string): boolean {
  return (
    /[áàâãéêíóôõúç]/i.test(message) ||
    /\b(não|nao|você|voce|senha|agendamento|permissão|permissao|horário|horario|cadastro|estabelecimento|cliente|serviço|servico|profissional|assinatura)\b/i.test(
      message
    )
  )
}

function isTechnical(message: string): boolean {
  return /pgrst|postgrest|postgres|supabase|\.env\b|npx |sql editor|migration|service_role|jwt|rls\b|row-level|42501|23505|stack trace|at Object\.|functions deploy|could not find the function|column .+ does not exist|relation .+ does not exist|undefined is not|null value in column|edge function/i.test(
    message
  )
}

export function userFacingError(err: unknown, fallback: string): string {
  const raw = extractMessage(err).trim()
  if (!raw) return fallback

  const lower = raw.toLowerCase()

  if (/invalid login credentials|invalid_credentials/.test(lower)) {
    return 'E-mail ou senha incorretos.'
  }
  if (/email not confirmed|email_not_confirmed/.test(lower)) {
    return 'Confirme seu e-mail para entrar. Verifique a caixa de entrada e o spam.'
  }
  if (/user already registered|already been registered|email_exists|already exists/.test(lower) && /user|email|mail/.test(lower)) {
    return 'Este e-mail já possui uma conta. Entre para continuar.'
  }
  if (/too many requests|rate limit|over_request_rate|429/.test(lower)) {
    return 'Muitas tentativas em pouco tempo. Aguarde um momento e tente novamente.'
  }
  if (/weak password|password should|password must|least 8/.test(lower)) {
    return 'A senha não atende aos requisitos de segurança.'
  }
  if (/signup is disabled|signups not allowed/.test(lower)) {
    return 'O cadastro está temporariamente indisponível. Tente novamente mais tarde.'
  }
  if (/pgrst|postgrest|42501|permission denied|row-level security|rls/i.test(raw)) {
    return 'Você não tem permissão para realizar esta ação.'
  }
  if (/jwt|not authenticated|session expired|invalid claim|não autenticado/.test(lower)) {
    return 'Sua sessão expirou. Entre novamente para continuar.'
  }
  if (/failed to fetch|network|load failed|timeout|econnrefused/.test(lower)) {
    return 'Não foi possível conectar. Confira sua internet e tente novamente.'
  }
  if (/duplicate|unique constraint|already exists|23505/.test(lower)) {
    return 'Este registro já existe. Verifique os dados e tente novamente.'
  }
  if (/overlap|conflito|indispon|ocupado|slot|bookings_active_slot|bookings_barber_id_date_time/.test(lower)) {
    return 'Este horário não está mais disponível. Escolha outro horário.'
  }
  if (/storage|upload|object.*not found|payload too large|413/.test(lower) && !isLikelyPortuguese(raw)) {
    return 'Não foi possível enviar o arquivo. Use uma imagem menor em PNG, JPG ou WEBP.'
  }
  if (/500|internal server|unexpected/.test(lower) && !isLikelyPortuguese(raw)) {
    return fallback
  }
  if (isTechnical(raw)) return fallback

  if (isLikelyPortuguese(raw)) {
    return raw.replace(/\bPGRST\d+\b/gi, '').replace(/\s{2,}/g, ' ').trim() || fallback
  }

  return fallback
}
