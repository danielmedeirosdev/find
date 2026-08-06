import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { formatPrice, paymentMethodLabel } from '../../../lib/format'
import type { FinancialTransaction, PaymentMethod } from '../../../lib/types'

interface Props {
  shopId: string
}

type Period = 'today' | 'week' | 'month'

function getPeriodStart(period: Period): string {
  const now = new Date()
  if (period === 'today') {
    return now.toISOString().slice(0, 10)
  }
  if (period === 'week') {
    const start = new Date(now)
    start.setDate(now.getDate() - now.getDay())
    return start.toISOString().slice(0, 10)
  }
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

export function CashFlowTab({ shopId }: Props) {
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([])
  const [period, setPeriod] = useState<Period>('month')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const start = getPeriodStart(period)
    const { data } = await supabase
      .from('financial_transactions')
      .select('*')
      .eq('shop_id', shopId)
      .gte('created_at', `${start}T00:00:00`)
      .order('created_at', { ascending: false })

    setTransactions((data as FinancialTransaction[]) || [])
    setLoading(false)
  }, [shopId, period])

  useEffect(() => {
    load()
  }, [load])

  const balance = useMemo(() => {
    return transactions.reduce((sum, t) => {
      return t.type === 'entrada' ? sum + Number(t.amount) : sum - Number(t.amount)
    }, 0)
  }, [transactions])

  const addExpense = async () => {
    const value = parseFloat(amount.replace(',', '.'))
    if (!description.trim() || isNaN(value) || value <= 0) return

    setSaving(true)
    await supabase.from('financial_transactions').insert({
      shop_id: shopId,
      type: 'saida',
      description: description.trim(),
      amount: value,
      payment_method: paymentMethod,
    })
    setDescription('')
    setAmount('')
    setShowForm(false)
    setSaving(false)
    load()
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-display text-2xl text-white">Fluxo de Caixa</h2>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-lg bg-brass px-4 py-2 text-sm font-semibold text-charcoal"
        >
          + Lançamento manual
        </button>
      </div>

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

      <div className="mb-6 rounded-lg border border-charcoal-light p-4">
        <p className="text-sm text-charcoal-muted">Saldo do período</p>
        <p className={`font-mono text-3xl ${balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {formatPrice(balance)}
        </p>
      </div>

      {showForm && (
        <div className="mb-6 rounded-lg border border-charcoal-light p-4 space-y-4">
          <h3 className="font-medium text-white">Nova despesa</h3>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição (ex: Aluguel)"
            className="w-full rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white focus:border-brass focus:outline-none"
          />
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Valor (ex: 1500.00)"
            className="w-full rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white focus:border-brass focus:outline-none"
          />
          <div className="grid grid-cols-3 gap-2">
            {(['pix', 'cartao', 'dinheiro'] as PaymentMethod[]).map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => setPaymentMethod(method)}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  paymentMethod === method
                    ? 'border-brass bg-brass/10 text-brass'
                    : 'border-charcoal-light text-charcoal-muted'
                }`}
              >
                {paymentMethodLabel(method)}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="flex-1 rounded-lg border border-charcoal-light py-2 text-charcoal-muted"
            >
              Cancelar
            </button>
            <button
              onClick={addExpense}
              disabled={saving}
              className="flex-1 rounded-lg bg-brass py-2 font-semibold text-charcoal disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar despesa'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-charcoal-muted">Carregando...</p>
      ) : transactions.length === 0 ? (
        <p className="text-charcoal-muted">Nenhum lançamento neste período.</p>
      ) : (
        <div className="space-y-3">
          {transactions.map((t) => (
            <div
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-charcoal-light p-4"
            >
              <div>
                <p className="text-white">{t.description}</p>
                <p className="text-xs text-charcoal-muted">
                  {new Date(t.created_at).toLocaleString('pt-BR')} ·{' '}
                  {paymentMethodLabel(t.payment_method)}
                </p>
              </div>
              <p
                className={`font-mono text-lg ${
                  t.type === 'entrada' ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {t.type === 'entrada' ? '+' : '-'}
                {formatPrice(Number(t.amount))}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
