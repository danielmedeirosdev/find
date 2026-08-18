import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { deleteShopMedia, uploadShopMedia } from '../../../lib/media'
import { DefaultAvatar, ImageDropzone, ProgressBar, Toast } from '../../../components/MediaUI'
import { ProfessionalWeekSchedule } from '../../../components/ProfessionalWeekSchedule'
import { StaffAccessPanel } from '../../../components/StaffAccessPanel'
import { EmptyState, LoadingBlock } from '../../../components/EmptyState'
import type { Barber, BarberSchedule } from '../../../lib/types'
import { userFacingError } from '../../../lib/userFacingError'

interface Props {
  shopId: string
}

export function TeamScheduleTab({ shopId }: Props) {
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [schedules, setSchedules] = useState<BarberSchedule[]>([])
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  const load = async () => {
    const { data: barb } = await supabase
      .from('barbers')
      .select('*')
      .eq('shop_id', shopId)
      .order('name')

    const barberIds = (barb || []).map((b) => b.id)
    let sched: BarberSchedule[] = []
    if (barberIds.length > 0) {
      const { data } = await supabase
        .from('barber_schedule')
        .select('*')
        .in('barber_id', barberIds)
      sched = data || []
    }

    setBarbers(barb || [])
    setSchedules(sched)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [shopId])

  const addBarber = async () => {
    if (!newName.trim()) return
    await supabase.from('barbers').insert({
      shop_id: shopId,
      name: newName.trim(),
      role: newRole.trim() || null,
    })
    setNewName('')
    setNewRole('')
    load()
  }

  const removeBarber = async (barber: Barber) => {
    if (!confirm('O profissional será removido da equipe e da agenda. Deseja continuar?')) return
    if (barber.photo_url) await deleteShopMedia(barber.photo_url)
    await supabase.from('barbers').delete().eq('id', barber.id)
    load()
  }

  const updateRole = async (barberId: string, role: string) => {
    await supabase
      .from('barbers')
      .update({ role: role.trim() || null })
      .eq('id', barberId)
  }

  const uploadPhoto = async (barber: Barber, files: File[]) => {
    const file = files[0]
    if (!file) return
    setUploadingId(barber.id)
    setProgress(0)
    try {
      const url = await uploadShopMedia(shopId, file, 'barbers', setProgress, barber.id)
      if (barber.photo_url) await deleteShopMedia(barber.photo_url)
      await supabase.from('barbers').update({ photo_url: url }).eq('id', barber.id)
      setToast('Foto atualizada.')
      load()
    } catch (err) {
      setToast(userFacingError(err, 'Não foi possível enviar a foto. Tente novamente.'))
    }
    setUploadingId(null)
    setProgress(0)
  }

  const removePhoto = async (barber: Barber) => {
    if (!barber.photo_url || !confirm('Remover a foto deste profissional?')) return
    await deleteShopMedia(barber.photo_url)
    await supabase.from('barbers').update({ photo_url: null }).eq('id', barber.id)
    load()
  }

  const getSchedule = (barberId: string, day: number) =>
    schedules.find((s) => s.barber_id === barberId && s.day_of_week === day)

  const updateCommission = async (barberId: string, value: string) => {
    const pct = value === '' ? null : parseFloat(value.replace(',', '.'))
    if (pct !== null && (isNaN(pct) || pct < 0 || pct > 100)) return
    await supabase.from('barbers').update({ commission_percent: pct }).eq('id', barberId)
    load()
  }

  const updateSchedule = async (
    barberId: string,
    day: number,
    field: 'is_active' | 'start_time' | 'end_time',
    value: boolean | string
  ) => {
    const existing = getSchedule(barberId, day)
    if (existing) {
      await supabase
        .from('barber_schedule')
        .update({ [field]: value })
        .eq('id', existing.id)
    } else {
      await supabase.from('barber_schedule').insert({
        barber_id: barberId,
        day_of_week: day,
        is_active: field === 'is_active' ? value : false,
        start_time: field === 'start_time' ? value : '09:00',
        end_time: field === 'end_time' ? value : '18:00',
      })
    }
    await load()
  }

  const applyHours = async (
    barberId: string,
    days: number[],
    startTime: string,
    endTime: string
  ) => {
    for (const day of days) {
      const existing = getSchedule(barberId, day)
      if (existing) {
        await supabase
          .from('barber_schedule')
          .update({ is_active: true, start_time: startTime, end_time: endTime })
          .eq('id', existing.id)
      } else {
        await supabase.from('barber_schedule').insert({
          barber_id: barberId,
          day_of_week: day,
          is_active: true,
          start_time: startTime,
          end_time: endTime,
        })
      }
    }
    await load()
  }

  if (loading) return <LoadingBlock label="Carregando equipe..." />

  return (
    <div>
      <Toast message={toast} onClose={() => setToast(null)} />
      <h2 className="font-display text-2xl text-white mb-2">Equipe e horários</h2>
      <p className="text-sm text-charcoal-muted mb-6">
        Cadastre a equipe, os horários e, se quiser, um acesso individual ao painel. Cada profissional
        vê apenas a própria agenda, sem financeiro ou assinatura.
      </p>

      <div className="mb-8 flex flex-wrap gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Ex: Lucas Andrade"
          className="min-w-[12rem] flex-1 rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white placeholder:text-charcoal-muted/60 focus:border-brass focus:outline-none"
        />
        <input
          value={newRole}
          onChange={(e) => setNewRole(e.target.value)}
          placeholder="Cargo (ex: Barbeiro Sênior)"
          className="w-48 rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white placeholder:text-charcoal-muted/60 focus:border-brass focus:outline-none"
        />
        <button
          onClick={addBarber}
          className="rounded-lg bg-brass px-4 py-2 font-semibold text-charcoal"
        >
          Adicionar
        </button>
      </div>

      {barbers.length === 0 ? (
        <EmptyState
          title="Ainda não há profissionais na equipe."
          description="Adicione o primeiro membro para organizar horários e a agenda."
        />
      ) : (
        <div className="space-y-8">
          {barbers.map((barber) => (
            <div key={barber.id} className="rounded-lg border border-charcoal-light p-4">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="relative">
                    {barber.photo_url ? (
                      <img
                        src={barber.photo_url}
                        alt={barber.name}
                        className="h-16 w-16 rounded-full object-cover border border-charcoal-light"
                      />
                    ) : (
                      <DefaultAvatar name={barber.name} className="h-16 w-16 text-xl" />
                    )}
                    <ImageDropzone
                      onFiles={(files) => uploadPhoto(barber, files)}
                      disabled={uploadingId === barber.id}
                      className="mt-2 rounded border border-dashed border-charcoal-light px-2 py-1 text-center text-[10px] text-brass hover:border-brass"
                    >
                      {barber.photo_url ? 'Trocar' : 'Foto'}
                    </ImageDropzone>
                    {barber.photo_url && (
                      <button
                        type="button"
                        onClick={() => removePhoto(barber)}
                        className="mt-1 block w-full text-[10px] text-red-400"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                  <div>
                    <h3 className="font-display text-xl text-brass">{barber.name}</h3>
                    <input
                      defaultValue={barber.role || ''}
                      onBlur={(e) => updateRole(barber.id, e.target.value)}
                      placeholder="Cargo (ex: Barbeiro Sênior)"
                      className="mt-1 w-full max-w-xs rounded border border-charcoal-light bg-charcoal px-2 py-1 text-sm text-white focus:border-brass focus:outline-none"
                    />
                    {uploadingId === barber.id && (
                      <div className="mt-2 w-40">
                        <ProgressBar value={progress} />
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-charcoal-muted">
                    Comissão %
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={barber.commission_percent ?? ''}
                      onChange={(e) => updateCommission(barber.id, e.target.value)}
                      placeholder="—"
                      className="w-20 rounded border border-charcoal-light bg-charcoal px-2 py-1 font-mono text-sm text-white"
                    />
                  </label>
                  <button
                    onClick={() => removeBarber(barber)}
                    className="text-sm text-red-400 hover:text-red-300"
                  >
                    Remover
                  </button>
                </div>
              </div>

              <ProfessionalWeekSchedule
                barberId={barber.id}
                schedules={schedules}
                onUpdate={updateSchedule}
                onApplyHours={applyHours}
              />

              <StaffAccessPanel barber={barber} onChanged={load} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
