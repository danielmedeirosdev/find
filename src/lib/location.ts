const UF = new Set([
  'ac',
  'al',
  'ap',
  'am',
  'ba',
  'ce',
  'df',
  'es',
  'go',
  'ma',
  'mt',
  'ms',
  'mg',
  'pa',
  'pb',
  'pr',
  'pe',
  'pi',
  'rj',
  'rn',
  'rs',
  'ro',
  'rr',
  'sc',
  'sp',
  'se',
  'to',
])

export function foldText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/** Cidade ou bairro inferidos do endereço livre do estabelecimento. */
export function extractLocation(address: string | null | undefined): string {
  if (!address?.trim()) return ''

  const text = address.replace(/\b\d{5}-?\d{3}\b/g, ' ').replace(/\s+/g, ' ').trim()
  const parts = text.split(',').map((part) => part.trim()).filter(Boolean)
  let candidate = parts[parts.length - 1] || text

  const dashParts = candidate
    .split(/\s[-–—]\s/)
    .map((part) => part.trim())
    .filter(Boolean)
  const dashTail = dashParts[dashParts.length - 1] || ''
  if (dashParts.length >= 2 && UF.has(foldText(dashTail))) {
    candidate = dashParts.slice(0, -1).join(' · ')
  } else if (UF.has(foldText(candidate)) && parts.length >= 2) {
    candidate = parts[parts.length - 2]
  }

  candidate = candidate.replace(/^\d+\s*[-./]?\s*/, '').trim()
  if (!candidate && parts.length >= 2) {
    candidate = parts[parts.length - 2].replace(/^\d+\s*[-./]?\s*/, '').trim()
  }

  return candidate
}
