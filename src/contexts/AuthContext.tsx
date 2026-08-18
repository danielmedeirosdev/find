import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Client } from '../lib/types'

interface AuthContextValue {
  user: User | null
  session: Session | null
  clientProfile: Client | null
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [clientProfile, setClientProfile] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshProfile = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) {
      setClientProfile(null)
      return
    }
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('id', currentUser.id)
      .maybeSingle()
    setClientProfile(data)
  }

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return
      setSession(s)
      setUser(s?.user ?? null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setUser(s?.user ?? null)
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!user) {
      setClientProfile(null)
      return
    }
    const role = String(
      (user.user_metadata as { role?: string } | undefined)?.role || ''
    ).toLowerCase()
    if (role === 'barber' || role === 'staff') {
      setClientProfile(null)
      return
    }
    void refreshProfile()
  }, [user])

  const signOut = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    setClientProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, session, clientProfile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
