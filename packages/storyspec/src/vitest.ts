// story(gen, cases): one test per scenario, checked against the spec at compile time.
//
//   import { story } from 'storyspec/vitest'
//   import { gen } from './scenarios.gen'
//
//   story(gen, {
//     'S-001.1': async () => { … },
//     'S-001.2': async () => { … },
//   })
//
// Leaving out a scenario is a type error, and so is a key that isn't in the spec.
// Test names come from spec.md ("S-001.1 Valid note is saved"), so the trace can read results.
import { describe, test } from 'vitest'

export type StoryGen = {
  readonly storyId: string
  readonly title: string
  readonly scenarios: Readonly<Record<string, string>>
}

export type Cases<G extends StoryGen> = { readonly [K in keyof G['scenarios']]: () => unknown }

export const story = <G extends StoryGen>(gen: G, cases: Cases<G>): void => {
  describe(`${gen.storyId} ${gen.title}`.trim(), () => {
    for (const [id, title] of Object.entries(gen.scenarios)) {
      const run = (cases as Record<string, () => unknown>)[id]
      if (!run) throw new Error(`${id} has no case; run storyspec gen and typecheck`)
      test(`${id} ${title}`, async () => { await run() })
    }
  })
}
