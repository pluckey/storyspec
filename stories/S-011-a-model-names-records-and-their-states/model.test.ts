import { cpSync, readFileSync, writeFileSync } from 'node:fs'
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
const front = (root: string, dir: string, lines: string) =>
  edit(root, `${dir}/story.md`, s => s.replace(/^version: (\d+)$/m, `version: $1\n${lines}`))
const model = (root: string) =>
  writeFileSync(join(root, 'stories/MODEL.md'), '# Model\n\n## Greeting\n\nWhat a person is sent.\n\n- Draft → Sent\n')
const modelFindings = async (root: string) =>
  (await trace(root, { write: false })).findings.filter(f => f.rule === 'model').map(f => [f.severity, f.message])
const traceMd = async (root: string) => { await trace(root); return readFileSync(join(root, 'stories/TRACE.md'), 'utf8') }

story(gen, {
  'S-011.1': async () => {
    const root = twoStories()
    model(root)
    front(root, STORY, 'emits: greeting.created')
    front(root, SECOND, 'emits: greeting.sent')
    expect(await modelFindings(root)).toEqual([])
    const md = await traceMd(root)
    expect(md).toContain('## Model')
    expect(md).toContain('### Greeting')
    expect(md).toContain('| Sent | S-002 | — | — |')
  },

  'S-011.2': async () => {
    const root = pythonProject()
    model(root)
    front(root, STORY, 'emits: greeting.sent, greeting.delivered')
    expect(await modelFindings(root)).toEqual([['error',
      'S-001: emits greeting.delivered, but Greeting has no state delivered; its events are greeting.draft, greeting.sent, greeting.created, greeting.changed']])
  },

  'S-011.3': async () => {
    const root = pythonProject()
    model(root)
    expect(await modelFindings(root)).toEqual([['warning', 'Greeting: no story emits greeting.sent, so nothing moves a Greeting to Sent']])
  },

  'S-011.4': async () => {
    const root = twoStories()
    model(root)
    front(root, STORY, 'emits: greeting.sent, greeting.changed')
    front(root, SECOND, 'trigger: event:greeting.changed')
    expect(await modelFindings(root)).toEqual([])
  },

  'S-011.5': async () => {
    const root = pythonProject()
    model(root)
    front(root, STORY, 'emits: greeting.sent, spec.saved')
    expect(await modelFindings(root)).toEqual([])
  },

  'S-011.6': async () => {
    const root = pythonProject()
    front(root, STORY, 'emits: greeting.whatever')
    expect(await modelFindings(root)).toEqual([])
    expect(await traceMd(root)).not.toContain('## Model')
  },
})
