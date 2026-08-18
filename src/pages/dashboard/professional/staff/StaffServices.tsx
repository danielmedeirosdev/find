import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../../lib/supabase'
import { formatDuration, formatPrice } from '../../../../lib/format'
import { EmptyState, InlineError, LoadingBlock } from '../../../../components/EmptyState'
import { userFacingError } from '../../../../lib/userFacingError'
import type { Service } from '../../../../lib/types'

interface Props {
  shopId: string
}

export function StaffServicesTab({ shopId }: Props) {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    const { data, error: qError } = await supabase
      .from('services')
      .select('*')
      .eq('shop_id', shopId)
      .order('name')

    if (qError) {
      setError(userFacingError(qError, 'Não foi possível carregar os serviços.'))
      setServices([])
    } else {
      setServices(data || [])
    }
    setLoading(false)
  }, [shopId])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <LoadingBlock label="Carregando serviços..." />

  return (
    <div>
      <h2 className="font-display text-2xl text-white mb-2">Meus serviços</h2>
      <p className="text-sm text-charcoal-muted mb-6">
        Catálogo do estabelecimento (somente leitura). Alterações são feitas pelo dono.
      </p>
      {error && (
        <div className="mb-4">
          <InlineError message={error} />
        </div>
      )}
      {services.length === 0 ? (
        <EmptyState
          title="Nenhum serviço cadastrado."
          description="Peça ao dono do estabelecimento para cadastrar os serviços oferecidos."
        />
      ) : (
        <ul className="space-y-3">
          {services.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-charcoal-light px-4 py-3"
            >
              <div>
                <p className="text-white font-medium">{s.name}</p>
                <p className="text-xs text-charcoal-muted">{formatDuration(s.duration_minutes)}</p>
              </div>
              <p className="font-mono text-brass">{formatPrice(Number(s.price))}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
