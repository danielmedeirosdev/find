import { isSupabaseConfigured } from '../lib/supabase'

export function SetupBanner() {
  if (isSupabaseConfigured) return null

  return (
    <div className="border-b border-amber-600/40 bg-amber-950 px-4 py-3 text-center text-sm text-amber-100">
      <strong>Supabase não configurado.</strong> Crie o arquivo{' '}
      <code className="rounded bg-black/30 px-1">.env</code> na pasta do projeto com{' '}
      <code className="rounded bg-black/30 px-1">VITE_SUPABASE_URL</code> e{' '}
      <code className="rounded bg-black/30 px-1">VITE_SUPABASE_ANON_KEY</code>, depois reinicie com{' '}
      <code className="rounded bg-black/30 px-1">npm run dev</code>.
    </div>
  )
}
