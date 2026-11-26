import {forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react'
import {supabase} from '../lib/supabase'
import type {Shop} from '../lib/types'
import {PetDurationFields} from './PetDurationFields'
import {durationPayload,type PetDurationDraft} from '../lib/pet'
import {SetupSchedules} from './InitialSetup'
export type SetupFormHandle={save:(advance:boolean)=>Promise<Record<string,unknown>>;flush:()=>Promise<void>}
type Draft=Record<string,string|PetDurationDraft>
const input='mt-1 min-h-11 w-full rounded-lg border border-charcoal-light bg-charcoal px-3 text-white'
export const CompactSetupForm=forwardRef<SetupFormHandle,{shop:Shop;step:number;draft?:Record<string,unknown>}>(({shop,step,draft},ref)=>{
 const defaults=():Draft=>({name:step===1?shop.name:'',address:step===1?shop.address||'':'',slogan:step===1?shop.slogan||'':'',role:'',price:'',sessions:'',validity:'',customer_id:'',customer_name:'',customer_phone:'',pet_name:'',size:'',duration:{mode:'single',minutes:'',sizes:{}}})
 const [values,setValues]=useState<Draft>(()=>({...defaults(),...(draft?.values as Draft||{})})),[request,setRequest]=useState(()=>typeof draft?.request==='string'?draft.request:crypto.randomUUID()),[error,setError]=useState(''),[saving,setSaving]=useState(false),[saved,setSaved]=useState(false)
 const [existing,setExisting]=useState<{id:string;name:string}[]>([])
 const snapshot=useRef({values,request}),timer=useRef<ReturnType<typeof setTimeout>|null>(null),pending=useRef(Promise.resolve()),dirty=useRef(false)
 function persist(){if(timer.current)clearTimeout(timer.current);if(!dirty.current)return pending.current;const data=snapshot.current;pending.current=pending.current.catch(()=>{}).then(async()=>{const r=await supabase.rpc('save_initial_setup_draft',{p_shop:shop.id,p_step:step,p_draft:data});if(r.error)throw Error('Não foi possível salvar o rascunho. Tente novamente.');if(snapshot.current===data){dirty.current=false;setSaved(true)}});return pending.current}
 function change(key:string,value:Draft[string]){const next={...snapshot.current.values,[key]:value};snapshot.current={values:next,request:snapshot.current.request};setValues(next);dirty.current=true;setSaved(false);if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>{void persist().catch(e=>setError(e.message))},350)}
 useEffect(()=>{let active=true;const table=step===2?'barbers':step===4?'services':step===5?'shop_customers':step===6?'service_packages':null;if(table)void supabase.from(table).select('id,name').eq('shop_id',shop.id).order('name').then(r=>{if(!active)return;if(r.error)setError('Não foi possível carregar os cadastros existentes.');else setExisting(r.data||[])});return()=>{active=false;if(timer.current)clearTimeout(timer.current)}},[shop.id,step])
 useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(dirty.current){e.preventDefault();e.returnValue=''}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[])
 async function save(advance:boolean){if(saving)throw Error('Aguarde o salvamento.');setSaving(true);setError('');try{await persist();const data:Record<string,unknown>={...snapshot.current.values};if(step===4&&data.name){const duration=durationPayload(data.duration as PetDurationDraft);Object.assign(data,{duration_minutes:duration.p_duration_minutes,...(duration.p_size_durations?{size_durations:duration.p_size_durations}:{})})};const r=await supabase.rpc('save_initial_setup_step',{p_shop:shop.id,p_step:step,p_request:snapshot.current.request,p_data:data,p_advance:advance});if(r.error)throw Error(r.error.message);dirty.current=false;setSaved(true);if(!advance){const reset=defaults(),id=crypto.randomUUID();snapshot.current={values:reset,request:id};setValues(reset);setRequest(id);if(r.data.saved_entity_id)setExisting(x=>[...x,{id:r.data.saved_entity_id,name:String(data.name||data.pet_name)}])}return r.data}catch(e){const message=e instanceof Error?e.message:'Não foi possível salvar.';setError(message);throw e}finally{setSaving(false)}}
 useImperativeHandle(ref,()=>({save,flush:persist}))
 const field=(key:string,label:string,type='text')=><label className="block text-sm text-white">{label}<input type={type} value={String(values[key]||'')} onChange={e=>change(key,e.target.value)} className={input}/></label>
 return <div className="space-y-4" aria-busy={saving}>
 {existing.length>0&&<p className="text-xs text-charcoal-muted">Já cadastrado: {existing.map(x=>x.name).join(', ')}. Não precisa cadastrar novamente.</p>}
 {step===1&&<>{field('name','Nome da loja')}{field('address','Endereço (opcional)')}{field('slogan','Uma frase sobre sua loja (opcional)')}</>}
 {step===2&&<><p className="text-sm text-charcoal-muted">Se você realiza atendimentos, informe seu próprio nome. Não é preciso cadastrar outros funcionários.</p>{field('name','Quem realiza os atendimentos?')}{field('role','Função (opcional)')}</>}
 {step===3&&<SetupSchedules shopId={shop.id}/>}
 {step===4&&<>{field('name','Nome do serviço')}{field('price','Preço (R$)')}<PetDurationFields value={values.duration as PetDurationDraft} onChange={v=>change('duration',v)} disabled={saving}/></>}
 {step===5&&<><label className="block text-sm text-white">Responsável<select className={input} value={String(values.customer_id)} onChange={e=>change('customer_id',e.target.value)}><option value="">Cadastrar novo cliente</option>{existing.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>{!values.customer_id&&<>{field('customer_name','Nome do cliente')}{field('customer_phone','Telefone com DDD','tel')}</>}{field('pet_name','Nome do pet')}<label className="block text-sm text-white">Porte<select className={input} value={String(values.size)} onChange={e=>change('size',e.target.value)}><option value="">Selecione</option><option value="pequeno">Pequeno</option><option value="medio">Médio</option><option value="grande">Grande</option></select></label></>}
 {step===6&&<><p className="text-sm text-charcoal-muted">Não trabalha com pacotes? Pode pular esta etapa.</p>{field('name','Nome do pacote')}{field('sessions','Quantidade de sessões','number')}{field('price','Preço (R$)')}{field('validity','Validade em dias (opcional)','number')}</>}
 {error&&<p role="alert" className="text-sm text-red-400">{error}</p>}{saved&&<p role="status" className="text-xs text-brass">Salvo.</p>}{[2,4,5,6].includes(step)&&<button type="button" disabled={saving} className="min-h-11 rounded-lg border border-brass/30 px-4 text-sm text-brass" onClick={()=>void save(false).catch(()=>{})}>Salvar e adicionar outro</button>}
 <input type="hidden" value={request} readOnly/>
 </div>
})
CompactSetupForm.displayName='CompactSetupForm'
