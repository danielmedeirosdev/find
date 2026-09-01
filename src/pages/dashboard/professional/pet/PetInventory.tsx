import { useCallback, useEffect, useMemo, useState } from 'react'
import { FieldLabel } from '../../../../components/FormHints'
import { Toast } from '../../../../components/MediaUI'
import { formatPrice } from '../../../../lib/format'
import { supabase } from '../../../../lib/supabase'
import type { InventoryProduct } from '../../../../lib/types'

interface Props { shopId: string }

export function PetInventory({ shopId }: Props) {
  const [products, setProducts] = useState<InventoryProduct[]>([])
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [quantity, setQuantity] = useState('0')
  const [minimumStock, setMinimumStock] = useState('0')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('inventory_products').select('*').eq('shop_id', shopId).eq('active', true).order('name')
    if (error) setToast(error.message)
    setProducts((data as InventoryProduct[]) || [])
  }, [shopId])
  useEffect(() => { load() }, [load])

  const lowStock = useMemo(() => products.filter((product) => Number(product.quantity) <= Number(product.minimum_stock)), [products])
  const parseMoney = (value: string) => Number(value.replace(',', '.'))
  const save = async () => {
    const cost = parseMoney(costPrice || '0')
    const sale = parseMoney(salePrice || '0')
    const stock = parseMoney(quantity || '0')
    const minimum = parseMoney(minimumStock || '0')
    if (!name.trim() || [cost, sale, stock, minimum].some((value) => !Number.isFinite(value) || value < 0)) {
      setToast('Revise nome, preços e quantidades do produto.')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('inventory_products').insert({ shop_id: shopId, name: name.trim(), sku: sku.trim() || null, cost_price: cost, sale_price: sale, quantity: stock, minimum_stock: minimum })
    setSaving(false)
    if (error) return setToast(error.message)
    setName(''); setSku(''); setCostPrice(''); setSalePrice(''); setQuantity('0'); setMinimumStock('0')
    setToast('Produto cadastrado.'); load()
  }

  const updateStock = async (product: InventoryProduct, field: 'quantity' | 'minimum_stock', raw: string) => {
    const value = parseMoney(raw)
    if (!Number.isFinite(value) || value < 0) return setToast('Informe uma quantidade válida.')
    const { error } = await supabase.from('inventory_products').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', product.id).eq('shop_id', shopId)
    if (error) return setToast(error.message)
    load()
  }

  return <div className="space-y-8">
    <Toast message={toast} onClose={() => setToast(null)} />
    <div><h2 className="font-display text-2xl text-white">Estoque</h2><p className="mt-1 text-sm text-charcoal-muted">Controle básico de produtos, custos, preços e estoque mínimo.</p></div>
    {lowStock.length > 0 ? <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"><p className="font-medium text-amber-200">{lowStock.length} {lowStock.length === 1 ? 'produto está' : 'produtos estão'} no estoque mínimo.</p><p className="mt-1 text-sm text-amber-100/70">{lowStock.map((product) => product.name).join(' · ')}</p></div> : null}
    <section className="rounded-xl border border-charcoal-light p-5"><h3 className="font-medium text-white">Novo produto</h3><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Input label="Produto" value={name} onChange={setName} />
      <Input label="SKU (opcional)" value={sku} onChange={setSku} />
      <Input label="Preço de compra" value={costPrice} onChange={setCostPrice} inputMode="decimal" />
      <Input label="Preço de venda" value={salePrice} onChange={setSalePrice} inputMode="decimal" />
      <Input label="Quantidade" value={quantity} onChange={setQuantity} inputMode="decimal" />
      <Input label="Estoque mínimo" value={minimumStock} onChange={setMinimumStock} inputMode="decimal" />
    </div><button type="button" onClick={save} disabled={saving} className="mt-4 rounded-lg bg-brass px-4 py-2.5 text-sm font-semibold text-charcoal disabled:opacity-50">{saving ? 'Salvando...' : 'Cadastrar produto'}</button></section>
    {products.length === 0 ? <p className="rounded-xl border border-dashed border-charcoal-light p-6 text-sm text-charcoal-muted">Nenhum produto cadastrado.</p> : <div className="overflow-x-auto rounded-xl border border-charcoal-light"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-charcoal-light/30 text-charcoal-muted"><tr><th className="px-4 py-3">Produto</th><th className="px-4 py-3">Compra</th><th className="px-4 py-3">Venda</th><th className="px-4 py-3">Quantidade</th><th className="px-4 py-3">Mínimo</th></tr></thead><tbody className="divide-y divide-charcoal-light">{products.map((product) => <tr key={product.id} className={Number(product.quantity) <= Number(product.minimum_stock) ? 'bg-amber-500/5' : ''}><td className="px-4 py-3 text-white">{product.name}<span className="block text-xs text-charcoal-muted">{product.sku || 'Sem SKU'}</span></td><td className="px-4 py-3 text-charcoal-muted">{formatPrice(Number(product.cost_price))}</td><td className="px-4 py-3 text-white">{formatPrice(Number(product.sale_price))}</td><td className="px-4 py-3"><StockInput value={product.quantity} onBlur={(value) => updateStock(product, 'quantity', value)} /></td><td className="px-4 py-3"><StockInput value={product.minimum_stock} onBlur={(value) => updateStock(product, 'minimum_stock', value)} /></td></tr>)}</tbody></table></div>}
  </div>
}

function Input({ label, value, onChange, inputMode }: { label: string; value: string; onChange: (value: string) => void; inputMode?: 'decimal' }) {
  return <label><FieldLabel>{label}</FieldLabel><input value={value} onChange={(event) => onChange(event.target.value)} inputMode={inputMode} className="w-full rounded-lg border border-charcoal-light bg-charcoal px-3 py-2 text-white focus:border-brass focus:outline-none" /></label>
}
function StockInput({ value, onBlur }: { value: number; onBlur: (value: string) => void }) {
  return <input aria-label="Quantidade em estoque" key={String(value)} defaultValue={value} inputMode="decimal" onBlur={(event) => onBlur(event.target.value)} className="w-24 rounded border border-charcoal-light bg-charcoal px-2 py-1.5 text-white focus:border-brass focus:outline-none" />
}
