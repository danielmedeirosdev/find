import { authErrorMessage, isSupabaseConfigured, supabase } from './supabase'
import { absolutePublicUrl } from './site'

export async function requestPasswordReset(email: string): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error('Configure o Supabase no arquivo .env antes de recuperar o acesso.')
  }
  const trimmed = email.trim()
  if (!trimmed) throw new Error('Informe o e-mail da conta.')

  const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
    redirectTo: absolutePublicUrl('/redefinir-senha'),
  })
  if (error) throw new Error(authErrorMessage(error))
}
