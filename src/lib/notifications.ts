export function packageRemaining(total: number, used: number): number {
  return Math.max(0, total - used)
}
