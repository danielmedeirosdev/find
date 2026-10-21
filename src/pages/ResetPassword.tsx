import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, authErrorMessage } from '../lib/supabase'
import { isPasswordStrong, PasswordRequirements } from '../components/FormHints'

export function ResetPassword() {
  const navigate=useNavigate()
  const [ready,setReady]=useState(false)
  const [error,setError]=useState('')
  const [password,setPassword]=useState('')
  const [confirm,setConfirm]=useState('')
  const [saving,setSaving]=useState(false)

  useEffect(()=>{
    let active=true
    const check=async()=>{
      const {data}=await supabase.auth.getSession()
      if(active && data.session)setReady(true)
    }
    void check()
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event)=>{
      if(event==='PASSWORD_RECOVERY' || event==='SIGNED_IN')setReady(true)
    })
    const timeout=window.setTimeout(()=>{if(active)setError(prev=>prev||'Link inválido ou expirado. Solicite outro no login.')},8000)
    return()=>{active=false;subscription.unsubscribe();window.clearTimeout(timeout)}
  },[])

  async function submit(e:FormEvent){
    e.preventDefault()
    if(!isPasswordStrong(password)){setError('A senha não atende aos requisitos.');return}
    if(password!==confirm){setError('As senhas não coincidem.');return}
    setSaving(true);setError('')
    const {error:err}=await supabase.auth.updateUser({password})
    if(err){setError(authErrorMessage(err));setSaving(false);return}
    navigate('/painel/dashboard',{replace:true})
  }

  return <main className="mx-auto max-w-md px-4 py-16 space-y-5">
    <h1 className="font-display text-3xl">Redefinir senha</h1>
    {!ready && !error && <p>Validando seu link de recuperação...</p>}
    {error && <p role="alert" className="text-red-600">{error}</p>}
    {ready && <form onSubmit={submit} className="space-y-4">
      <p>Escolha uma nova senha para entrar no onefind.</p>
      <label className="block">Nova senha<input type="password" autoComplete="new-password" required className="mt-1 block w-full rounded border p-3" value={password} onChange={e=>setPassword(e.target.value)}/></label>
      <PasswordRequirements password={password} tone="light"/>
      <label className="block">Confirmar senha<input type="password" autoComplete="new-password" required className="mt-1 block w-full rounded border p-3" value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
      <button type="submit" disabled={saving||!isPasswordStrong(password)||password!==confirm} className="w-full rounded-xl bg-brass px-5 py-3 font-semibold disabled:opacity-50">{saving?'Salvando...':'Salvar nova senha'}</button>
    </form>}
    <Link to="/painel" className="block underline">Voltar ao login</Link>
  </main>
}
