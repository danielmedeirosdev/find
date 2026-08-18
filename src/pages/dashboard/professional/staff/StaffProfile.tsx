import { useEffect, useState } from 'react'
import { supabase } from '../../../../lib/supabase'
import { deleteShopMedia, uploadShopMedia } from '../../../../lib/media'
import { DefaultAvatar, ImageDropzone, ProgressBar, Toast } from '../../../../components/MediaUI'
import { InlineError, LoadingBlock } from '../../../../components/EmptyState'
import { userFacingError } from '../../../../lib/userFacingError'
import type { Barber, BarberSchedule, Shop } from '../../../../lib/types'

interface Props {
  shop: Shop
  barber: Barber
  onUpdate: () => void
}

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function StaffProfileTab({ shop, barber, onUpdate }: Props) {
  const [name, setName] = useState(barber.name)
  const [role, setRole] = useState(barber.role || '')
  const [schedules, setSchedules] = useState<BarberSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    setName(barber.name)
    setRole(barber.role || '')
  }, [barber])

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('barber_schedule')
        .select('*')
        .eq('barber_id', barber.id)
        .order('day_of_week')
      setSchedules(data || [])
      setLoading(false)
    }
    load()
  }, [barber.id])

  const saveProfile = async () => {
    if (!name.trim()) return
    setSaving(true)
    setError('')
    const { error: updateError } = await supabase
      .from('barbers')
      .update({ name: name.trim(), role: role.trim() || null })
      .eq('id', barber.id)
    if (updateError) {
      setError(userFacingError(updateError, 'Não foi possível salvar seu perfil.'))
    } else {
      setToast('Perfil atualizado.')
      onUpdate()
    }
    setSaving(false)
  }

  const uploadPhoto = async (files: File[]) => {
    const file = files[0]
    if (!file) return
    setUploading(true)
    setProgress(0)
    setError('')
    try {
      const url = await uploadShopMedia(shop.id, file, 'barbers', setProgress)
      if (barber.photo_url) await deleteShopMedia(barber.photo_url)
      const { error: updateError } = await supabase
        .from('barbers')
        .update({ photo_url: url })
        .eq('id', barber.id)
      if (updateError) throw updateError
      setToast('Foto atualizada.')
      onUpdate()
    } catch (err) {
      setError(userFacingError(err, 'Não foi possível enviar a foto.'))
    }
    setUploading(false)
    setProgress(0)
  }

  if (loading) return <LoadingBlock />

  return (
    <div className="max-w-xl">
      <Toast message={toast} onClose={() => setToast(null)} />
      <h2 className="font-display text-2xl text-white mb-2">Meu perfil</h2>
      <p className="text-sm text-charcoal-muted mb-6">
        Dados visíveis na agenda pública. Horários são definidos pelo dono.
      </p>
      {error && (
        <div className="mb-4">
          <InlineError message={error} />
        </div>
      )}

      <div className="mb-6 flex items-start gap-4">
        {barber.photo_url ? (
          <img
            src={barber.photo_url}
            alt=""
            className="h-20 w-20 rounded-full object-cover border border-charcoal-light"
          />
        ) : (
          <DefaultAvatar name={barber.name} className="h-20 w-20 text-2xl" />
        )}
        <div>
          <ImageDropzone
            onFiles={uploadPhoto}
            disabled={uploading}
            className="rounded-lg border border-dashed border-charcoal-light px-3 py-2 text-sm text-brass hover:border-brass"
          >
            {uploading ? 'Enviando...' : barber.photo_url ? 'Trocar foto' : 'Adicionar foto'}
          </ImageDropzone>
          {uploading && (
            <div className="mt-2 w-40">
              <ProgressBar value={progress} />
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-charcoal-muted" htmlFor="staff-name">
            Nome
          </label>
          <input
            id="staff-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-charcoal-light bg-charcoal px-4 py-2.5 text-white focus:border-brass focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-charcoal-muted" htmlFor="staff-role">
            Cargo
          </label>
          <input
            id="staff-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Ex: Barbeiro"
            className="w-full rounded-lg border border-charcoal-light bg-charcoal px-4 py-2.5 text-white focus:border-brass focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={saveProfile}
          disabled={saving}
          className="rounded-lg bg-brass px-4 py-2.5 font-semibold text-charcoal disabled:opacity-50"
        >
          {saving ? 'Salvando...' : 'Salvar perfil'}
        </button>
      </div>

      <div className="mt-10">
        <h3 className="font-medium text-white mb-3">Meus horários</h3>
        {schedules.filter((s) => s.is_active).length === 0 ? (
          <p className="text-sm text-charcoal-muted">
            Nenhum horário ativo. Peça ao dono para configurar sua agenda semanal.
          </p>
        ) : (
          <ul className="space-y-2">
            {schedules
              .filter((s) => s.is_active)
              .map((s) => (
                <li
                  key={s.id}
                  className="flex justify-between rounded-lg border border-charcoal-light px-3 py-2 text-sm"
                >
                  <span className="text-white">{DAY_LABELS[s.day_of_week] || s.day_of_week}</span>
                  <span className="font-mono text-brass">
                    {String(s.start_time).slice(0, 5)} – {String(s.end_time).slice(0, 5)}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  )
}
