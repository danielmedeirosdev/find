import { describe, expect, it } from 'vitest'
import { confirmationWhatsappUrl, CONFIRMATION_REMINDER_OPTIONS } from '../bookingReminders'
import type { BookingWithDetails } from '../types'
const booking = { client_name: 'Mariana', client_phone: '19999991234', date: '2026-10-27', time: '10:30:00', pets: { name: 'Laura' }, booking_services: [{ service_id:'bath',services:{name:'Banho'}}] } as BookingWithDetails
describe('booking confirmation message', () => {
  it('includes the real customer, pet, service, establishment and appointment time', () => {
    const url = new URL(confirmationWhatsappUrl(booking,'Banho e Tosa')!)
    expect(url.pathname).toBe('/5519999991234')
    const message=url.searchParams.get('text')!
    for(const value of ['Mariana','Laura','Banho','27/10/2026','10:30','Banho e Tosa'])expect(message).toContain(value)
    expect(message).not.toContain('10:30:00')
  })
  it('never greets a phone number as if it were the customer name', () => {
    const message=new URL(confirmationWhatsappUrl({...booking,client_name:booking.client_phone},'Pet Shop')!).searchParams.get('text')!
    expect(message.startsWith('Oi!')).toBe(true)
    expect(message).not.toContain(booking.client_phone)
  })
  it('uses the name completed after the appointment was created', () => {
    const message = new URL(confirmationWhatsappUrl({ ...booking, client_name: '', shop_customers: { name: 'Mariana atualizada', phone: booking.client_phone } }, 'Pet Shop')!).searchParams.get('text')!
    expect(message.startsWith('Oi, Mariana atualizada!')).toBe(true)
  })
  it('adds the country code when the contact DDD is also 55', () => {
    expect(new URL(confirmationWhatsappUrl({...booking,client_phone:'55999991234'},'Pet Shop')!).pathname).toBe('/5555999991234')
  })
  it('does not generate a broken link without a valid phone', () => {
    expect(confirmationWhatsappUrl({...booking,client_phone:''},'Pet Shop')).toBeNull()
    expect(CONFIRMATION_REMINDER_OPTIONS.map(item=>item.minutes)).toEqual([30,60,120,1440])
  })
})
