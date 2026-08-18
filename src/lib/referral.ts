import { assertAsaasBillingHelpers } from './asaas-billing'
import { PUBLIC_SITE_ORIGIN } from './site'
import { invokeFunction, supabase } from './supabase'
import type { ShopSegment } from './types'

assertAsaasBillingHelpers()

const REF_KEY = 'onefind_referral_code'
const REF_AT_KEY = 'onefind_referral_at'
const MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000

export interface ReferralProgramInfo {
  slug: string
  name: string
  months_per_conversion: number
  milestone_conversions: number
  milestone_bonus_months: number
}

export interface ReferralStats {
  sent: number
  trial: number
  converted: number
  months_available: number
  months_redeemed: number
}

export interface ReferralProgress {
  current: number
  target: number
  remaining: number
}

export interface ReferralRow {
  id: string
  company: string
  segment: ShopSegment | string
  created_at: string
  status: 'trial' | 'converted'
  reward_status: 'available' | 'redeemed' | null
}

export interface ReferralRewardRow {
  id: string
  kind: 'conversion' | 'milestone'
  months: number
  status: 'available' | 'redeemed'
  granted_at: string
  redeemed_at: string | null
  applied_via?: 'trial_extension' | 'asaas_postpone' | string | null
  next_charge_on?: string | null
}

export interface ReferralOverview {
  code: string
  segment: ShopSegment | string
  program: ReferralProgramInfo
  stats: ReferralStats
  progress: ReferralProgress
  referrals: ReferralRow[]
  rewards: ReferralRewardRow[]
}

export function normalizeReferralCode(raw: string | null | undefined): string | null {
  if (!raw) return null
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, '')
  if (/^ONEFIND-[A-Z2-9]{5}$/.test(cleaned)) return cleaned
  if (/^[A-Z2-9]{5}$/.test(cleaned)) return `ONEFIND-${cleaned}`
  return null
}

export function captureReferralCode(raw: string | null | undefined) {
  const code = normalizeReferralCode(raw)
  if (!code || typeof localStorage === 'undefined') return
  localStorage.setItem(REF_KEY, code)
  localStorage.setItem(REF_AT_KEY, String(Date.now()))
}

export function readStoredReferralCode(): string | null {
  if (typeof localStorage === 'undefined') return null
  const code = normalizeReferralCode(localStorage.getItem(REF_KEY))
  const at = Number(localStorage.getItem(REF_AT_KEY) || 0)
  if (!code || !at || Date.now() - at > MAX_AGE_MS) {
    clearStoredReferralCode()
    return null
  }
  return code
}

export function clearStoredReferralCode() {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(REF_KEY)
  localStorage.removeItem(REF_AT_KEY)
}

export function referralPublicUrl(code: string): string {
  return `${PUBLIC_SITE_ORIGIN}/?ref=${encodeURIComponent(code)}`
}

export async function attachStoredReferral(): Promise<void> {
  const code = readStoredReferralCode()
  if (!code) return
  const { data, error } = await supabase.rpc('attach_my_referral', { p_code: code })
  if (error) return
  const reason = (data as { reason?: string } | null)?.reason
  if (reason && reason !== 'invalid_code' && reason !== 'unknown_code' && reason !== 'no_shop') {
    clearStoredReferralCode()
  }
}

export async function fetchReferralOverview(): Promise<ReferralOverview> {
  const { data, error } = await supabase.rpc('get_my_referral_overview')
  if (error) throw error
  return data as ReferralOverview
}

export async function applyReferralReward(rewardId: string): Promise<{
  applied_via?: string
  next_charge_on?: string | null
  months?: number
}> {
  return await invokeFunction('apply-referral-reward', { reward_id: rewardId })
}

export function shareMessage(segment: ShopSegment | string | undefined, link: string): string {
  if (segment === 'pet') {
    return `Estou usando o ONEFIND para organizar meu pet shop. Dá uma olhada e teste pelo meu link: ${link}`
  }
  return `Estou usando o ONEFIND para organizar meu negócio. Dá uma olhada e teste pelo meu link: ${link}`
}

export function whatsappShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`
}

export function referralStatusLabel(row: ReferralRow): string {
  if (row.status === 'trial') return 'Em teste'
  if (row.reward_status === 'redeemed') return 'Recompensa utilizada'
  if (row.reward_status === 'available') return 'Recompensa liberada'
  return 'Cliente'
}

export function referralRewardLabel(row: ReferralRow): string {
  if (row.status !== 'converted') return '—'
  if (row.reward_status === 'redeemed') return '1 mês aplicado'
  return '1 mês grátis'
}

export function segmentLabel(segment: string | undefined): string {
  return segment === 'pet' ? 'Pet' : 'Barbearia'
}
