import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { DefaultAvatar } from '../../../../components/MediaUI'
import { bookingStatusLabel, formatDate, formatDuration, formatPrice, formatTime } from '../../../../lib/format'
import { PET_BUSINESS_TYPES } from '../../../../lib/onboarding'
import { petSizeLabel } from '../../../../lib/pet'
import { supabase } from '../../../../lib/supabase'
import type { Barber, BookingWithDetails, FinancialTransaction, Pet, PetBusinessType } from '../../../../lib/types'

interface Props {
  shopId: string
  businessType?: PetBusinessType | null
  onNavigate: (tab: string) => void
}

type TeamMetric = Pick<Barber, 'id' | 'name'> & { appointments: number; revenue: number }

function localDate(value = new Date()) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

function addDays(date: Date, days: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function customerKey(booking: BookingWithDetails) {
  return booking.shop_customer_id || booking.client_phone?.replace(/\D/g, '') || booking.client_name
}

export function PetOverview({ shopId, businessType, onNavigate }: Props) {
  const [todayBookings, setTodayBookings] = useState<BookingWithDetails[]>([])
  const [monthBookings, setMonthBookings] = useState<BookingWithDetails[]>([])
  const [historyBookings, setHistoryBookings] = useState<BookingWithDetails[]>([])
  const [upcoming, setUpcoming] = useState<BookingWithDetails[]>([])
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([])
  const [team, setTeam] = useState<Pick<Barber, 'id' | 'name'>[]>([])
  const [petRows, setPetRows] = useState<Pet[]>([])
  const [customers, setCustomers] = useState(0)
  const [newCustomers, setNewCustomers] = useState(0)
  const [lowStockCount, setLowStockCount] = useState(0)
  const [vaccinesDueCount, setVaccinesDueCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      const now = new Date()
      const today = localDate(now)
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const historyStart = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
      const select = `
        *, barbers(name),
        pets!bookings_pet_id_fkey(id, name, size, photo_url, breed),
        booking_pets(pet_id, pets(id, name, size, photo_url, breed)),
        booking_services(service_id, services(name, price, duration_minutes))
      `
      const results = await Promise.all([
        supabase.from('bookings').select(select).eq('shop_id', shopId).eq('date', today).order('time'),
        supabase.from('bookings').select(select).eq('shop_id', shopId).gte('date', localDate(monthStart)).lt('date', localDate(nextMonthStart)).order('date').order('time'),
        supabase.from('bookings').select(select).eq('shop_id', shopId).eq('status', 'completed').gte('date', localDate(historyStart)).order('date', { ascending: false }).limit(2000),
        supabase.from('bookings').select(select).eq('shop_id', shopId).gte('date', today).in('status', ['scheduled', 'confirmed', 'in_progress']).order('date').order('time').limit(8),
        supabase.from('financial_transactions').select('*').eq('shop_id', shopId).gte('created_at', previousMonthStart.toISOString()),
        supabase.from('barbers').select('id, name').eq('shop_id', shopId).order('name'),
        supabase.from('pets').select('*, shop_customers(*)').eq('shop_id', shopId).order('next_recommended_visit'),
        supabase.from('shop_customers').select('*', { count: 'exact', head: true }).eq('shop_id', shopId),
        supabase.from('shop_customers').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).gte('created_at', monthStart.toISOString()),
        supabase.from('inventory_products').select('quantity, minimum_stock').eq('shop_id', shopId).eq('active', true),
        supabase.from('pet_vaccinations').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).lte('next_due_date', localDate(addDays(now, 30))),
      ])
      if (!active) return
      const firstError = results.find((result) => result.error)?.error
      if (firstError) {
        console.error('[PetOverview] dashboard load failed', firstError)
        setLoadError('Alguns indicadores não puderam ser carregados. Tente novamente.')
      }
      setTodayBookings((results[0].data as BookingWithDetails[]) || [])
      setMonthBookings((results[1].data as BookingWithDetails[]) || [])
      setHistoryBookings((results[2].data as BookingWithDetails[]) || [])
      setUpcoming((results[3].data as BookingWithDetails[]) || [])
      setTransactions((results[4].data as FinancialTransaction[]) || [])
      setTeam((results[5].data as Pick<Barber, 'id' | 'name'>[]) || [])
      setPetRows((results[6].data as Pet[]) || [])
      setCustomers(results[7].count || 0)
      setNewCustomers(results[8].count || 0)
      setLowStockCount(((results[9].data as { quantity: number; minimum_stock: number }[]) || []).filter((row) => Number(row.quantity) <= Number(row.minimum_stock)).length)
      setVaccinesDueCount(results[10].count || 0)
      setLoading(false)
    }
    load()
    return () => { active = false }
  }, [shopId])

  const metrics = useMemo(() => {
    const now = new Date()
    const today = localDate(now)
    const inTwoWeeks = localDate(addDays(now, 14))
    const ninetyDaysAgo = localDate(addDays(now, -90))
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    const periodMatches = (value: string, offset: number) => {
      const date = new Date(value)
      const period = new Date(currentYear, currentMonth + offset, 1)
      return date.getMonth() === period.getMonth() && date.getFullYear() === period.getFullYear()
    }
    const currentTransactions = transactions.filter((row) => periodMatches(row.created_at, 0))
    const previousTransactions = transactions.filter((row) => periodMatches(row.created_at, -1))
    const income = currentTransactions.filter((row) => row.type === 'entrada').reduce((sum, row) => sum + Number(row.amount), 0)
    const expenses = currentTransactions.filter((row) => row.type === 'saida').reduce((sum, row) => sum + Number(row.amount), 0)
    const previousIncome = previousTransactions.filter((row) => row.type === 'entrada').reduce((sum, row) => sum + Number(row.amount), 0)
    const paidBookings = new Set(currentTransactions.filter((row) => row.type === 'entrada' && row.booking_id).map((row) => row.booking_id)).size
    const completed = monthBookings.filter((booking) => booking.status === 'completed')
    const bookingRevenue = new Map<string, number>()
    currentTransactions.forEach((row) => {
      if (row.type === 'entrada' && row.booking_id) bookingRevenue.set(row.booking_id, (bookingRevenue.get(row.booking_id) || 0) + Number(row.amount))
    })
    const teamMetrics: TeamMetric[] = team.map((professional) => {
      const bookings = completed.filter((booking) => booking.barber_id === professional.id)
      return { ...professional, appointments: bookings.length, revenue: bookings.reduce((sum, booking) => sum + (bookingRevenue.get(booking.id) || 0), 0) }
    }).sort((a, b) => b.appointments - a.appointments)
    const serviceCounts = new Map<string, number>()
    completed.forEach((booking) => (booking.booking_services || []).forEach((row) => serviceCounts.set(row.services.name, (serviceCounts.get(row.services.name) || 0) + 1)))
    const topServices = [...serviceCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    const visitsByCustomer = new Map<string, number>()
    const lastVisitByCustomer = new Map<string, string>()
    historyBookings.forEach((booking) => {
      const key = customerKey(booking)
      visitsByCustomer.set(key, (visitsByCustomer.get(key) || 0) + 1)
      if (!lastVisitByCustomer.has(key)) lastVisitByCustomer.set(key, booking.date)
    })
    const recurringCustomers = [...visitsByCustomer.values()].filter((visits) => visits >= 2).length
    const activeToday = todayBookings.filter((booking) => !['cancelled', 'no_show', 'completed'].includes(booking.status || 'scheduled'))
    const expectedToday = activeToday.reduce((sum, booking) => sum + (booking.booking_services || []).reduce((serviceSum, row) => serviceSum + Number(row.services.price || 0), 0), 0)
    return {
      income, expenses, net: income - expenses, previousIncome,
      ticket: paidBookings > 0 ? income / paidBookings : 0,
      incomeChange: previousIncome > 0 ? ((income - previousIncome) / previousIncome) * 100 : null,
      activeToday, expectedToday, completed,
      cancellations: monthBookings.filter((booking) => booking.status === 'cancelled').length,
      noShows: monthBookings.filter((booking) => booking.status === 'no_show').length,
      recurringCustomers,
      returnRate: visitsByCustomer.size > 0 ? (recurringCustomers / visitsByCustomer.size) * 100 : 0,
      inactiveCustomers: [...lastVisitByCustomer.values()].filter((date) => date < ninetyDaysAgo).length,
      upcomingReturns: petRows.filter((pet) => pet.next_recommended_visit && pet.next_recommended_visit >= today && pet.next_recommended_visit <= inTwoWeeks),
      overdueReturns: petRows.filter((pet) => pet.next_recommended_visit && pet.next_recommended_visit < today),
      teamMetrics, topServices,
    }
  }, [historyBookings, monthBookings, petRows, team, todayBookings, transactions])

  if (loading) return <p className="text-charcoal-muted">Carregando visão geral...</p>
  const businessLabel = PET_BUSINESS_TYPES.find((option) => option.value === businessType)?.label

  return (
    <div className="space-y-9">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-brass">Visão geral</p>
          <h2 className="mt-2 font-display text-2xl text-white">Seu negócio PET em um só lugar</h2>
          <p className="mt-1 text-sm text-charcoal-muted">{businessLabel ? `${businessLabel} · ` : ''}agenda, financeiro, clientes e retorno.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <QuickAction label="Abrir agenda" tab="agenda" onNavigate={onNavigate} />
          <QuickAction label="Cadastrar pet" tab="pets" onNavigate={onNavigate} />
          <QuickAction label="Link público" tab="link" onNavigate={onNavigate} />
        </div>
      </div>
      {loadError ? <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{loadError}</p> : null}

      <DashboardSection title="Resumo de hoje">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Atendimentos" value={String(metrics.activeToday.length)} hint="ativos hoje" />
          <Stat label="Receita prevista" value={formatPrice(metrics.expectedToday)} hint="pelos serviços agendados" />
          <Stat label="Próximos" value={String(upcoming.length)} hint="na fila da agenda" />
          <Stat label="Concluídos" value={String(todayBookings.filter((booking) => booking.status === 'completed').length)} hint="hoje" />
        </div>
      </DashboardSection>

      <div className="grid gap-8 xl:grid-cols-2">
        <DashboardSection title="Financeiro" action="Abrir financeiro" onAction={() => onNavigate('cashflow')}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Stat label="Receita do mês" value={formatPrice(metrics.income)} />
            <Stat label="Despesas" value={formatPrice(metrics.expenses)} />
            <Stat label="Receita líquida" value={formatPrice(metrics.net)} />
            <Stat label="Ticket médio" value={formatPrice(metrics.ticket)} />
            <Stat label="Mês anterior" value={formatPrice(metrics.previousIncome)} />
            <Stat label="Evolução" value={metrics.incomeChange === null ? '—' : `${metrics.incomeChange >= 0 ? '+' : ''}${metrics.incomeChange.toFixed(1)}%`} hint={metrics.incomeChange === null ? 'sem base anterior' : 'contra o mês anterior'} />
          </div>
        </DashboardSection>
        <DashboardSection title="Clientes e pets" action="Ver pets" onAction={() => onNavigate('pets')}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Stat label="Clientes" value={String(customers)} hint="cadastrados" />
            <Stat label="Pets" value={String(petRows.length)} hint="cadastrados" />
            <Stat label="Novos clientes" value={String(newCustomers)} hint="este mês" />
            <Stat label="Recorrentes" value={String(metrics.recurringCustomers)} hint="2+ visitas em 12 meses" />
            <Stat label="Taxa de retorno" value={`${metrics.returnRate.toFixed(1)}%`} hint="na base atendida" />
            <Stat label="Inativos" value={String(metrics.inactiveCustomers)} hint="sem visita há 90 dias" />
          </div>
        </DashboardSection>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.4fr_1fr]">
        <DashboardSection title="Próximos atendimentos" action="Ver agenda" onAction={() => onNavigate('agenda')}>
          {upcoming.length === 0 ? <EmptyLine>Nenhum atendimento agendado.</EmptyLine> : <div className="space-y-2">{upcoming.map((booking) => <UpcomingBooking key={booking.id} booking={booking} />)}</div>}
        </DashboardSection>
        <DashboardSection title="Agenda do mês">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Agendamentos" value={String(monthBookings.length)} />
            <Stat label="Concluídos" value={String(metrics.completed.length)} />
            <Stat label="Cancelamentos" value={String(metrics.cancellations)} />
            <Stat label="Faltas" value={String(metrics.noShows)} />
          </div>
        </DashboardSection>
      </div>

      <div className="grid gap-8 xl:grid-cols-2">
        <DashboardSection title="Equipe" action="Gerenciar equipe" onAction={() => onNavigate('team')}>
          {metrics.teamMetrics.length === 0 ? <EmptyLine>Nenhum profissional cadastrado.</EmptyLine> : <MetricList rows={metrics.teamMetrics.slice(0, 5).map((professional) => ({ label: professional.name, value: `${professional.appointments} atend. · ${formatPrice(professional.revenue)}` }))} />}
        </DashboardSection>
        <DashboardSection title="Serviços mais realizados" action="Ver serviços" onAction={() => onNavigate('services')}>
          {metrics.topServices.length === 0 ? <EmptyLine>Os serviços aparecem após os primeiros atendimentos concluídos.</EmptyLine> : <MetricList rows={metrics.topServices.map(([label, count]) => ({ label, value: String(count) }))} />}
        </DashboardSection>
      </div>

      <DashboardSection title="Alertas de relacionamento">
        <div className="grid gap-3 md:grid-cols-3">
          <AlertCard title="Retornos próximos" value={metrics.upcomingReturns.length} description="Pets com retorno recomendado nos próximos 14 dias." onClick={() => onNavigate('pets')} />
          <AlertCard title="Retornos atrasados" value={metrics.overdueReturns.length} description="Pets que já passaram da data recomendada." onClick={() => onNavigate('pets')} />
          <AlertCard title="Clientes inativos" value={metrics.inactiveCustomers} description="Clientes atendidos sem nova visita há mais de 90 dias." onClick={() => onNavigate('customers')} />
          {(businessType === 'pet_shop' || businessType === 'mixed') ? <AlertCard title="Estoque baixo" value={lowStockCount} description="Produtos no nível mínimo ou abaixo dele." onClick={() => onNavigate('inventory')} /> : null}
          {(businessType === 'veterinary_clinic' || businessType === 'mixed') ? <AlertCard title="Vacinas próximas" value={vaccinesDueCount} description="Vacinas com vencimento nos próximos 30 dias ou em atraso." onClick={() => onNavigate('clinical')} /> : null}
        </div>
      </DashboardSection>
    </div>
  )
}

function DashboardSection({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: ReactNode }) {
  return <section><div className="mb-3 flex items-center justify-between gap-3"><h3 className="font-medium text-white">{title}</h3>{action && onAction ? <button type="button" onClick={onAction} className="text-sm text-brass hover:text-brass-light">{action}</button> : null}</div>{children}</section>
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="rounded-xl border border-charcoal-light bg-charcoal-light/30 p-4"><p className="text-xs uppercase tracking-wider text-charcoal-muted">{label}</p><p className="mt-1 font-display text-2xl text-brass">{value}</p>{hint ? <p className="mt-0.5 text-xs text-charcoal-muted">{hint}</p> : null}</div>
}

function QuickAction({ label, tab, onNavigate }: { label: string; tab: string; onNavigate: (tab: string) => void }) {
  return <button type="button" onClick={() => onNavigate(tab)} className="rounded-lg border border-charcoal-light px-3.5 py-2 text-sm text-charcoal-muted hover:border-brass hover:text-brass">{label}</button>
}

function UpcomingBooking({ booking }: { booking: BookingWithDetails }) {
  const services = (booking.booking_services || []).map((row) => row.services.name).join(' · ')
  const duration = booking.duration_minutes || (booking.booking_services || []).reduce((sum, row) => sum + (row.services.duration_minutes || 0), 0)
  return <div className="flex flex-wrap items-start gap-3 rounded-xl border border-charcoal-light p-4">
    {booking.pets?.photo_url ? <img src={booking.pets.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : <DefaultAvatar name={booking.pets?.name || booking.client_name} className="h-10 w-10" />}
    <div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline gap-2"><span className="font-mono text-brass">{booking.date === localDate() ? formatTime(booking.time) : `${formatDate(booking.date)} ${formatTime(booking.time)}`}</span><span className="font-medium text-white">{booking.pets?.name || 'Pet'}</span>{booking.pets?.size ? <span className="text-xs text-charcoal-muted">{petSizeLabel(booking.pets.size)}</span> : null}</div><p className="text-sm text-charcoal-muted">{booking.client_name}{booking.barbers?.name ? ` · ${booking.barbers.name}` : ''}</p><p className="mt-0.5 text-xs text-charcoal-muted">{services || 'Serviço'}{duration > 0 ? ` · ${formatDuration(duration)}` : ''}</p></div>
    <span className="text-xs text-charcoal-muted">{bookingStatusLabel(booking.status || 'scheduled')}</span>
  </div>
}

function MetricList({ rows }: { rows: { label: string; value: string }[] }) {
  return <div className="divide-y divide-charcoal-light rounded-xl border border-charcoal-light">{rows.map((row) => <div key={row.label} className="flex items-center justify-between gap-3 px-4 py-3 text-sm"><span className="text-white">{row.label}</span><span className="font-mono text-charcoal-muted">{row.value}</span></div>)}</div>
}

function AlertCard({ title, value, description, onClick }: { title: string; value: number; description: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="rounded-xl border border-charcoal-light bg-charcoal-light/30 p-4 text-left hover:border-brass/50"><span className="font-display text-2xl text-brass">{value}</span><span className="mt-1 block font-medium text-white">{title}</span><span className="mt-1 block text-sm text-charcoal-muted">{description}</span></button>
}

function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-charcoal-light p-5 text-sm text-charcoal-muted">{children}</p>
}
