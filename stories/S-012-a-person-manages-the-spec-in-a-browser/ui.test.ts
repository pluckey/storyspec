import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, expect } from 'vitest'
import { story } from 'storyspec/vitest'
import { textHash } from '../../packages/storyspec/src/edit.js'
import { applyEdit, serveUi, uiState } from '../../packages/storyspec/src/ui/server.js'
import { edit, pythonProject, STORY } from '../../test/python-project.js'
import { gen } from './scenarios.gen.js'

const SPEC = `${STORY}/spec.md`, STORY_MD = `${STORY}/story.md`
const NOW = new Date('2026-10-14T12:00:00Z')
const read = (root: string, f: string) => readFileSync(join(root, f), 'utf8')
const withDecisions = (...lines: string[]) => {
  const root = pythonProject()
  edit(root, SPEC, s => `${s.replace(/\s*$/, '')}\n\n### Decisions\n\n${lines.map(l => `- ${l}`).join('\n')}\n`)
  return root
}
const answer = (root: string, index: number, text: string, kind: string) =>
  applyEdit(root, { op: 'answer', story: 'S-001', hash: textHash(read(root, SPEC)), index, answer: text, kind }, NOW)
const steps = (root: string, s: string) => edit(root, SPEC, t => t.replace('{#S-001.1}\n', `{#S-001.1}\n\n${s}\n`))

const servers: { close: () => void }[] = []
afterEach(() => { for (const s of servers.splice(0)) s.close() })

story(gen, {
  'S-012.1': async () => {
    const root = withDecisions('Greeting punctuation (open); S-001.1')
    steps(root, '- WHEN Ada gives her name\n- THEN she is greeted as Ada')
    const state = await uiState(root)
    const s = state.stories[0]!
    expect(s.requirement).toBe('WHEN a person gives their name THE SYSTEM SHALL greet them by it.')
    expect(s.scenarios[0]).toMatchObject({ id: 'S-001.1', blocked: true, steps: ['WHEN Ada gives her name', 'THEN she is greeted as Ada'] })
    expect(s.decisions[0]).toMatchObject({ question: 'Greeting punctuation', open: true, pinnedBy: ['S-001.1'] })
    expect(state.findings.some(f => f.rule === 'decisions')).toBe(true)
  },

  'S-012.2': async () => {
    const root = withDecisions('Greeting punctuation (open); S-001.1')
    expect(answer(root, 0, 'an exclamation mark', 'pinned').status).toBe(200)
    expect(read(root, SPEC)).toContain('- Greeting punctuation: an exclamation mark; pinned by S-001.1\n')
    expect((await uiState(root)).stories[0]!.scenarios[0]!.blocked).toBe(false)
  },

  'S-012.3': () => {
    const root = withDecisions('Token lifetime (open)')
    expect(answer(root, 0, '7 days', 'free').status).toBe(200)
    expect(read(root, SPEC)).toContain('- Token lifetime: 7 days (free)\n')
  },

  'S-012.4': () => {
    const root = withDecisions('Token lifetime (open)')
    const before = read(root, SPEC)
    const result = answer(root, 0, '7 days', 'pinned')
    expect(result.status).toBe(400)
    expect(result.message).toContain('a pinned answer needs a scenario that proves it')
    expect(read(root, SPEC)).toBe(before)
  },

  'S-012.5': () => {
    const root = pythonProject()
    edit(root, STORY_MD, s => s.replace('status: in-progress', 'status: draft'))
    expect(applyEdit(root, { op: 'status', story: 'S-001', hash: textHash(read(root, STORY_MD)), status: 'ready' }, NOW).status).toBe(200)
    expect(read(root, STORY_MD)).toMatch(/^status: ready$/m)
  },

  'S-012.6': () => {
    const root = pythonProject()
    const result = applyEdit(root, { op: 'scenario', story: 'S-001', hash: textHash(read(root, SPEC)), id: 'S-001.1', title: 'Greets by name', steps: ['WHEN Ada gives her name', 'THEN she is greeted as Ada'] }, NOW)
    expect(result).toEqual({ status: 200, message: 'Saved S-001.1; S-001 is now v2' })
    expect(read(root, SPEC)).toContain('#### Scenario: Greets by name {#S-001.1}\n\n- WHEN Ada gives her name\n- THEN she is greeted as Ada\n')
    expect(read(root, STORY_MD)).toMatch(/^version: 2$/m)
    expect(read(root, STORY_MD)).toContain('- v2 (2026-10-14): changed S-001.1')
  },

  'S-012.7': () => {
    const root = withDecisions('Token lifetime: 7 days (free)')
    const result = applyEdit(root, { op: 'scenario', story: 'S-001', hash: textHash(read(root, SPEC)), title: 'Greets in the visitor\'s language', steps: ['GIVEN a visitor whose browser asks for French', 'THEN the greeting is in French'] }, NOW)
    expect(result.message).toBe('Added S-001.3; S-001 is now v2')
    const spec = read(root, SPEC)
    expect(spec).toContain('#### Scenario: Greets in the visitor\'s language {#S-001.3}')
    expect(spec.indexOf('{#S-001.3}')).toBeLessThan(spec.indexOf('### Decisions'))
  },

  'S-012.8': () => {
    const root = pythonProject()
    const before = read(root, SPEC)
    const result = applyEdit(root, { op: 'scenario', story: 'S-001', hash: textHash(before), id: 'S-001.1', title: 'Greets by name', steps: ['WHEN Ada gives her name'] }, NOW)
    expect(result.status).toBe(400)
    expect(result.message).toContain('a scenario needs a THEN')
    expect(read(root, SPEC)).toBe(before)
  },

  'S-012.9': () => {
    const root = withDecisions('Greeting punctuation (open); S-001.1')
    const seen = textHash(read(root, SPEC))
    edit(root, SPEC, s => s.replace('Greeting punctuation', 'Greeting punctuation, as the brand guide says,'))
    const after = read(root, SPEC)
    const result = applyEdit(root, { op: 'answer', story: 'S-001', hash: seen, index: 0, answer: 'a full stop', kind: 'pinned' }, NOW)
    expect(result.status).toBe(409)
    expect(result.message).toContain('changed since the page read it; reload')
    expect(read(root, SPEC)).toBe(after)
  },

  'S-012.10': async () => {
    const root = withDecisions('Token lifetime (open)')
    const server = await serveUi(root, { port: 0 })
    servers.push(server)
    const address = server.address()
    const port = typeof address === 'object' && address ? address.port : 0
    const res = await fetch(`http://127.0.0.1:${port}/api/edit`, {
      method: 'POST', headers: { origin: 'https://example.com', 'content-type': 'application/json' },
      body: JSON.stringify({ op: 'answer', story: 'S-001', hash: textHash(read(root, SPEC)), index: 0, answer: '1 day', kind: 'free' }),
    })
    expect(res.status).toBe(403)
    expect(read(root, SPEC)).toContain('Token lifetime (open)')
  },
})
