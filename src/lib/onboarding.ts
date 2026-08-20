export type OnboardingServiceInput = {
  name: string
  price: string
  duration: string
}

export type OnboardingStaffInput = {
  name: string
  role: string
}

export function parseOnboardingServices(rows: OnboardingServiceInput[]) {
  const filled = rows.filter((row) => row.name.trim() || row.price.trim())

  return filled.map((row) => {
    const priceText = row.price.trim()
    const price = Number(priceText.replace(',', '.'))
    const duration = Number.parseInt(row.duration, 10)
    if (
      !row.name.trim() ||
      !priceText ||
      !Number.isFinite(price) ||
      price < 0 ||
      !Number.isInteger(duration) ||
      duration < 5 ||
      duration > 1440
    ) {
      throw new Error('Revise o nome, o preço e a duração de cada serviço.')
    }
    return {
      name: row.name.trim(),
      price,
      duration_minutes: duration,
    }
  })
}

export function parseOnboardingStaff(rows: OnboardingStaffInput[]) {
  return rows.map((row) => {
    if (!row.name.trim()) {
      throw new Error('Informe o nome de todas as pessoas da equipe.')
    }
    return { name: row.name.trim(), role: row.role.trim() || null }
  })
}
