import {maskResponsiblePhone} from '../lib/responsibleContact'
export function ResponsiblePhoneField({value,onChange}:{value:string;onChange:(value:string)=>void}) {
 return <label className="block text-sm text-white">WhatsApp com DDD *<input type="tel" autoComplete="tel-national" inputMode="tel" required value={value} onChange={e=>onChange(maskResponsiblePhone(e.target.value))} aria-describedby="responsible-phone-purpose" className="mt-2 w-full rounded-lg border border-charcoal-light bg-charcoal px-4 py-3 text-white focus:border-brass focus:outline-none" placeholder="(11) 91234-5678"/><span id="responsible-phone-purpose" className="mt-2 block text-xs text-charcoal-muted">Podemos entrar em contato para ajudar você a configurar o Onefind.</span></label>
}
