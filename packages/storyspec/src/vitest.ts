// story(gen, cases): one test per scenario, checked against the spec at compile time.
//
//   import { story } from 'storyspec/vitest'
//   import { gen } from './scenarios.gen'
//
//   story(gen, {
//     'S-001.1': async () => { … },                          // proven locally (the default)
//     'S-001.2': { local: () => { … }, deployed: async () => { … } },   // spec.md: {#S-001.2 proof=local,deployed}
//     'S-001.3': {},                                         // proof=manual: proven with `storyspec prove`, nothing to run
//   })
//
// Leaving out a scenario, or a tier it must be proven in, is a type error, and so is a key that isn't in the spec.
// Tests run only for the active tier (STORYSPEC_TIER, default local; `storyspec trace --tier <name>` sets it) and are
// named from spec.md, "S-001.2 [deployed] Title", so the trace can read results per tier.
import { describe, test } from 'vitest'

export type GenScenario = string | { readonly title: string; readonly proof: readonly string[] }
export type StoryGen = {
  readonly storyId: string
  readonly title: string
  readonly scenarios: Readonly<Record<string, GenScenario>>
}

type Run = () => unknown
// A plain title is a local-only scenario: one function. Otherwise one function per tier that runs tests (manual doesn't).
type Tiered<T extends string> = [T] extends [never] ? Record<string, never> : { readonly [K in T]: Run }
type CaseFor<S> = S extends string ? Run
  : S extends { readonly proof: readonly (infer T)[] } ? Tiered<Exclude<T & string, 'manual'>> : never
export type Cases<G extends StoryGen> = { readonly [K in keyof G['scenarios']]: CaseFor<G['scenarios'][K]> }

export const activeTier = () => process.env.STORYSPEC_TIER || 'local'

export const story = <G extends StoryGen>(gen: G, cases: Cases<G>): void => {
  const tier = activeTier()
  const tests: [name: string, run: Run][] = []
  for (const [id, scenario] of Object.entries(gen.scenarios)) {
    const c = (cases as Record<string, Run | Record<string, Run>>)[id]
    if (c === undefined) throw new Error(`${id} has no case; run storyspec gen and typecheck`)
    if (typeof scenario === 'string') {
      // Local-only cases run in every tier, as before tiers existed; their results count as local.
      if (typeof c !== 'function') throw new Error(`${id} is proven locally only; its case is a function`)
      tests.push([`${id} ${scenario}`, c])
      continue
    }
    const run = typeof c === 'function' ? undefined : c[tier]
    if (run) tests.push([`${id} [${tier}] ${scenario.title}`, run])
  }
  // A story with nothing to run in this tier (say, deployed-only, in a local run) registers nothing.
  if (!tests.length) return
  describe(`${gen.storyId} ${gen.title}`.trim(), () => {
    for (const [name, run] of tests) test(name, async () => { await run() })
  })
}
