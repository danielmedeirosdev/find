const ddds = new Set('11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99'.split(' '))
export function normalizeResponsiblePhone(value:string) {
 let digits=value.replace(/\D/g,'')
 if(digits.length===13&&digits.startsWith('55'))digits=digits.slice(2)
 return digits.length===11&&ddds.has(digits.slice(0,2))&&digits[2]==='9'&&!/^(\d)\1{7}$/.test(digits.slice(3))?'55'+digits:null
}
export function maskResponsiblePhone(value:string) {
 let d=value.replace(/\D/g,'');if(d.length>11&&d.startsWith('55'))d=d.slice(2)
 d=d.slice(0,11);return d.length>7?`(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`:d.length>2?`(${d.slice(0,2)}) ${d.slice(2)}`:d
}
