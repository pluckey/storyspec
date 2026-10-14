import { cpSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect } from 'vitest'
import { story } from 'storyspec/vitest'
import { trace } from '../../packages/storyspec/src/index.js'
import { edit, pythonProject, STORY } from '../../test/python-project.js'
import { gen } from './scenarios.gen.js'

const SECOND = 'stories/S-002-greet-a-team'
/** The fixture with a second story, a copy of the first renumbered. */
const twoStories = () => {
  const root = pythonProject()
  cpSync(join(root, STORY), join(root, SECOND), { recursive: true })
  edit(root, `${SECOND}/story.md`, s => s.replace('id: S-001', 'id: S-002').replace('title: Greet a person', 'title: Greet a team'))
  edit(root, `${SECOND}/spec.md`, s => s.replaceAll('S-001', 'S-002'))
  return root
}
const after = (root: string, dir: string, ids: string) =>
  edit(root, `${dir}/story.md`, s => s.replace(/^version: (\d+)$/m, `version: $1\nafter: ${ids}`))
const afterFindings = async (root: string) =>
  (await trace(root, { write: false })).findings.filter(f => f.rule === 'after').map(f => [f.severity, f.message])

story(gen, {
  'S-008.1': async () => {
    const root = twoStories()
    after(root, SECOND, 'S-001')
    expect(await afterFindings(root)).toEqual([])
    await trace(root)
    expect(readFileSync(join(root, 'stories/TRACE.md'), 'utf8')).toContain('S-002 Greet a team<br>after S-001')
  },

  'S-008.2': async () => {
    const root = twoStories()
    after(root, SECOND, 'S-099')
    expect(await afterFindings(root)).toEqual([['error', "S-002: after: names S-099, which isn't a story"]])
  },

  'S-008.3': async () => {
    const root = pythonProject()
    after(root, STORY, 'S-001')
    expect(await afterFindings(root)).toEqual([['error', 'S-001: after: names itself']])
  },

  'S-008.4': async () => {
    const root = twoStories()
    after(root, STORY, 'S-002')
    after(root, SECOND, 'S-001')
    expect(await afterFindings(root)).toEqual([['error', 'after: goes round in a circle: S-001 → S-002 → S-001']])
  },
})
