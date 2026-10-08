// Compile-only checks for story(): run with tsc -p test/types.
import { story } from '../../src/vitest.js'

const gen = { storyId: 'S-001', title: 'T', scenarios: { 'S-001.1': 'a', 'S-001.2': 'b' } } as const

story(gen, { 'S-001.1': () => {}, 'S-001.2': async () => {} })

// @ts-expect-error a scenario is missing
story(gen, { 'S-001.1': () => {} })

// @ts-expect-error a key isn't a scenario in the spec
story(gen, { 'S-001.1': () => {}, 'S-001.2': () => {}, 'S-001.3': () => {} })

const tiered = {
  storyId: 'S-002', title: 'T',
  scenarios: { 'S-002.1': 'local only', 'S-002.2': { title: 'both', proof: ['local', 'deployed'] }, 'S-002.3': { title: 'by hand', proof: ['manual'] } },
} as const

story(tiered, { 'S-002.1': () => {}, 'S-002.2': { local: () => {}, deployed: async () => {} }, 'S-002.3': {} })

// @ts-expect-error a tier the scenario must be proven in has no case
story(tiered, { 'S-002.1': () => {}, 'S-002.2': { local: () => {} }, 'S-002.3': {} })

// @ts-expect-error a tiered scenario takes one function per tier, not a single function
story(tiered, { 'S-002.1': () => {}, 'S-002.2': () => {}, 'S-002.3': {} })

// @ts-expect-error manual has nothing to run
story(tiered, { 'S-002.1': () => {}, 'S-002.2': { local: () => {}, deployed: () => {} }, 'S-002.3': { manual: () => {} } })
