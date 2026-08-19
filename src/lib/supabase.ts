import { createClient, FunctionsHttpError } from '@supabase/supabase-js'
import { userFacingError } from './userFacingError'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('your-project') &&
    supabaseAnonKey !== 'your-anon-key' &&
    supabaseUrl !== 'https://placeholder.supabase.co'
)

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase não configurado. Crie o arquivo .env com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.'
  )
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  }
)

export function authErrorMessage(err: unknown): string {
  return userFacingError(
    err,
    'Não foi possível concluir. Verifique os dados e tente novamente.'
  )
}

export async function invokeFunction<T>(
  name: string,
  body: Record<string, unknown>
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body })

  if (error) {
    if (error instanceof FunctionsHttpError) {
      try {
        const details = await error.context.json()
        const msg = details?.error || details?.message || error.message
        const combined = details?.details ? `${msg}: ${details.details}` : String(msg)
        throw new Error(
          userFacingError(combined, 'Não foi possível concluir esta operação. Tente novamente.')
        )
      } catch (parseErr) {
        if (parseErr instanceof Error && parseErr.message !== error.message) throw parseErr
      }
    }
    if (/not found|404/i.test(error.message)) {
      throw new Error('Este serviço está temporariamente indisponível. Tente novamente em instantes.')
    }
    throw new Error(
      userFacingError(error, 'Não foi possível concluir esta operação. Tente novamente.')
    )
  }

  if (data && typeof data === 'object' && 'error' in data && (data as { error: string }).error) {
    const errData = data as { error: string; details?: string }
    throw new Error(
      userFacingError(
        errData.details ? `${errData.error}: ${errData.details}` : errData.error,
        'Não foi possível concluir esta operação. Tente novamente.'
      )
    )
  }

  return data as T
}
