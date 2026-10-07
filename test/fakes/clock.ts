import type { Clock } from '../../src/ports/clock'

export const fixedClock = (iso = '2026-01-01T09:00:00.000Z', ids = ['id-1', 'id-2', 'id-3']): Clock => {
  let i = 0
  return { now: () => new Date(iso), id: () => ids[i++] ?? `id-${i}` }
}
