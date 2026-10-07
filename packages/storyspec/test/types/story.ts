// Compile-only checks for story(): run with tsc -p test/types.
import { story } from '../../src/vitest.js'

const gen = { storyId: 'S-001', title: 'T', scenarios: { 'S-001.1': 'a', 'S-001.2': 'b' } } as const

story(gen, { 'S-001.1': () => {}, 'S-001.2': async () => {} })

// @ts-expect-error a scenario is missing
story(gen, { 'S-001.1': () => {} })

// @ts-expect-error a key isn't a scenario in the spec
story(gen, { 'S-001.1': () => {}, 'S-001.2': () => {}, 'S-001.3': () => {} })
