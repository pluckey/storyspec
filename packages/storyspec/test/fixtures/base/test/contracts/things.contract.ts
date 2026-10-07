import type { ThingStore } from '../../src/ports/thing-store'

export const thingStoreContract = (make: () => ThingStore) => make()
