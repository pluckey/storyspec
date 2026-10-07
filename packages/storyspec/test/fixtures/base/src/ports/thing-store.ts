import type { Thing } from '../domain/thing'

export interface ThingStore {
  save(t: Thing): Promise<void>
}
