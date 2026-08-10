import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { formatPrice, formatTime, formatDate, bookingStatusLabel } from '../../../lib/format'
import { petSizeLabel } from '../../../lib/pet'
import { WhatsAppService } from '../../../lib/whatsapp'
import type { BookingWithDetails, ShopSegment } from '../../../lib/types'

interface Props {
  shopId: string
  segment: ShopSegment
  onNavigate: (tab: string) => void
}

export function OverviewTab({ shopId, segment, onNavigate }: Props) {
  const isPet = segment === 'pet'
  const [todayBookings, setTodayBookings] = useState<BookingWithDetails[]>([])
  const [upcoming, setUpcoming] = useState<BookingWithDetails[]>([])
  const [revenue, setRevenue] = useState(0)
  const [customers, setCustomers] = useState(0)
  const [pets, setPets] = useState(0)
  const [packagesLeft, setPackagesLeft] = useState(0)
  const [noShows, setNoShows] = useState(0)
  const [unread, setUnread] = useState(0)
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
        pets(id, name, size, photo_url),
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
          .gt('date', today)
          .in('status', ['scheduled', 'confirmed', 'in_progress'])
          .order('date')
          .order('time')
          .limit(5),
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
        isPet
          ? supabase.from('pets').select('*', { count: 'exact', head: true }).eq('shop_id', shopId)
          : Promise.resolve({ count: 0 }),
        isPet
          ? supabase
              .from('customer_packages')
              .select('total_sessions, used_sessions')
              .eq('shop_id', shopId)
              .eq('status', 'active')
          : Promise.resolve({ data: [] }),
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
      setRevenue(
        ((tx as { amount: number }[]) || []).reduce((s, t) => s + Number(t.amount), 0)
      )
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
  }, [shopId, isPet])

  if (loading) return <p className="text-charcoal-muted">Carregando...</p>

  const activeToday = todayBookings.filter(
    (b) => !['cancelled', 'no_show', 'completed'].includes(b.status || 'scheduled')
  )

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl text-white mb-2">Visão geral</h2>
        <p className="text-sm text-charcoal-muted">
          Operação do dia{isPet ? ' — banho e tosa' : ''}.
          {!WhatsAppService.isConfigured() && (
            <span className="block mt-1 text-charcoal-muted/80">
              WhatsApp Business API ainda não configurado (mensagens automáticas em espera).
            </span>
          )}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Hoje" value={String(activeToday.length)} hint="atendimentos" />
        <Stat label="Faturamento (mês)" value={formatPrice(revenue)} />
        <Stat label={isPet ? 'Pets' : 'Clientes'} value={String(isPet ? pets : customers)} />
        <Stat label="No-shows (mês)" value={String(noShows)} />
        {isPet && <Stat label="Sessões de pacote" value={String(packagesLeft)} hint="restantes" />}
        <Stat label="Notificações" value={String(unread)} hint="não lidas" />
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'agenda', label: 'Agenda' },
          ...(isPet
            ? [
                { id: 'pets', label: 'Pets' },
                { id: 'customers', label: 'Clientes' },
                { id: 'packages', label: 'Pacotes' },
              ]
            : []),
          { id: 'notifications', label: 'Notificações' },
          { id: 'services', label: 'Serviços' },
        ].map((a) => (
          <button
            key={a.id}
            onClick={() => onNavigate(a.id)}
            className="rounded-lg border border-charcoal-light px-4 py-2 text-sm text-charcoal-muted hover:border-brass hover:text-brass"
          >
            {a.label}
          </button>
        ))}
      </div>

      <section>
        <h3 className="font-medium text-white mb-3">Agenda de hoje</h3>
        {activeToday.length === 0 ? (
          <p className="text-sm text-charcoal-muted">Nenhum atendimento pendente hoje.</p>
        ) : (
          <div className="space-y-2">
            {activeToday.map((b) => (
              <div
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-charcoal-light px-4 py-3"
              >
                <div>
                  <p className="font-mono text-brass">{formatTime(b.time)}</p>
                  <p className="text-white">
                    {isPet && b.pets
                      ? `${b.pets.name} · ${petSizeLabel(b.pets.size)}`
                      : b.client_name}
                  </p>
                  <p className="text-xs text-charcoal-muted">
                    {(b.booking_services || []).map((bs) => bs.services.name).join(' · ')}
                  </p>
                </div>
                <span className="text-xs text-charcoal-muted">
                  {bookingStatusLabel(b.status || 'scheduled')}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="font-medium text-white mb-3">Próximos</h3>
        {upcoming.length === 0 ? (
          <p className="text-sm text-charcoal-muted">Sem próximos agendamentos.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((b) => (
              <div
                key={b.id}
                className="flex justify-between rounded-lg bg-charcoal-light/30 px-4 py-3 text-sm"
              >
                <span className="text-white">
                  {formatDate(b.date)} {formatTime(b.time)} —{' '}
                  {isPet && b.pets ? b.pets.name : b.client_name}
                </span>
                <span className="text-charcoal-muted">
                  {bookingStatusLabel(b.status || 'scheduled')}
                </span>
              </div>
            ))}
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
