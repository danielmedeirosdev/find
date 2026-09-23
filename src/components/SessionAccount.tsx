import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { BusinessAccount } from './BusinessAccount'
import type { Shop } from '../lib/types'
type Identity = { userId: string; shop: Pick<Shop, 'name' | 'logo_url'> | null; access: 'owner' | 'staff' | 'account' }
export function SessionAccount() {
  const { user, loading } = useAuth()
  const [identity, setIdentity] = useState<Identity | null>(null)
  const userId = user?.id
  useEffect(() => {
    if (!userId) return
    let active = true
    async function load() {
      try {
        const owned = await supabase.from('shops').select('name, logo_url').eq('owner_user_id', userId!).maybeSingle()
        if (owned.error) throw owned.error
        if (owned.data) {
          if (active) setIdentity({ userId: userId!, shop: owned.data, access: 'owner' })
          return
        }
        const staff = await supabase.from('barbers').select('shops(name, logo_url)').eq('user_id', userId!).maybeSingle()
        if (staff.error) throw staff.error
        const raw = staff.data?.shops
        const shop = (Array.isArray(raw) ? raw[0] : raw) || null
        if (active) setIdentity({ userId: userId!, shop, access: shop ? 'staff' : 'account' })
      } catch {
        if (active) setIdentity({ userId: userId!, shop: null, access: 'account' })
      }
    }
    void load()
    return () => { active = false }
  }, [userId])
  // Wait for session restoration instead of flashing a misleading sign-in button.
  if (loading) return <span className="account-loading" aria-label="Carregando conta" />
  if (!user) return <Link className="login-link" to="/painel">Entrar</Link>
  const current = identity?.userId === user.id ? identity : null
  return <BusinessAccount inHeader={false} shop={current?.shop || { name: 'Minha conta', logo_url: null }} access={current?.access || 'account'} />
}
