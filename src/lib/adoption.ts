export const BUSINESS_TIME_ZONE='America/Sao_Paulo'
export function businessDay(value=new Date()) {return new Intl.DateTimeFormat('en-CA',{timeZone:BUSINESS_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(value)}
export function operationalFeature(value:string|null) {
 const values=['overview','agenda','customers','pets','services','packages','cashflow','reports','team','info','subscription']
 return value===null?'overview':values.includes(value)?value:'other'
}
export function retentionHypothesis(started:string,lastAction:string|null,future:number,now=new Date()):string {
 const coverage=(now.getTime()-Date.parse(started))/86400000
 if(!lastAction)return future>0?'Agenda antecipada possível · sem ação auditada no período':'Observação insuficiente'
 const idle=(now.getTime()-Date.parse(lastAction))/86400000
 if(idle<=7)return 'Sinal de uso ativo'
 if(future>0)return 'Agenda antecipada possível · atividade reduzida'
 if(coverage>=14&&idle>=14)return 'Possível abandono · confirmar com o estabelecimento'
 return 'Sinal de atividade reduzida'
}
