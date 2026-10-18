import { describe, expect, test } from 'vitest'
import type { Clock } from '../../src/ports/clock'

// Every Clock (the system clock and the test fake) must pass this suite.
export const clockContract = (name: string, make: () => Clock) =>
  describe(`Clock contract: ${name}`, () => {
    test('now() is a valid date', () => {
      expect(Number.isNaN(make().now().getTime())).toBe(false)
    })

    test('id() never repeats', () => {
      const clock = make()
      const ids = [clock.id(), clock.id(), clock.id()]
      expect(new Set(ids).size).toBe(3)
    })
  })
