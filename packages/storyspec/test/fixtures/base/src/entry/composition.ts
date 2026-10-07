import { doThing } from '../../stories/S-001-do-thing/do-thing'
import { memoryThings } from '../adapters/memory/things'

export const app = { doThing: doThing({ things: memoryThings }) }
