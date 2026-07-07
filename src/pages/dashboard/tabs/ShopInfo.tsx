import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import type { Shop } from '../../../lib/types'

interface Props {
  shop: Shop
  onUpdate: () => void
}

export function ShopInfoTab({ shop, onUpdate }: Props) {
  const [name, setName] = useState(shop.name)
  const [slogan, setSlogan] = useState(shop.slogan || '')
  const [address, setAddress] = useState(shop.address || '')
  const [phone, setPhone] = useState(shop.phone || '')
  const [hoursText, setHoursText] = useState(shop.hours_text || '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    const { error } = await supabase
      .from('shops')
      .update({
        name: name.trim(),
        slogan: slogan.trim() || null,
        address: address.trim() || null,
        phone: phone.trim() || null,
        hours_text: hoursText.trim() || null,
      })
      .eq('id', shop.id)

    if (error) setMessage(error.message)
    else {
      setMessage('Salvo com sucesso!')
      onUpdate()
    }
    setSaving(false)
  }

  return (
    <form onSubmit={handleSave} className="max-w-xl space-y-4">
      <h2 className="font-display text-2xl text-white mb-4">Informações da loja</h2>

      <div>
        <label className="block text-sm text-charcoal-muted mb-1">Nome</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white focus:border-brass focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm text-charcoal-muted mb-1">Slogan</label>
        <input
          value={slogan}
          onChange={(e) => setSlogan(e.target.value)}
          className="w-full rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white focus:border-brass focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm text-charcoal-muted mb-1">Endereço</label>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white focus:border-brass focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm text-charcoal-muted mb-1">Telefone</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white focus:border-brass focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm text-charcoal-muted mb-1">Horário de funcionamento (texto livre)</label>
        <textarea
          value={hoursText}
          onChange={(e) => setHoursText(e.target.value)}
          rows={3}
          placeholder="Ex: Seg-Sex 9h-19h, Sáb 9h-14h"
          className="w-full rounded-lg border border-charcoal-light bg-charcoal px-4 py-2 text-white focus:border-brass focus:outline-none"
        />
      </div>

      {message && (
        <p className={`text-sm ${message.includes('sucesso') ? 'text-green-400' : 'text-red-400'}`}>
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-brass px-6 py-2 font-semibold text-charcoal disabled:opacity-50"
      >
        {saving ? 'Salvando...' : 'Salvar'}
      </button>
    </form>
  )
}
