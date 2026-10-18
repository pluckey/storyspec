// @implements S-001
import type { Thing } from '../../src/domain/thing'
import type { ThingStore } from '../../src/ports/thing-store'

export const doThing = (deps: { things: ThingStore }) => async (t: Thing) => deps.things.save(t)
