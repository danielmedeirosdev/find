import {describe,it,expect} from 'vitest'
import {businessDay,operationalFeature,retentionHypothesis} from '../adoption'
const now=new Date('2026-11-20T12:00:00Z')
describe('adoption evidence',()=>{
 it('respects São Paulo midnight',()=>expect(businessDay(new Date('2026-11-20T01:00:00Z'))).toBe('2026-11-19'))
 it('allows only feature identifiers, never URLs or client data',()=>{expect(operationalFeature('agenda')).toBe('agenda');expect(operationalFeature('private@example.com')).toBe('other');expect(operationalFeature(null)).toBe('overview')})
 it('does not infer abandonment without audited activity',()=>{expect(retentionHypothesis('2026-10-01',null,0,now)).toBe('Observação insuficiente');expect(retentionHypothesis('2026-10-01',null,50,now)).toContain('Agenda antecipada')})
 it('distinguishes recent action, reduced activity and possible abandonment',()=>{expect(retentionHypothesis('2026-10-01','2026-11-19',0,now)).toContain('uso ativo');expect(retentionHypothesis('2026-10-01','2026-11-10',0,now)).toContain('reduzida');expect(retentionHypothesis('2026-10-01','2026-11-01',0,now)).toContain('Possível abandono');expect(retentionHypothesis('2026-10-01','2026-11-01',15,now)).toContain('Agenda antecipada')})
})
