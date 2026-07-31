import { createClient, FunctionsHttpError } from '@supabase/supabase-js'

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
  supabaseAnonKey || 'placeholder'
)

export function authErrorMessage(err: unknown): string {
  if (err instanceof TypeError && /fetch|load failed|network/i.test(err.message)) {
    return 'Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.'
  }
  if (err instanceof Error) return err.message
  return 'Erro inesperado. Tente novamente.'
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
        if (details?.details) throw new Error(`${msg}: ${details.details}`)
        throw new Error(msg)
      } catch (parseErr) {
        if (parseErr instanceof Error && parseErr.message !== error.message) throw parseErr
      }
    }
    if (/not found|404/i.test(error.message)) {
      throw new Error(
        `A função "${name}" não está no Supabase. Faça deploy: npx supabase functions deploy ${name}`
      )
    }
    throw error
  }

  if (data && typeof data === 'object' && 'error' in data && (data as { error: string }).error) {
    const errData = data as { error: string; details?: string }
    throw new Error(errData.details ? `${errData.error}: ${errData.details}` : errData.error)
  }

  return data as T
}
