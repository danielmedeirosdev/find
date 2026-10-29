import { useCallback, useEffect, useMemo, useState } from 'react'
import { periodStart, cashTotals } from '../../../lib/finance'
import { InlineError } from '../../../components/EmptyState'
import { supabase } from '../../../lib/supabase'
import { formatPrice } from '../../../lib/format'
import type { Barber, BookingWithDetails, FinancialTransaction } from '../../../lib/types'

interface Props {
  shopId: string
}

type Period = 'today' | 'week' | 'month'


interface BarberStats {
  barber: Barber
  completedCount: number
  revenue: number
  commission: number
  serviceCounts: Record<string, number>
}

export function ReportsTab({ shopId }: Props) {
  const [period, setPeriod] = useState<Period>('month')
  const [packageSales,setPackageSales]=useState(0)
  const [loading, setLoading] = useState(true)
  const [error,setError] = useState('')
  const [transactions, setTransactions] = useState<(FinancialTransaction & {bookings?:{barber_id:string}|null})[]>([])
  const [completedBookings, setCompletedBookings] = useState<BookingWithDetails[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const start = periodStart(period)

    const [{ data: tx, error: txError }, { data: bookings, error: bookingsError }, { data: barb, error: barbersError }, {data:sales,error:salesError}] = await Promise.all([
      supabase
        .from('financial_transactions')
        .select('*, bookings(barber_id)')
        .eq('shop_id', shopId)
        .eq('type', 'entrada')
        .gte('created_at', start),
      supabase
        .from('bookings')
        .select(`
          *,
          barbers(id, name, commission_percent),
          booking_services(service_id, services(name, price))
        `)
        .eq('shop_id', shopId)
        .eq('status', 'completed')
        .gte('completed_at', start),
      supabase.from('barbers').select('*').eq('shop_id', shopId).order('name'),
      supabase.from('customer_packages').select('sale_amount').eq('shop_id',shopId).gte('sold_at',start),
    ])

    setPackageSales((sales||[]).reduce((sum,item)=>sum+Number(item.sale_amount||0),0))
    setError(txError || bookingsError || barbersError || salesError ? 'Não foi possível carregar os relatórios. Tente novamente.' : '')
    setTransactions((tx as FinancialTransaction[]) || [])
    setCompletedBookings((bookings as BookingWithDetails[]) || [])
    setBarbers(barb || [])
    setLoading(false)
  }, [shopId, period])

  useEffect(() => {
    load()
  }, [load])

  const revenue = useMemo(
    () => cashTotals(transactions).income,
    [transactions]
  )

  const completedCount = completedBookings.length
  const paidBookings = new Set(transactions.filter(t=>t.booking_id).map(t=>t.booking_id)).size
  const averageTicket = paidBookings > 0 ? cashTotals(transactions.filter(t=>t.booking_id)).income / paidBookings : 0

  const barberStats = useMemo(() => {
    const statsMap = new Map<string, BarberStats>()

    for (const barber of barbers) {
      statsMap.set(barber.id, {
        barber,
        completedCount: 0,
        revenue: 0,
        commission: 0,
        serviceCounts: {},
      })
    }

    for (const booking of completedBookings) {
      const barberId = booking.barber_id
      const entry = statsMap.get(barberId)
      if (!entry) continue

      entry.completedCount += 1
      const services = (booking.booking_services || []).map((bs) => bs.services)

      for (const s of services) {
        entry.serviceCounts[s.name] = (entry.serviceCounts[s.name] || 0) + 1
      }
    }

    for (const tx of transactions) {
      const entry=tx.bookings?.barber_id ? statsMap.get(tx.bookings.barber_id) : undefined
      if(entry)entry.revenue+=Number(tx.amount)
    }
    for (const entry of statsMap.values()) {
      const pct = entry.barber.commission_percent
      if (pct != null && pct > 0) {
        entry.commission = entry.revenue * (Number(pct) / 100)
      }
    }

    return Array.from(statsMap.values()).filter((s) => s.completedCount > 0 || s.revenue > 0 || barbers.length <= 4)
  }, [barbers, completedBookings, transactions])

  if(error && !loading) return <div><InlineError message={error}/><button type="button" onClick={()=>void load()} className="mt-3 text-brass">Tentar novamente</button></div>

  return (
    <div>
      {error && <InlineError message={error}/>}
      <h2 className="font-display text-2xl text-white mb-6">Relatórios</h2>

      <div className="mb-6 flex gap-2">
        {([
          ['today', 'Hoje'],
          ['week', 'Semana'],
          ['month', 'Mês'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            className={`rounded-lg px-4 py-2 text-sm ${
              period === key
                ? 'bg-brass text-charcoal font-semibold'
                : 'border border-charcoal-light text-charcoal-muted hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-charcoal-muted">Carregando...</p>
      ) : (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-charcoal-light p-4">
              <p className="text-sm text-charcoal-muted">Recebimentos</p>
              <p className="font-mono text-2xl text-brass">{formatPrice(revenue)}</p>
            </div>
            <div className="rounded-lg border border-charcoal-light p-4">
              <p className="text-sm text-charcoal-muted">Atendimentos</p>
              <p className="font-mono text-2xl text-white">{completedCount}</p>
            </div>
            <div className="rounded-lg border border-charcoal-light p-4">
              <p className="text-sm text-charcoal-muted">Ticket médio</p>
              <p className="font-mono text-2xl text-white">{formatPrice(averageTicket)}</p>
            </div>
          </div>

          <div className="mb-6 rounded-lg border border-charcoal-light p-4"><p className="text-sm text-charcoal-muted">Cobranças concluídas no período</p><p className="text-2xl text-brass">{formatPrice(completedBookings.reduce((sum,b)=>sum+Number(b.amount_due||0),0))}</p><p className="mt-2 text-xs text-charcoal-muted">Faturamento a cobrar fora de pacotes, nos atendimentos finalizados com a nova opção de pagamento. Inclui pagos e pendentes. Sessões cobertas não são cobradas novamente. Recebimentos de pacotes continuam no caixa.</p></div>
          <div className="mb-6 rounded-lg border border-charcoal-light p-4"><p className="text-sm text-white">Vendas de pacotes no período: {formatPrice(packageSales)}</p><p className="mt-2 text-xs text-charcoal-muted">Valor das novas vendas, incluindo pagamentos pendentes. O uso de uma sessão não gera outra venda.</p></div><h3 className="font-medium text-white mb-4">Por profissional</h3>
          {barberStats.length === 0 ? (
            <p className="text-charcoal-muted">Nenhum atendimento concluído no período.</p>
          ) : (
            <div className="space-y-4">
              {barberStats.map(({ barber, completedCount, revenue, commission, serviceCounts }) => (
                <div key={barber.id} className="rounded-lg border border-charcoal-light p-4">
                  <div className="flex flex-wrap justify-between gap-2 mb-3">
                    <h4 className="font-display text-lg text-brass">{barber.name}</h4>
                    <p className="font-mono text-brass">{formatPrice(revenue)}</p>
                  </div>
                  <p className="text-sm text-charcoal-muted mb-2">
                    {completedCount} atendimento{completedCount !== 1 ? 's' : ''} concluído
                    {completedCount !== 1 ? 's' : ''}
                  </p>
                  {Object.keys(serviceCounts).length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {Object.entries(serviceCounts).map(([name, count]) => (
                        <span
                          key={name}
                          className="rounded-full bg-charcoal-light px-3 py-1 text-xs text-white"
                        >
                          {name}: {count}
                        </span>
                      ))}
                    </div>
                  )}
                  {barber.commission_percent != null && barber.commission_percent > 0 && (
                    <p className="text-sm text-green-400">
                      Comissão ({barber.commission_percent}%): {formatPrice(commission)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
