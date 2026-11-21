import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { operationalFeature } from '../lib/adoption'

/** Foreground observation only, never an operational action or historical session. */
export function OperationalPresence({shopId}:{shopId:string}) {
 const {user}=useAuth()
 const {pathname,search}=useLocation()
 const userId=user?.id
 useEffect(()=>{
  if(!userId || !pathname.startsWith('/painel/dashboard'))return
  const feature=operationalFeature(new URLSearchParams(search).get('aba'))
  let lastInteraction=Date.now(),lastSent=0,inFlight=false
  const send=()=>{
   if(inFlight || document.visibilityState!=='visible' || !document.hasFocus() || Date.now()-lastInteraction>300000 || Date.now()-lastSent<60000)return
   inFlight=true;lastSent=Date.now()
   void supabase.rpc('record_operational_presence',{p_shop_id:shopId,p_feature:feature}).then(()=>{inFlight=false},()=>{inFlight=false})
  }
  const interact=()=>{lastInteraction=Date.now();send()}
  const focus=()=>{if(document.visibilityState==='visible'){lastInteraction=Date.now();send()}}
  document.addEventListener('pointerdown',interact,{passive:true});document.addEventListener('keydown',interact);window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus)
  send();const timer=window.setInterval(send,60000)
  return()=>{clearInterval(timer);document.removeEventListener('pointerdown',interact);document.removeEventListener('keydown',interact);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus)}
 },[userId,shopId,pathname,search])
 return null
}
