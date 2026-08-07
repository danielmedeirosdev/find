import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import {
  isValidSlug,
  publicShopPath,
  publicShopUrl,
  slugify,
} from '../../../lib/media'
import { Toast } from '../../../components/MediaUI'
import { FieldHint } from '../../../components/FormHints'
import type { Barber, Shop, ShopPhoto } from '../../../lib/types'

interface Props {
  shop: Shop
  onUpdate: () => void
}

export function ShopLinkTab({ shop, onUpdate }: Props) {
  const [slug, setSlug] = useState(shop.slug || slugify(shop.name))
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [photos, setPhotos] = useState<ShopPhoto[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])

  useEffect(() => {
    setSlug(shop.slug || slugify(shop.name))
  }, [shop])

  useEffect(() => {
    async function load() {
      const [{ data: ph }, { data: barb }] = await Promise.all([
        supabase.from('shop_photos').select('*').eq('shop_id', shop.id).order('sort_order').limit(4),
        supabase.from('barbers').select('*').eq('shop_id', shop.id).order('name').limit(3),
      ])
      setPhotos((ph as ShopPhoto[]) || [])
      setBarbers(barb || [])
    }
    load()
  }, [shop.id, shop.logo_url])

  const fullUrl = publicShopUrl(shop.slug || slug)
  const displayHost = typeof window !== 'undefined' ? window.location.host : 'findapp.com'

  const saveSlug = async () => {
    const cleaned = slugify(slug)
    setError('')
    if (!isValidSlug(cleaned)) {
      setError('Use apenas letras minúsculas, números e hífen.')
      return
    }
    setSaving(true)
    const { data: existing } = await supabase
      .from('shops')
      .select('id')
      .eq('slug', cleaned)
      .neq('id', shop.id)
      .maybeSingle()

    if (existing) {
      setError('Esse endereço já está em uso.')
      setSaving(false)
      return
    }

    const { error: updateError } = await supabase
      .from('shops')
      .update({ slug: cleaned })
      .eq('id', shop.id)

    if (updateError) {
      if (/unique|duplicate/i.test(updateError.message)) {
        setError('Esse endereço já está em uso.')
      } else {
        setError(updateError.message)
      }
      setSaving(false)
      return
    }

    setSlug(cleaned)
    setEditing(false)
    setToast('Endereço atualizado.')
    setSaving(false)
    onUpdate()
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl)
      setToast('Link copiado com sucesso.')
    } catch {
      setToast('Não foi possível copiar.')
    }
  }

  return (
    <div className="max-w-3xl space-y-8">
      <Toast message={toast} onClose={() => setToast(null)} />

      <div>
        <h2 className="font-display text-2xl text-white mb-2">Link da Barbearia</h2>
        <p className="text-sm text-charcoal-muted">
          Página pública exclusiva com logo, fotos, equipe e agendamento.
        </p>
      </div>

      <div className="rounded-lg border border-charcoal-light p-6 space-y-4">
        <p className="text-sm text-white">Endereço público (slug)</p>
        <FieldHint>
          Endereço que será usado no link público. Use só letras minúsculas, números e hífen.
          <br />
          Exemplo: {displayHost}/b/barbearia-black-crown
        </FieldHint>
        <div className="flex flex-wrap items-center gap-2 font-mono text-sm pt-1">
          <span className="text-charcoal-muted">{displayHost}/b/</span>
          {editing ? (
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              placeholder="barbearia-black-crown"
              className="min-w-[12rem] flex-1 rounded-lg border border-brass bg-charcoal px-3 py-2 text-white placeholder:text-charcoal-muted/60 focus:outline-none"
            />
          ) : (
            <span className="text-brass text-base">{shop.slug || slug}</span>
          )}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex flex-wrap gap-2">
          {editing ? (
            <>
              <button
                onClick={saveSlug}
                disabled={saving}
                className="rounded-lg bg-brass px-4 py-2 text-sm font-semibold text-charcoal disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Salvar endereço'}
              </button>
              <button
                onClick={() => {
                  setEditing(false)
                  setSlug(shop.slug || slugify(shop.name))
                  setError('')
                }}
                className="rounded-lg border border-charcoal-light px-4 py-2 text-sm text-charcoal-muted"
              >
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={copyLink}
                className="rounded-lg bg-brass px-4 py-2 text-sm font-semibold text-charcoal"
              >
                Copiar link
              </button>
              <a
                href={publicShopPath(shop.slug || slug)}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-charcoal-light px-4 py-2 text-sm text-white hover:border-brass"
              >
                Abrir página
              </a>
              <button
                onClick={() => setEditing(true)}
                className="rounded-lg border border-charcoal-light px-4 py-2 text-sm text-charcoal-muted hover:text-white"
              >
                Editar endereço
              </button>
            </>
          )}
        </div>

        <p className="text-xs text-charcoal-muted">
          Exemplo: {displayHost}/b/{shop.slug || 'barbearia-black-crown'}
        </p>
      </div>

      <div className="rounded-lg border border-charcoal-light p-6">
        <h3 className="font-medium text-white mb-4">Preview da página pública</h3>
        <div className="mx-auto max-w-xs overflow-hidden rounded-xl border border-charcoal-light bg-paper text-ink shadow-lg">
          {photos[0] || shop.logo_url ? (
            <div className="relative h-36 bg-paper-dark">
              <img
                src={photos[0]?.url || shop.logo_url || ''}
                alt=""
                className="h-full w-full object-cover"
              />
              {shop.logo_url && (
                <img
                  src={shop.logo_url}
                  alt=""
                  className="absolute bottom-2 left-2 h-12 w-12 rounded-lg border-2 border-white object-cover"
                />
              )}
            </div>
          ) : (
            <div className="flex h-36 items-center justify-center bg-paper-dark text-ink-muted text-sm">
              Sem fotos ainda
            </div>
          )}
          <div className="p-4">
            <p className="font-display text-xl leading-tight">{shop.name}</p>
            {shop.slogan && <p className="text-xs text-ink-muted italic mt-1">{shop.slogan}</p>}
            {barbers.length > 0 && (
              <div className="mt-3 flex -space-x-2">
                {barbers.map((b) =>
                  b.photo_url ? (
                    <img
                      key={b.id}
                      src={b.photo_url}
                      alt={b.name}
                      className="h-8 w-8 rounded-full border-2 border-white object-cover"
                    />
                  ) : (
                    <div
                      key={b.id}
                      className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-brass/20 text-xs font-display text-brass"
                    >
                      {b.name[0]}
                    </div>
                  )
                )}
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <span className="flex-1 rounded-md bg-brass py-2 text-center text-xs font-semibold text-charcoal">
                Agendar horário
              </span>
              <span className="rounded-md border border-paper-dark px-3 py-2 text-xs text-ink-muted">
                Serviços
              </span>
            </div>
            <Link
              to={publicShopPath(shop.slug || slug)}
              className="mt-3 block text-center text-xs text-brass hover:underline"
            >
              Ver página completa →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
