import type {ReceiptView} from '../components/public/ConfirmReceipt'
import {formatDate,formatTime,formatPrice,formatDuration} from './format'
export function receiptLines(view:ReceiptView){
 const total=view.quotedAmount??view.services.reduce((sum,s)=>sum+Number(s.price),0)
 return [view.isPet&&view.petName?`Pet: ${view.petName}`:null,`Cliente: ${view.clientName}`,`Data: ${formatDate(view.date)}`,`Horário: ${formatTime(view.time)} · ${formatDuration(view.durationMinutes)}`,`Profissional: ${view.barberName||'A definir'}`,`Serviços: ${view.services.map(s=>s.name).join(', ')}`,`Valor: ${formatPrice(Number(total))}`,view.notes?`Observação: ${view.notes}`:null,view.petTransportRequested?`Táxi Pet: ${Number(view.petTransportFee)>0?formatPrice(Number(view.petTransportFee)):'valor a confirmar'}`:null,view.petTransportRequested&&view.petTransportAddress?`Busca: ${view.petTransportAddress}`:null,view.petTransportRequested&&view.petTransportNotes?`Instruções: ${view.petTransportNotes}`:null].filter((s):s is string=>!!s)
}
export function receiptMessage(view:ReceiptView){return `${view.clientName.trim()?`Oi, ${view.clientName}!`:'Oi!'} Seu horário na ${view.shopName} está agendado.\n${receiptLines(view).join('\n')}`}
export function receiptWhatsAppUrl(phone:string,message:string){let digits=phone.replace(/\D/g,'');if(digits.length===10||digits.length===11)digits='55'+digits;return /^\d{12,15}$/.test(digits)?`https://wa.me/${digits}?text=${encodeURIComponent(message)}`:null}
export function wrapReceiptText(text:string,measure:(s:string)=>number,max:number){
 const result:string[]=[];let line='';for(const token of text.split(/\s+/)){const next=line?line+' '+token:token;if(measure(next)<=max){line=next;continue}if(line)result.push(line);line='';for(const ch of Array.from(token)){if(line&&measure(line+ch)>max){result.push(line);line=''}line+=ch}}if(line)result.push(line);return result
}
/** Generated locally: no customer information is uploaded to an image service. */
export async function receiptImage(view:ReceiptView):Promise<File>{
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');if(!ctx)throw Error('Não foi possível preparar a imagem.')
 const width=1000,padding=64;ctx.font='32px system-ui, sans-serif'
 const title=wrapReceiptText(view.shopName,s=>ctx.measureText(s).width,width-padding*2)
 const rows=receiptLines(view).map(text=>wrapReceiptText(text,s=>ctx.measureText(s).width,width-padding*2))
 const height=300+title.length*46+rows.reduce((n,r)=>n+r.length*46+24,0)
 canvas.width=width;canvas.height=height;ctx.fillStyle='#17191b';ctx.fillRect(0,0,width,height)
 ctx.fillStyle='#d0b477';ctx.font='bold 34px system-ui, sans-serif';ctx.fillText('onefind',padding,76)
 ctx.fillStyle='#ffffff';ctx.font='bold 38px system-ui, sans-serif';ctx.fillText('Agendamento confirmado',padding,146)
 ctx.fillStyle='#d0b477';ctx.font='32px system-ui, sans-serif';let y=206;for(const line of title){ctx.fillText(line,padding,y);y+=46}
 ctx.fillStyle='#f5f3ed';ctx.font='32px system-ui, sans-serif';y+=30;for(const row of rows){for(const line of row){ctx.fillText(line,padding,y);y+=46}y+=24}
 ctx.fillStyle='#d0b477';ctx.fillRect(padding,height-55,width-padding*2,2)
 const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Não foi possível gerar o comprovante.')),'image/png'))
 return new File([blob],`comprovante-${view.date}.png`,{type:'image/png'})
}
