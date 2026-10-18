import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect } from 'vitest'
import { story } from 'storyspec/vitest'
import { trace } from '../../packages/storyspec/src/index.js'
import { edit, pythonProject, STORY } from '../../test/python-project.js'
import { gen } from './scenarios.gen.js'

/** The fixture's story with nothing to say where it is implemented: a new story, still to build. */
const newStory = () => {
  const root = pythonProject()
  edit(root, `${STORY}/story.md`, s => s.replace(/^implementedBy: .*\n/m, ''))
  return root
}
const genFindings = async (root: string) =>
  (await trace(root, { write: false })).findings.filter(f => f.rule === 'gen-fresh').map(f => f.message)

story(gen, {
  'S-009.1': async () => {
    const root = newStory()
    writeFileSync(join(root, 'tsconfig.json'), '{}\n')
    expect(await genFindings(root)).toEqual([`S-001: ${STORY}/scenarios.gen.ts is missing; run storyspec gen`])
  },

  'S-009.2': async () => {
    expect(await genFindings(newStory())).toEqual([])
  },

  'S-009.3': async () => {
    const root = newStory()
    writeFileSync(join(root, STORY, 'greet.test.ts'), "import { test } from 'vitest'\ntest('S-001.1 greets', () => {})\n")
    expect(await genFindings(root)).toEqual([`S-001: ${STORY}/scenarios.gen.ts is missing; run storyspec gen`])
  },
})
