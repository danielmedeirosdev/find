import { supabase } from './supabase'

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024

type MediaFolder = 'logo' | 'gallery' | 'barbers'

const PRESETS: Record<MediaFolder, { maxDimension: number; quality: number }> = {
  // Fotos de fachada/ambiente: prioriza nitidez
  gallery: { maxDimension: 2560, quality: 0.92 },
  // Logo precisa de boa definição, mas não precisa ser enorme
  logo: { maxDimension: 1024, quality: 0.93 },
  // Foto de perfil
  barbers: { maxDimension: 900, quality: 0.9 },
}

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
}

export async function ensureUniqueSlug(base: string, excludeShopId?: string): Promise<string> {
  const root = slugify(base) || 'barbearia'
  let candidate = root
  let n = 1
  for (;;) {
    const { data } = await supabase.from('shops').select('id').eq('slug', candidate).maybeSingle()
    if (!data || data.id === excludeShopId) return candidate
    n += 1
    candidate = `${root}-${n}`
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Não foi possível ler a imagem.'))
    }
    img.src = url
  })
}

async function blobFromCanvas(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality)
  )
  if (!blob) throw new Error('Falha ao comprimir imagem.')
  return blob
}

export async function compressImage(
  file: File,
  folder: MediaFolder = 'gallery'
): Promise<Blob> {
  if (!ACCEPTED.includes(file.type)) {
    throw new Error('Use PNG, JPG ou WEBP.')
  }
  if (file.size > MAX_BYTES * 2) {
    throw new Error('Arquivo muito grande (máx. 5 MB).')
  }

  const { maxDimension, quality } = PRESETS[folder]
  const img = await loadImage(file)
  const longest = Math.max(img.width, img.height)

  // Já cabe no limite e é JPG pequeno: não recomprime (evita perda)
  if (
    longest <= maxDimension &&
    file.type === 'image/jpeg' &&
    file.size <= MAX_BYTES &&
    folder === 'gallery'
  ) {
    return file
  }

  const scale = Math.min(1, maxDimension / longest)
  const width = Math.round(img.width * scale)
  const height = Math.round(img.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Falha ao processar imagem.')

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, width, height)

  let out = await blobFromCanvas(canvas, quality)

  // Se ainda passar do teto, reduz qualidade aos poucos (não o tamanho)
  let q = quality
  while (out.size > MAX_BYTES && q > 0.7) {
    q -= 0.05
    out = await blobFromCanvas(canvas, q)
  }

  if (out.size > MAX_BYTES) {
    throw new Error('Imagem ainda grande demais após compressão.')
  }
  return out
}

export async function uploadShopMedia(
  shopId: string,
  file: File,
  folder: MediaFolder,
  onProgress?: (pct: number) => void
): Promise<string> {
  onProgress?.(10)
  const blob = await compressImage(file, folder)
  onProgress?.(45)

  const path = `${shopId}/${folder}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from('shop-media').upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: false,
  })
  if (error) throw error
  onProgress?.(90)

  const { data } = supabase.storage.from('shop-media').getPublicUrl(path)
  onProgress?.(100)
  return data.publicUrl
}

export function storagePathFromUrl(url: string): string | null {
  const marker = '/storage/v1/object/public/shop-media/'
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return decodeURIComponent(url.slice(idx + marker.length))
}

export async function deleteShopMedia(url: string): Promise<void> {
  const path = storagePathFromUrl(url)
  if (!path) return
  await supabase.storage.from('shop-media').remove([path])
}

export function publicShopPath(slug: string): string {
  return `/b/${slug}`
}

export function publicShopUrl(slug: string): string {
  if (typeof window === 'undefined') return `https://findapp.com/b/${slug}`
  return `${window.location.origin}/b/${slug}`
}
