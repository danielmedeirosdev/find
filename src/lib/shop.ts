import { supabase } from './supabase'

const MEDIA_FOLDERS = ['logo', 'gallery', 'barbers'] as const

async function listAllPaths(prefix: string): Promise<string[]> {
  const { data, error } = await supabase.storage.from('shop-media').list(prefix, {
    limit: 1000,
  })
  if (error || !data) return []

  const paths: string[] = []
  for (const item of data) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name
    // Folders have null id / no metadata in storage list
    if (item.id === null || item.metadata == null) {
      paths.push(...(await listAllPaths(fullPath)))
    } else {
      paths.push(fullPath)
    }
  }
  return paths
}

/** Remove todas as mídias do bucket da barbearia via Storage API. */
export async function deleteShopMediaFolder(shopId: string): Promise<void> {
  const paths: string[] = []

  for (const folder of MEDIA_FOLDERS) {
    paths.push(...(await listAllPaths(`${shopId}/${folder}`)))
  }
  // Arquivos soltos na raiz da pasta da loja (se houver)
  const rootItems = await listAllPaths(shopId)
  for (const p of rootItems) {
    if (!paths.includes(p)) paths.push(p)
  }

  if (paths.length === 0) return

  // remove aceita lotes; divide se necessário
  const chunkSize = 100
  for (let i = 0; i < paths.length; i += chunkSize) {
    const chunk = paths.slice(i, i + chunkSize)
    const { error } = await supabase.storage.from('shop-media').remove(chunk)
    if (error) {
      console.warn('Falha ao limpar mídia da loja:', error.message)
    }
  }
}

/** Apaga a barbearia do usuário, todos os dados relacionados, mídias e a conta. */
export async function deleteOwnShop(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado.')

  const { data: shop, error: shopError } = await supabase
    .from('shops')
    .select('id')
    .eq('owner_user_id', user.id)
    .maybeSingle()

  if (shopError) throw new Error(shopError.message)
  if (!shop) throw new Error('Estabelecimento não encontrado.')

  await deleteShopMediaFolder(shop.id)

  const { error } = await supabase.rpc('delete_own_shop')
  if (error) {
    throw new Error(
      error.message.includes('Could not find the function') ||
        error.code === 'PGRST202'
        ? 'Função de exclusão não encontrada no Supabase. Execute as migrations 010 e 011.'
        : error.message
    )
  }
}
