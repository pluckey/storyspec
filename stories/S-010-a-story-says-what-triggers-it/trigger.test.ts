import { cpSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect } from 'vitest'
import { story } from 'story-spec/vitest'
import { trace } from '../../packages/story-spec/src/index.js'
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
const front = (root: string, dir: string, lines: string) =>
  edit(root, `${dir}/story.md`, s => s.replace(/^version: (\d+)$/m, `version: $1\n${lines}`))
const triggerFindings = async (root: string) =>
  (await trace(root, { write: false })).findings.filter(f => f.rule === 'trigger').map(f => [f.severity, f.message])
const traceMd = async (root: string) => { await trace(root); return readFileSync(join(root, 'stories/TRACE.md'), 'utf8') }

story(gen, {
  'S-010.1': async () => {
    const root = twoStories()
    front(root, STORY, 'trigger: actor:visitor\nemits: greeted')
    front(root, SECOND, 'trigger: event:greeted')
    expect(await triggerFindings(root)).toEqual([])
    const md = await traceMd(root)
    expect(md).toContain('S-001 Greet a person<br>on actor:visitor')
    expect(md).toContain('S-002 Greet a team<br>on event:greeted')
    expect(md).toContain('| event:greeted | S-001 | S-002 |')
  },

  'S-010.2': async () => {
    const root = pythonProject()
    front(root, STORY, 'trigger: webhook:stripe')
    expect(await triggerFindings(root)).toEqual([['error',
      'S-001: trigger: webhook:stripe isn\'t a kind of trigger; use actor:<role>, event:<event>, schedule:<name> or external:<system>']])
  },

  'S-010.3': async () => {
    const root = pythonProject()
    front(root, STORY, 'trigger: actor:')
    expect(await triggerFindings(root)).toEqual([['error', 'S-001: trigger: actor: needs a name after the colon (actor:<role>)']])
  },

  'S-010.4': async () => {
    const root = pythonProject()
    front(root, STORY, 'trigger: actor:visitor, schedule:nightly')
    expect(await triggerFindings(root)).toEqual([['error',
      'S-001: trigger: names 2 triggers; a story has one requirement and so one trigger. Split the story, one per trigger']])
  },

  'S-010.5': async () => {
    const root = pythonProject()
    front(root, STORY, 'trigger: event:greeted')
    expect(await triggerFindings(root)).toEqual([['warning', 'S-001: trigger: event:greeted, but no story emits greeted (emits: in its story.md)']])
  },

  'S-010.6': async () => {
    const root = pythonProject()
    expect(await triggerFindings(root)).toEqual([])
    expect(await traceMd(root)).not.toContain('## Triggers')
  },
})
