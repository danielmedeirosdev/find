import { useEffect, useState } from 'react'
import { supabase } from '../../../../lib/supabase'
import { formatPrice, formatTime, formatDate, formatDuration, bookingStatusLabel } from '../../../../lib/format'
import { petSizeLabel } from '../../../../lib/pet'
import { WhatsAppService } from '../../../../lib/whatsapp'
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
  const [noShows, setNoShows] = useState(0)
  const [unread, setUnread] = useState(0)
  const [packagesLeft, setPackagesLeft] = useState(0)
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
        { data: pkgs },
        { count: noShowCount },
        { count: unreadCount },
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
        supabase
          .from('customer_packages')
          .select('total_sessions, used_sessions')
          .eq('shop_id', shopId)
          .eq('status', 'active'),
        supabase
          .from('bookings')
          .select('*', { count: 'exact', head: true })
          .eq('shop_id', shopId)
          .eq('status', 'no_show')
          .gte('date', monthStr),
        supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('shop_id', shopId)
          .is('read_at', null),
      ])

      setTodayBookings((todayData as BookingWithDetails[]) || [])
      setUpcoming((upData as BookingWithDetails[]) || [])
      setRevenue(((tx as { amount: number }[]) || []).reduce((s, t) => s + Number(t.amount), 0))
      setCustomers(custCount || 0)
      setPets(petCount || 0)
      setPackagesLeft(
        ((pkgs as { total_sessions: number; used_sessions: number }[]) || []).reduce(
          (s, p) => s + Math.max(0, p.total_sessions - p.used_sessions),
          0
        )
      )
      setNoShows(noShowCount || 0)
      setUnread(unreadCount || 0)
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
        <h2 className="font-display text-2xl text-white mb-2">Visão geral</h2>
        <p className="text-sm text-charcoal-muted">
          Operação do pet shop — banho, tosa e cuidados do dia.
          {!WhatsAppService.isConfigured() && (
            <span className="block mt-1 text-charcoal-muted/80">
              WhatsApp Business API ainda não configurado (avisos automáticos em espera).
            </span>
          )}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Atendimentos hoje" value={String(activeToday.length)} />
        <Stat label="Faturamento do mês" value={formatPrice(revenue)} />
        <Stat label="Clientes" value={String(customers)} />
        <Stat label="Pets" value={String(pets)} hint="cadastrados" />
        <Stat label="No-shows" value={String(noShows)} hint="no mês" />
        <Stat label="Notificações" value={String(unread)} hint="não lidas" />
        <Stat label="Pacotes ativos" value={String(packagesLeft)} hint="sessões restantes" />
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'agenda', label: 'Agenda' },
          { id: 'pets', label: 'Pets' },
          { id: 'customers', label: 'Clientes' },
          { id: 'packages', label: 'Pacotes' },
          { id: 'services', label: 'Serviços' },
        ].map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onNavigate(a.id)}
            className="rounded-lg border border-charcoal-light px-4 py-2 text-sm text-charcoal-muted hover:border-brass hover:text-brass"
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
