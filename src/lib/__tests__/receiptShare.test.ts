import {describe,it,expect} from 'vitest'
import {receiptLines,receiptMessage,receiptWhatsAppUrl,wrapReceiptText} from '../receiptShare'
import type {ReceiptView} from '../../components/public/ConfirmReceipt'
const view:ReceiptView={isPet:true,shopName:'Loja QA',clientName:'Cliente QA',clientPhone:'55912345678',date:'2026-11-27',time:'10:00',durationMinutes:60,petName:'Pet QA',barberName:'Profissional QA',quotedAmount:40,services:[{id:'s',name:'Banho',price:50}]}
describe('receipt sharing',()=>{
 it('uses the quoted total and the same confirmed appointment details',()=>{const lines=receiptLines(view).join('\n');expect(lines).toContain('40,00');expect(lines).not.toContain('50,00');expect(lines).toContain('Pet QA');expect(lines).toContain('10:00');expect(receiptMessage(view)).toContain('Loja QA')})
 it('normalizes DDD 55 correctly without mistaking it for the country code',()=>{expect(receiptWhatsAppUrl('55912345678','Olá')).toBe('https://wa.me/5555912345678?text=Ol%C3%A1');expect(receiptWhatsAppUrl('+55 (19) 91234-5678','Olá')).toContain('/5519912345678?');expect(receiptWhatsAppUrl('123','Olá')).toBeNull()})
 it('wraps long tokens and multiline notes inside the image width',()=>{const text='Cliente muito longo\nABCDEFGHIJKLMN';const lines=wrapReceiptText(text,s=>s.length,7);expect(lines.every(s=>s.length<=7)).toBe(true);expect(lines.join('').replace(/ /g,'')).toBe(text.replace(/\s/g,''))})
 it('includes transport details only when requested',()=>{expect(receiptLines({...view,petTransportAddress:'Rua QA'}).join()).not.toContain('Rua QA');expect(receiptLines({...view,petTransportRequested:true,petTransportFee:0,petTransportAddress:'Rua QA'}).join()).toContain('valor a confirmar')})
})
