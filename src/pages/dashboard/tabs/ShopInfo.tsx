import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { deleteShopMedia, uploadShopMedia } from '../../../lib/media'
import { ImageDropzone, ProgressBar, Toast } from '../../../components/MediaUI'
import { DeleteShopControl } from '../../../components/DeleteShopControl'
import { FieldHint, FieldLabel } from '../../../components/FormHints'
import type { Shop, ShopPhoto } from '../../../lib/types'

interface Props {
  shop: Shop
  onUpdate: () => void
}

export function ShopInfoTab({ shop, onUpdate }: Props) {
  const [name, setName] = useState(shop.name)
  const [slogan, setSlogan] = useState(shop.slogan || '')
  const [address, setAddress] = useState(shop.address || '')
  const [phone, setPhone] = useState(shop.phone || '')
  const [hoursText, setHoursText] = useState(shop.hours_text || '')
  const [logoUrl, setLogoUrl] = useState(shop.logo_url || '')
  const [photos, setPhotos] = useState<ShopPhoto[]>([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)

  const loadPhotos = useCallback(async () => {
    const { data } = await supabase
      .from('shop_photos')
      .select('*')
      .eq('shop_id', shop.id)
      .order('sort_order')
    setPhotos((data as ShopPhoto[]) || [])
  }, [shop.id])

  useEffect(() => {
    loadPhotos()
  }, [loadPhotos])

  useEffect(() => {
    setName(shop.name)
    setSlogan(shop.slogan || '')
    setAddress(shop.address || '')
    setPhone(shop.phone || '')
    setHoursText(shop.hours_text || '')
    setLogoUrl(shop.logo_url || '')
  }, [shop])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    const { error } = await supabase
      .from('shops')
      .update({
        name: name.trim(),
        slogan: slogan.trim() || null,
        address: address.trim() || null,
        phone: phone.trim() || null,
        hours_text: hoursText.trim() || null,
      })
      .eq('id', shop.id)

    if (error) setMessage(error.message)
    else {
      setMessage('Salvo com sucesso!')
      onUpdate()
    }
    setSaving(false)
  }

  const uploadLogo = async (files: File[]) => {
    const file = files[0]
    if (!file) return
    setUploading(true)
    setUploadProgress(0)
    try {
      const url = await uploadShopMedia(shop.id, file, 'logo', setUploadProgress)
      if (logoUrl) await deleteShopMedia(logoUrl)
      const { error } = await supabase.from('shops').update({ logo_url: url }).eq('id', shop.id)
      if (error) throw error
      setLogoUrl(url)
      setToast('Logo atualizada.')
      onUpdate()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Erro no upload.')
    }
    setUploading(false)
    setUploadProgress(0)
  }

  const removeLogo = async () => {
    if (!logoUrl || !confirm('Remover a logo?')) return
    await deleteShopMedia(logoUrl)
    await supabase.from('shops').update({ logo_url: null }).eq('id', shop.id)
    setLogoUrl('')
    setToast('Logo removida.')
    onUpdate()
  }

  const uploadGallery = async (files: File[]) => {
    setUploading(true)
    try {
      let order = photos.length
      for (const file of files) {
        setUploadProgress(0)
        const url = await uploadShopMedia(shop.id, file, 'gallery', setUploadProgress)
        const { error } = await supabase.from('shop_photos').insert({
          shop_id: shop.id,
          url,
          sort_order: order,
        })
        if (error) throw error
        order += 1
      }
      await loadPhotos()
      setToast(files.length > 1 ? 'Fotos adicionadas.' : 'Foto adicionada.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Erro no upload.')
    }
    setUploading(false)
    setUploadProgress(0)
  }

  const removePhoto = async (photo: ShopPhoto) => {
    if (!confirm('Excluir esta foto?')) return
    await deleteShopMedia(photo.url)
    await supabase.from('shop_photos').delete().eq('id', photo.id)
    await loadPhotos()
    setToast('Foto excluída.')
  }

  const onDropReorder = async (targetId: string) => {
    if (!dragId || dragId === targetId) return
    const list = [...photos]
    const from = list.findIndex((p) => p.id === dragId)
    const to = list.findIndex((p) => p.id === targetId)
    if (from < 0 || to < 0) return
    const [item] = list.splice(from, 1)
    list.splice(to, 0, item)
    setPhotos(list)
    setDragId(null)
    await Promise.all(
      list.map((p, i) =>
        supabase.from('shop_photos').update({ sort_order: i }).eq('id', p.id)
      )
    )
  }

  return (
    <div className="max-w-2xl space-y-8">
      <Toast message={toast} onClose={() => setToast(null)} />

      <form onSubmit={handleSave} className="space-y-4">
        <h2 className="font-display text-2xl text-white">Informações da loja</h2>
        <p className="text-sm text-charcoal-muted -mt-2 mb-2">
          Esses dados aparecem na página pública e no fluxo de agendamento.
        </p>

        <div className="rounded-lg border border-charcoal-light p-5">
          <h3 className="font-medium text-white mb-1">Logo da Barbearia</h3>
          <FieldHint>
            Será exibida no site público, agendamentos e futuras notificações.
          </FieldHint>
          <div className="mt-3 flex flex-wrap items-start gap-4">
            {logoUrl ? (
              <div className="relative">
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="h-28 w-28 rounded-lg object-cover border border-charcoal-light"
                />
                <button
                  type="button"
                  onClick={removeLogo}
                  className="absolute -right-2 -top-2 rounded-full bg-red-500 px-2 text-xs text-white"
                >
                  ×
                </button>
              </div>
            ) : null}
            <ImageDropzone
              onFiles={uploadLogo}
              disabled={uploading}
              className="flex h-28 min-w-[10rem] flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-charcoal-light px-4 text-center hover:border-brass"
            >
              <p className="text-sm text-brass">{logoUrl ? 'Trocar imagem' : 'Enviar logo'}</p>
              <p className="text-xs text-charcoal-muted mt-1">PNG, JPG ou WEBP · arraste ou clique</p>
            </ImageDropzone>
          </div>
          {uploading && uploadProgress > 0 && (
            <div className="mt-3">
              <ProgressBar value={uploadProgress} />
            </div>
          )}
        </div>

        <div className="rounded-lg border border-charcoal-light p-5">
          <h3 className="font-medium text-white mb-1">Fotos da Barbearia</h3>
          <FieldHint>
            Adicione fotos da fachada, ambiente e estrutura para transmitir mais confiança aos
            clientes.
          </FieldHint>
          <div className="mt-3 flex flex-wrap gap-3 mb-4">
            {photos.map((photo) => (
              <div
                key={photo.id}
                draggable
                onDragStart={() => setDragId(photo.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDropReorder(photo.id)}
                className="group relative h-24 w-24 overflow-hidden rounded-lg border border-charcoal-light"
              >
                <img src={photo.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(photo)}
                  className="absolute right-1 top-1 rounded bg-black/70 px-1.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  ×
                </button>
              </div>
            ))}
            <ImageDropzone
              multiple
              onFiles={uploadGallery}
              disabled={uploading}
              className="flex h-24 w-24 flex-col items-center justify-center rounded-lg border border-dashed border-charcoal-light text-center hover:border-brass"
            >
              <span className="text-2xl text-brass">+</span>
              <span className="text-[10px] text-charcoal-muted">Adicionar</span>
            </ImageDropzone>
          </div>
          <p className="text-xs text-charcoal-muted">
            Arraste para reordenar. As fotos aparecem em grade na página pública (sem esticar).
          </p>
        </div>

        <div>
          <FieldLabel>Nome</FieldLabel>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Ex: Barbearia Black Crown"
            className="w-full rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white placeholder:text-charcoal-muted/60 focus:border-brass focus:outline-none"
          />
        </div>

        <div>
          <FieldLabel>Slogan</FieldLabel>
          <input
            value={slogan}
            onChange={(e) => setSlogan(e.target.value)}
            placeholder="Ex: Estilo, precisão e tradição."
            className="w-full rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white placeholder:text-charcoal-muted/60 focus:border-brass focus:outline-none"
          />
          <FieldHint>Frase curta que aparece sob o nome na página pública.</FieldHint>
        </div>

        <div>
          <FieldLabel>Endereço</FieldLabel>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Ex: Rua das Palmeiras, 482 - Centro"
            className="w-full rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white placeholder:text-charcoal-muted/60 focus:border-brass focus:outline-none"
          />
        </div>

        <div>
          <FieldLabel>Telefone</FieldLabel>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Ex: (11) 99999-9999"
            className="w-full rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white placeholder:text-charcoal-muted/60 focus:border-brass focus:outline-none"
          />
          <FieldHint>
            Utilizado para contato dos clientes e integração futura com WhatsApp.
          </FieldHint>
        </div>

        <div>
          <FieldLabel>Horário de funcionamento</FieldLabel>
          <textarea
            value={hoursText}
            onChange={(e) => setHoursText(e.target.value)}
            rows={3}
            placeholder="Ex: Seg-Sex 9h-19h, Sáb 9h-14h"
            className="w-full rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white placeholder:text-charcoal-muted/60 focus:border-brass focus:outline-none"
          />
          <FieldHint>
            Informe os horários gerais da barbearia. Os horários individuais dos funcionários são
            configurados em Equipe e horários.
          </FieldHint>
        </div>

        {message && (
          <p className={`text-sm ${message.includes('sucesso') ? 'text-green-400' : 'text-red-400'}`}>
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brass px-6 py-2 font-semibold text-charcoal disabled:opacity-50"
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </form>

      <DeleteShopControl shopName={shop.name} />
    </div>
  )
}
