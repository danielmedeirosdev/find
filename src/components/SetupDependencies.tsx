import {useState} from 'react'
import {supabase} from '../lib/supabase'
import type {Shop} from '../lib/types'
import {SetupContent,SetupWindow} from './InitialSetup'
/** Keeps the caller mounted: its partially filled form remains untouched. */
export function SetupDependencies({shopId,steps,onResolved}:{shopId:string;steps:number[];onResolved:()=>void}) {
 const [step,setStep]=useState<number|null>(null),[shop,setShop]=useState<Shop|null>(null),[error,setError]=useState('')
 async function open(n:number){const r=await supabase.from('shops').select('*').eq('id',shopId).single();if(r.error){setError('Não foi possível abrir a configuração.');return}setShop(r.data);setStep(n)}
 const labels:Record<number,string>={2:'Cadastrar profissional',3:'Definir horários',4:'Cadastrar serviço',5:'Cadastrar cliente e pet',6:'Criar modelo de pacote'}
 return <div className="my-3 space-y-2 rounded-xl border border-brass/25 p-3"><p className="text-sm text-charcoal-muted">Precisa preparar algum cadastro? Resolva aqui e continue de onde parou.</p><div className="flex flex-wrap gap-2">{steps.map(n=><button type="button" key={n} className="min-h-11 rounded-lg border border-brass/30 px-3 text-sm text-brass" onClick={()=>void open(n)}>{labels[n]}</button>)}</div>{error&&<p role="alert">{error}</p>}{step&&shop&&<SetupWindow title={labels[step]} onClose={()=>{setStep(null);onResolved()}} footer={<button type="button" onClick={()=>{setStep(null);onResolved()}} className="min-h-11 rounded-lg bg-brass px-4 text-charcoal">Voltar ao que estava fazendo</button>}><SetupContent step={step} shop={shop} onUpdate={()=>void open(step)}/></SetupWindow>}</div>
}
