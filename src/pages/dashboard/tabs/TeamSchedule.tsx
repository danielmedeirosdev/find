import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { DAY_NAMES } from '../../../lib/types'
import type { Barber, BarberSchedule } from '../../../lib/types'

interface Props {
  shopId: string
}

export function TeamScheduleTab({ shopId }: Props) {
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [schedules, setSchedules] = useState<BarberSchedule[]>([])
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(true)

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
    await supabase.from('barbers').insert({ shop_id: shopId, name: newName.trim() })
    setNewName('')
    load()
  }

  const removeBarber = async (id: string) => {
    if (!confirm('Remover este funcionário?')) return
    await supabase.from('barbers').delete().eq('id', id)
    load()
  }

  const getSchedule = (barberId: string, day: number) =>
    schedules.find((s) => s.barber_id === barberId && s.day_of_week === day)

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
    load()
  }

  if (loading) return <p className="text-charcoal-muted">Carregando...</p>

  return (
    <div>
      <h2 className="font-display text-2xl text-white mb-6">Equipe e horários</h2>

      <div className="mb-8 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nome do funcionário"
          className="flex-1 rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white focus:border-brass focus:outline-none"
        />
        <button
          onClick={addBarber}
          className="rounded-lg bg-brass px-4 py-2 font-semibold text-charcoal"
        >
          Adicionar
        </button>
      </div>

      {barbers.length === 0 ? (
        <p className="text-charcoal-muted">Nenhum funcionário cadastrado.</p>
      ) : (
        <div className="space-y-8">
          {barbers.map((barber) => (
            <div key={barber.id} className="rounded-lg border border-charcoal-light p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-display text-xl text-brass">{barber.name}</h3>
                <button
                  onClick={() => removeBarber(barber.id)}
                  className="text-sm text-red-400 hover:text-red-300"
                >
                  Remover
                </button>
              </div>

              <div className="space-y-3">
                {DAY_NAMES.map((dayName, dayIndex) => {
                  const sched = getSchedule(barber.id, dayIndex)
                  const isActive = sched?.is_active ?? false
                  return (
                    <div
                      key={dayIndex}
                      className="flex flex-wrap items-center gap-3 rounded bg-charcoal-light/30 p-3"
                    >
                      <label className="flex items-center gap-2 w-28">
                        <input
                          type="checkbox"
                          checked={isActive}
                          onChange={(e) =>
                            updateSchedule(barber.id, dayIndex, 'is_active', e.target.checked)
                          }
                          className="accent-brass"
                        />
                        <span className="text-sm">{dayName}</span>
                      </label>
                      {isActive && (
                        <>
                          <input
                            type="time"
                            value={sched?.start_time?.slice(0, 5) || '09:00'}
                            onChange={(e) =>
                              updateSchedule(barber.id, dayIndex, 'start_time', e.target.value)
                            }
                            className="rounded border border-charcoal-light bg-charcoal px-2 py-1 font-mono text-sm text-white"
                          />
                          <span className="text-charcoal-muted">até</span>
                          <input
                            type="time"
                            value={sched?.end_time?.slice(0, 5) || '18:00'}
                            onChange={(e) =>
                              updateSchedule(barber.id, dayIndex, 'end_time', e.target.value)
                            }
                            className="rounded border border-charcoal-light bg-charcoal px-2 py-1 font-mono text-sm text-white"
                          />
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
