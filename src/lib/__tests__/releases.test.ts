import { describe, expect, it } from 'vitest'
import { PRODUCT_RELEASES, formatReleaseDate } from '../releases'

describe('histórico de atualizações', () => {
  it('mantém as atualizações da mais recente para a mais antiga', () => {
    const dates = PRODUCT_RELEASES.map((release) => release.date)
    expect(dates).toEqual([...dates].sort().reverse())
  })

  it('usa identificadores únicos e possui conteúdo em todas as atualizações', () => {
    const ids = PRODUCT_RELEASES.map((release) => release.id)
    expect(new Set(ids).size).toBe(ids.length)

    for (const release of PRODUCT_RELEASES) {
      expect(release.title.trim()).not.toBe('')
      expect(release.summary.trim()).not.toBe('')
      expect(release.notes.length).toBeGreaterThan(0)
      expect(Number.isNaN(Date.parse(release.date))).toBe(false)
    }
  })

  it('formata a data em português', () => {
    expect(formatReleaseDate('2026-09-01')).toContain('2026')
    expect(formatReleaseDate('2026-09-01')).toContain('setembro')
  })
})
