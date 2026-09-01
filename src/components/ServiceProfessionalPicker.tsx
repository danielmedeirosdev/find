import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { InlineError } from './EmptyState'
import { userFacingError } from '../lib/userFacingError'
import type { Barber, ServiceBarber } from '../lib/types'

interface Props {
  shopId: string
  serviceId: string
}

export function ServiceProfessionalPicker({ shopId, serviceId }: Props) {
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [mappings, setMappings] = useState<ServiceBarber[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [{ data: professionals, error: barberError }, { data: selected, error: mappingError }] =
      await Promise.all([
        supabase.from('barbers').select('id, shop_id, name, photo_url, role').eq('shop_id', shopId).order('name'),
        supabase.from('service_barbers').select('*').eq('shop_id', shopId).eq('service_id', serviceId),
      ])
    if (barberError || mappingError) {
      setError(userFacingError(barberError || mappingError, 'Não foi possível carregar os profissionais.'))
      return
    }
    setBarbers((professionals as Barber[]) || [])
    setMappings((selected as ServiceBarber[]) || [])
  }, [shopId, serviceId])

  useEffect(() => {
    load()
  }, [load])

  const toggle = async (professionalId: string) => {
    setError('')
    setBusy(true)
    const existing = mappings.find((item) => item.barber_id === professionalId)

    if (mappings.length === 0) {
      const keep = barbers.filter((item) => item.id !== professionalId)
      if (keep.length === 0) {
        setError('O serviço precisa ter pelo menos um profissional disponível.')
        setBusy(false)
        return
      }
      const { error: insertError } = await supabase.from('service_barbers').insert(
        keep.map((item) => ({ service_id: serviceId, barber_id: item.id, shop_id: shopId }))
      )
      if (insertError) setError(userFacingError(insertError, 'Não foi possível atualizar os profissionais.'))
    } else if (existing) {
      if (mappings.length === 1) {
        setError('O serviço precisa ter pelo menos um profissional disponível.')
        setBusy(false)
        return
      }
      const { error: deleteError } = await supabase.from('service_barbers').delete().eq('service_id', serviceId).eq('barber_id', professionalId)
      if (deleteError) setError(userFacingError(deleteError, 'Não foi possível atualizar os profissionais.'))
    } else {
      const { error: insertError } = await supabase.from('service_barbers').insert({ service_id: serviceId, barber_id: professionalId, shop_id: shopId })
      if (insertError) setError(userFacingError(insertError, 'Não foi possível atualizar os profissionais.'))
    }
    await load()
    setBusy(false)
  }

  const allowAll = async () => {
    setError('')
    setBusy(true)
    const { error: deleteError } = await supabase.from('service_barbers').delete().eq('service_id', serviceId)
    if (deleteError) setError(userFacingError(deleteError, 'Não foi possível liberar o serviço para toda a equipe.'))
    await load()
    setBusy(false)
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-white">Profissionais que executam</p>
          <p className="text-xs text-charcoal-muted">O cliente verá somente quem atende todos os serviços escolhidos.</p>
        </div>
        {mappings.length > 0 && <button type="button" onClick={allowAll} disabled={busy} className="text-xs text-brass hover:underline disabled:opacity-50">Liberar para toda a equipe</button>}
      </div>
      {error && <div className="mb-3"><InlineError message={error} /></div>}
      {barbers.length === 0 ? (
        <p className="rounded-xl border border-charcoal-light p-3 text-sm text-charcoal-muted">Cadastre a equipe antes de restringir este serviço.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {barbers.map((professional) => {
            const checked = mappings.length === 0 || mappings.some((item) => item.barber_id === professional.id)
            return (
              <label key={professional.id} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 ${checked ? 'border-brass/40 bg-brass/5 text-white' : 'border-charcoal-light text-charcoal-muted'}`}>
                <input type="checkbox" checked={checked} disabled={busy} onChange={() => toggle(professional.id)} className="accent-[#d6a33d]" />
                <span className="text-sm">{professional.name}</span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
