import {describe,it,expect} from 'vitest'
import {normalizeResponsiblePhone,maskResponsiblePhone} from '../responsibleContact'
describe('responsible contact',()=>{
 it('normalizes Brazilian mobile numbers and country code',()=>{expect(normalizeResponsiblePhone('(19) 91234-5678')).toBe('5519912345678');expect(normalizeResponsiblePhone('+55 19 91234-5678')).toBe('5519912345678')})
 it('rejects empty, missing DDD, unknown DDD, landline and repeated subscriber',()=>{for(const value of ['', '912345678','20912345678','1932345678','19911111111'])expect(normalizeResponsiblePhone(value)).toBeNull()})
 it('masks without claiming WhatsApp verification',()=>expect(maskResponsiblePhone('5519912345678')).toBe('(19) 91234-5678'))
})
