import { absolutePublicUrl } from './site'
import { supabase } from './supabase'

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024

type MediaFolder = 'logo' | 'gallery' | 'barbers'

/** Só redimensiona/comprime quando realmente precisa. */
const PRESETS: Record<
  MediaFolder,
  { maxDimension: number; quality: number; skipBelowBytes: number }
> = {
  gallery: { maxDimension: 3200, quality: 0.95, skipBelowBytes: 3.5 * 1024 * 1024 },
  logo: { maxDimension: 1200, quality: 0.95, skipBelowBytes: 800 * 1024 },
  barbers: { maxDimension: 1200, quality: 0.93, skipBelowBytes: 1 * 1024 * 1024 },
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

export async function ensureUniqueSlug(
  base: string,
  excludeShopId?: string,
  segment?: string | null
): Promise<string> {
  const fallback = segment === 'pet' ? 'pet-shop' : 'barbearia'
  const root = slugify(base) || fallback
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

function extFor(file: File): { contentType: string; ext: string } {
  if (file.type === 'image/png') return { contentType: 'image/png', ext: 'png' }
  if (file.type === 'image/webp') return { contentType: 'image/webp', ext: 'webp' }
  return { contentType: 'image/jpeg', ext: 'jpg' }
}

async function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality)
  )
  if (!blob) throw new Error('Falha ao comprimir imagem.')
  return blob
}

/**
 * Galeria: preserva o arquivo original sempre que couber no limite.
 * Só redimensiona se for maior que maxDimension OU passar do tamanho do bucket.
 */
export async function prepareImage(
  file: File,
  folder: MediaFolder
): Promise<{ blob: Blob; contentType: string; ext: string }> {
  if (!ACCEPTED.includes(file.type)) {
    throw new Error('Use PNG, JPG ou WEBP.')
  }
  if (file.size > MAX_BYTES * 3) {
    throw new Error('Arquivo muito grande. Use uma imagem de até ~10 MB.')
  }

  const preset = PRESETS[folder]
  const img = await loadImage(file)
  const longest = Math.max(img.width, img.height)
  const needsResize = longest > preset.maxDimension
  const needsShrink = file.size > MAX_BYTES

  // Mantém original (sem passar pelo canvas = sem perda)
  if (!needsResize && !needsShrink && file.size <= preset.skipBelowBytes) {
    const { contentType, ext } = extFor(file)
    return { blob: file, contentType, ext }
  }

  // JPG original já no tamanho certo, só um pouco acima do skip — ainda assim evita canvas
  if (!needsResize && file.type === 'image/jpeg' && file.size <= MAX_BYTES) {
    return { blob: file, contentType: 'image/jpeg', ext: 'jpg' }
  }

  const scale = needsResize ? preset.maxDimension / longest : 1
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

  let q = preset.quality
  let out = await canvasToJpeg(canvas, q)
  while (out.size > MAX_BYTES && q > 0.8) {
    q -= 0.03
    out = await canvasToJpeg(canvas, q)
  }

  if (out.size > MAX_BYTES) {
    throw new Error('Imagem ainda grande demais. Tente outra com resolução um pouco menor.')
  }

  return { blob: out, contentType: 'image/jpeg', ext: 'jpg' }
}

export async function uploadShopMedia(
  shopId: string,
  file: File,
  folder: MediaFolder,
  onProgress?: (pct: number) => void
): Promise<string> {
  onProgress?.(10)
  const { blob, contentType, ext } = await prepareImage(file, folder)
  onProgress?.(45)

  const path = `${shopId}/${folder}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('shop-media').upload(path, blob, {
    contentType,
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

/** Caminho de agendamento público conforme o segmento da loja. */
export function publicBookingPath(shopId: string, segment?: 'barbershop' | 'pet' | null): string {
  // Reexporta a lógica centralizada em segments.ts
  return segment === 'pet' ? `/pet/${shopId}` : `/barbearia/${shopId}`
}

export function publicShopPath(slug: string): string {
  return `/b/${slug}`
}

export function publicShopUrl(slug: string): string {
  return absolutePublicUrl(publicShopPath(slug))
}
