import { memoryThings } from '../../src/adapters/memory/things'
import { thingStoreContract } from './things.contract'

thingStoreContract(() => memoryThings)
