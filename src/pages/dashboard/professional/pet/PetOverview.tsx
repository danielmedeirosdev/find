import { useEffect, useState } from 'react'
import { supabase } from '../../../../lib/supabase'
import { formatPrice, formatTime, formatDate, formatDuration, bookingStatusLabel } from '../../../../lib/format'
import { petSizeLabel } from '../../../../lib/pet'
import { DefaultAvatar } from '../../../../components/MediaUI'
import type { BookingWithDetails } from '../../../../lib/types'

interface Props {
  shopId: string
  onNavigate: (tab: string) => void
}

export function PetOverview({ shopId, onNavigate }: Props) {
  const [todayBookings, setTodayBookings] = useState<BookingWithDetails[]>([])
  const [upcoming, setUpcoming] = useState<BookingWithDetails[]>([])
  const [revenue, setRevenue] = useState(0)
  const [customers, setCustomers] = useState(0)
  const [pets, setPets] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().slice(0, 10)
      const monthStart = new Date()
      monthStart.setDate(1)
      const monthStr = monthStart.toISOString().slice(0, 10)

      const select = `
        *,
        barbers(name),
        pets(id, name, size, photo_url, breed),
        booking_services(service_id, services(name, price, duration_minutes))
      `

      const [
        { data: todayData },
        { data: upData },
        { data: tx },
        { count: custCount },
        { count: petCount },
      ] = await Promise.all([
        supabase
          .from('bookings')
          .select(select)
          .eq('shop_id', shopId)
          .eq('date', today)
          .order('time'),
        supabase
          .from('bookings')
          .select(select)
          .eq('shop_id', shopId)
          .gte('date', today)
          .in('status', ['scheduled', 'confirmed', 'in_progress'])
          .order('date')
          .order('time')
          .limit(8),
        supabase
          .from('financial_transactions')
          .select('amount')
          .eq('shop_id', shopId)
          .eq('type', 'entrada')
          .gte('created_at', monthStr),
        supabase
          .from('shop_customers')
          .select('*', { count: 'exact', head: true })
          .eq('shop_id', shopId),
        supabase.from('pets').select('*', { count: 'exact', head: true }).eq('shop_id', shopId),
      ])

      setTodayBookings((todayData as BookingWithDetails[]) || [])
      setUpcoming((upData as BookingWithDetails[]) || [])
      setRevenue(((tx as { amount: number }[]) || []).reduce((s, t) => s + Number(t.amount), 0))
      setCustomers(custCount || 0)
      setPets(petCount || 0)
      setLoading(false)
    }
    load()
  }, [shopId])

  if (loading) return <p className="text-charcoal-muted">Carregando...</p>

  const activeToday = todayBookings.filter(
    (b) => !['cancelled', 'no_show', 'completed'].includes(b.status || 'scheduled')
  )

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl text-white mb-2">Início</h2>
        <p className="text-sm text-charcoal-muted">
          O que importa hoje: agenda, pets e atendimentos.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Hoje" value={String(activeToday.length)} hint="atendimentos" />
        <Stat label="Faturamento" value={formatPrice(revenue)} hint="este mês" />
        <Stat label="Pets" value={String(pets)} />
        <Stat label="Donos" value={String(customers)} />
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'agenda', label: 'Abrir agenda' },
          { id: 'pets', label: 'Cadastrar pet' },
          { id: 'customers', label: 'Donos' },
          { id: 'services', label: 'Serviços' },
          { id: 'link', label: 'Link para clientes' },
        ].map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onNavigate(a.id)}
            className="rounded-lg border border-charcoal-light px-4 py-2.5 text-sm text-charcoal-muted hover:border-brass hover:text-brass"
          >
            {a.label}
          </button>
        ))}
      </div>

      <section>
        <h3 className="font-medium text-white mb-3">Próximos atendimentos</h3>
        {upcoming.length === 0 ? (
          <p className="text-sm text-charcoal-muted">Nenhum atendimento agendado.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((b) => {
              const services = (b.booking_services || []).map((bs) => bs.services.name).join(' · ')
              const duration =
                b.duration_minutes ||
                (b.booking_services || []).reduce(
                  (sum, bs) => sum + (bs.services.duration_minutes || 0),
                  0
                )
              return (
                <div
                  key={b.id}
                  className="flex flex-wrap items-start gap-3 rounded-lg border border-charcoal-light px-4 py-3"
                >
                  {b.pets?.photo_url ? (
                    <img
                      src={b.pets.photo_url}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <DefaultAvatar name={b.pets?.name || b.client_name} className="h-10 w-10" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-mono text-brass">
                        {b.date === new Date().toISOString().slice(0, 10)
                          ? formatTime(b.time)
                          : `${formatDate(b.date)} ${formatTime(b.time)}`}
                      </span>
                      <span className="font-medium text-white">{b.pets?.name || 'Pet'}</span>
                      {b.pets?.size && (
                        <span className="text-xs text-charcoal-muted">
                          {petSizeLabel(b.pets.size)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-charcoal-muted">
                      Responsável: {b.client_name}
                      {b.barbers?.name ? ` · ${b.barbers.name}` : ''}
                    </p>
                    <p className="text-xs text-charcoal-muted mt-0.5">
                      {services || 'Serviço'}
                      {duration > 0 ? ` · ${formatDuration(duration)}` : ''}
                    </p>
                  </div>
                  <span className="text-xs text-charcoal-muted">
                    {bookingStatusLabel(b.status || 'scheduled')}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-charcoal-light p-4">
      <p className="text-xs uppercase tracking-wider text-charcoal-muted">{label}</p>
      <p className="mt-1 font-display text-2xl text-brass">{value}</p>
      {hint && <p className="text-xs text-charcoal-muted">{hint}</p>}
    </div>
  )
}
