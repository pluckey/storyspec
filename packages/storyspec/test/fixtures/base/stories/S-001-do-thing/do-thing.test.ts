import { story } from 'storyspec/vitest'
import { fakeThings } from '../../test/fakes/things'
import { gen } from './scenarios.gen'

story(gen, {
  'S-001.1': async () => { fakeThings() },
  'S-001.2': async () => { fakeThings() },
})
