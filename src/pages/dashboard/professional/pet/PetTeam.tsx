import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../../lib/supabase'
import { deleteShopMedia, uploadShopMedia } from '../../../../lib/media'
import { DefaultAvatar, ImageDropzone, ProgressBar, Toast } from '../../../../components/MediaUI'
import { ProfessionalWeekSchedule } from '../../../../components/ProfessionalWeekSchedule'
import { StaffAccessPanel } from '../../../../components/StaffAccessPanel'
import { EmptyState, LoadingBlock } from '../../../../components/EmptyState'
import type { Barber, BarberSchedule } from '../../../../lib/types'

interface Props {
  shopId: string
}

export function PetTeam({ shopId }: Props) {
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [schedules, setSchedules] = useState<BarberSchedule[]>([])
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('')
  const [newSpecialty, setNewSpecialty] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving,setSaving]=useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = useCallback(async () => {
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
  }, [shopId])

  useEffect(() => {
    load()
  }, [load])

  const addBarber = async () => {
    if (!newName.trim() || saving) return
    setSaving(true)
    const {error} = await supabase.from('barbers').insert({
      shop_id: shopId,
      name: newName.trim(),
      role: newRole.trim() || null,
      specialty: newSpecialty.trim() || null,
    })
    setSaving(false)
    if(error){setToast('Não foi possível cadastrar o profissional. Tente novamente.');return}
    setToast('Profissional cadastrado.')
    setNewName('')
    setNewRole('')
    setNewSpecialty('')
    load()
  }

  const removeBarber = async (barber: Barber) => {
    if (!confirm('Remover este funcionário?')) return
    if (barber.photo_url) await deleteShopMedia(barber.photo_url)
    const {error} = await supabase.from('barbers').delete().eq('id', barber.id).eq('shop_id',shopId)
    if(error){setToast('Não foi possível remover: confira os atendimentos vinculados.');return}
    load()
  }

  const updateRole = async (barberId: string, role: string) => {
    await supabase
      .from('barbers')
      .update({ role: role.trim() || null })
      .eq('id', barberId)
  }

  const updateSpecialty = async (barberId: string, specialty: string) => {
    await supabase
      .from('barbers')
      .update({ specialty: specialty.trim() || null })
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
      setToast(err instanceof Error ? err.message : 'Erro no upload')
    }
    setUploadingId(null)
    setProgress(0)
  }

  const removePhoto = async (barber: Barber) => {
    if (!barber.photo_url || !confirm('Remover foto?')) return
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
    <div className="of-workspace">
      <Toast message={toast} onClose={() => setToast(null)} />
      <h2 className="font-display text-2xl text-white mb-2">Equipe e horários</h2>


      <details className="of-section mb-6">
        <summary className="cursor-pointer text-sm font-semibold text-brass">+ Adicionar profissional</summary>
      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Ex: Maria Tosadora"
          className="min-w-[12rem] flex-1 rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white placeholder:text-charcoal-muted/60 focus:border-brass focus:outline-none"
        />
        <input
          value={newRole}
          onChange={(e) => setNewRole(e.target.value)}
          placeholder="Cargo (ex: Banho e tosa / Tosador)"
          className="w-48 rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white placeholder:text-charcoal-muted/60 focus:border-brass focus:outline-none"
        />
        <input
          value={newSpecialty}
          onChange={(e) => setNewSpecialty(e.target.value)}
          placeholder="Especialidade (opcional)"
          className="w-48 rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white placeholder:text-charcoal-muted/60 focus:border-brass focus:outline-none"
        />
        <button
          disabled={saving} onClick={addBarber}
          className="rounded-lg bg-brass px-4 py-2 font-semibold text-charcoal"
        >
          Adicionar
        </button>
      </div>
      </details>

      {barbers.length === 0 ? (
        <EmptyState
          title="Ainda não há profissionais cadastrados."
          description="Adicione o primeiro membro da equipe para organizar horários e agenda."
        />
      ) : (
        <div className="space-y-4">
          {barbers.map((barber) => (
            <div key={barber.id} className="of-work-panel">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="relative shrink-0">
                    {barber.photo_url ? (
                      <img
                        src={barber.photo_url}
                        alt={barber.name}
                        className="h-16 w-16 rounded-full border border-charcoal-light object-cover"
                      />
                    ) : (
                      <DefaultAvatar name={barber.name} className="h-16 w-16 text-xl" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-semibold text-white">{barber.name}</h3>
                    <p className="mt-1 truncate text-sm text-charcoal-muted">{barber.role || 'Profissional'}</p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-charcoal-muted">{barber.specialty || 'Atendimentos'}</p>
                  <button type="button" onClick={()=>setExpandedId(current=>current===barber.id?null:barber.id)} className="mt-2 min-h-9 text-xs font-semibold text-brass">{expandedId===barber.id?'Fechar':'Mostrar mais'}</button>
                </div>
              </div>

              {expandedId === barber.id && <div className="mt-5 space-y-5 border-t border-charcoal-light pt-5">
                <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
                  <div className="w-24">
                    <ImageDropzone onFiles={(files) => uploadPhoto(barber, files)} disabled={uploadingId === barber.id} className="rounded-lg border border-dashed border-charcoal-light px-2 py-2 text-center text-xs text-brass hover:border-brass">{barber.photo_url ? 'Trocar foto' : 'Adicionar foto'}</ImageDropzone>
                    {barber.photo_url && <button type="button" onClick={() => removePhoto(barber)} className="mt-2 block w-full text-xs text-red-400">Remover foto</button>}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-xs text-charcoal-muted">Cargo
                    <input
                      defaultValue={barber.role || ''}
                      onBlur={(e) => updateRole(barber.id, e.target.value)}
                      placeholder="Cargo (ex: Banho e tosa / Tosador)"
                      className="mt-1 min-h-11 w-full rounded-lg border border-charcoal-light bg-charcoal px-3 text-sm text-white focus:border-brass focus:outline-none"
                    />
                    </label>
                    <label className="text-xs text-charcoal-muted">Especialidade
                    <input
                      defaultValue={barber.specialty || ''}
                      onBlur={(e) => updateSpecialty(barber.id, e.target.value)}
                      placeholder="Especialidade"
                      className="mt-1 min-h-11 w-full rounded-lg border border-charcoal-light bg-charcoal px-3 text-sm text-white focus:border-brass focus:outline-none"
                    />
                    </label>
                    {uploadingId === barber.id && (
                      <div className="sm:col-span-2">
                        <ProgressBar value={progress} />
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
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

              <ProfessionalWeekSchedule
                barberId={barber.id}
                schedules={schedules}
                onUpdate={updateSchedule}
                onApplyHours={applyHours}
              />

              <StaffAccessPanel barber={barber} onChanged={load} />
              </div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
