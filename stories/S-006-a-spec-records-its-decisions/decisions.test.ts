import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect } from 'vitest'
import { story } from 'storyspec/vitest'
import { trace } from '../../packages/storyspec/src/index.js'
import { edit, pythonProject, STORY } from '../../test/python-project.js'
import { gen } from './scenarios.gen.js'

const withDecisions = (...lines: string[]) => {
  const root = pythonProject()
  edit(root, `${STORY}/spec.md`, s => `${s}\n### Decisions\n\n${lines.map(l => `- ${l}`).join('\n')}\n`)
  return root
}
const decisionFindings = async (root: string) =>
  (await trace(root, { write: false })).findings.filter(f => f.rule === 'decisions').map(f => [f.severity, f.message])

story(gen, {
  'S-006.1': async () => {
    expect(await decisionFindings(withDecisions('Greeting punctuation: an exclamation mark; pinned by S-001.1'))).toEqual([])
  },

  'S-006.2': async () => {
    const found = await decisionFindings(withDecisions('Greeting punctuation: pinned by S-001.9'))
    expect(found).toEqual([['error', 'S-001: the decision "Greeting punctuation: pinned by S-001.9" is pinned by S-001.9, which isn\'t a scenario']])
  },

  'S-006.3': async () => {
    expect(await decisionFindings(withDecisions('Token lifetime: 7 days (free)'))).toEqual([])
  },

  'S-006.4': async () => {
    const found = await decisionFindings(withDecisions('Usernames are case-sensitive'))
    expect(found.map(f => f[0])).toEqual(['warning'])
    expect(found[0]![1]).toContain('neither pinned by a scenario')
  },

  'S-006.5': async () => {
    const root = withDecisions('Greeting punctuation: an exclamation mark; pinned by S-001.1', 'Token lifetime: 7 days (free)')
    await trace(root)
    const md = readFileSync(join(root, 'stories/TRACE.md'), 'utf8')
    expect(md).toContain('## Decisions')
    expect(md).toContain('| S-001 | Greeting punctuation: an exclamation mark; pinned by S-001.1 | S-001.1 |')
    expect(md).toContain('| S-001 | Token lifetime: 7 days (free) | free |')
  },
})
