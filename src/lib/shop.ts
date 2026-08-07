import { supabase } from './supabase'

/** Apaga a barbearia do usuário, todos os dados relacionados, mídias e a conta. */
export async function deleteOwnShop(): Promise<void> {
  const { error } = await supabase.rpc('delete_own_shop')
  if (error) {
    throw new Error(
      error.message.includes('Could not find the function') ||
        error.message.includes('function') ||
        error.code === 'PGRST202'
        ? 'Função de exclusão não encontrada no Supabase. Execute a migration 010_delete_own_shop.sql.'
        : error.message
    )
  }
}
