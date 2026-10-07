import type { ThingStore } from '../../src/ports/thing-store'

export const fakeThings = (): ThingStore => ({ save: async () => {} })
