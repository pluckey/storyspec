import { systemClock } from '../../src/adapters/memory/clock'
import { fixedClock } from '../fakes/clock'
import { clockContract } from './clock.contract'

clockContract('system clock', () => systemClock)
clockContract('test fake', () => fixedClock())
