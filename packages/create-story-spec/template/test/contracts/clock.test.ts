import { systemClock } from '../../src/adapters/memory/clock'
import { fixedClock } from '../fakes/clock'
import { clockContract } from './clock.contract'

clockContract('src/adapters/memory/clock.ts', () => systemClock)
clockContract('test fake', () => fixedClock())
