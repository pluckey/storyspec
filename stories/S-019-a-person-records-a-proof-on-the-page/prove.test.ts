import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect } from 'vitest'
import { story } from 'storyspec/vitest'
import { trace } from '../../packages/storyspec/src/index.js'
import { uiState } from '../../packages/storyspec/src/ui/server.js'
import { edit, pythonProject, STORY } from '../../test/python-project.js'
import { gitRepo, NOW, pageOf, prove, read, scenario, served } from '../../test/ui-project.js'
import { gen } from './scenarios.gen.js'

const cleanup: (() => void)[] = []
afterEach(() => { for (const c of cleanup.splice(0)) c() })

const PROOF = 'stories/PROOF.json'
const proofOf = (root: string, id: string) => JSON.parse(read(root, PROOF)).scenarios[id]
const manual = (root: string, n: number, title: string) =>
  scenario(root, STORY, `S-001.${n}`, title, ['WHEN a person looks at the greeting', `THEN ${title.toLowerCase()}`], 'manual')
/** A project with one manual scenario, S-001.3, in a git repository whose user is `name`. */
const project = (name = 'Ada Lovelace') => {
  const root = pythonProject()
  manual(root, 3, 'The greeting is friendly')
  gitRepo(root, name)
  return root
}
const hashOf = async (root: string, id: string) => (await uiState(root)).stories.flatMap(s => s.scenarios).find(x => x.id === id)!.hash
const person = async (root: string) => (await pageOf(root)).screens['by-a-person']

story(gen, {
  'S-019.1': async () => {
    const root = project()
    const { post } = await served(root)
    const hash = await hashOf(root, 'S-001.3')
    const res = await post({ op: 'prove', id: 'S-001.3', hash, outcome: 'pass', note: 'checked in Chrome' })
    expect(res.status).toBe(200)
    expect(proofOf(root, 'S-001.3')).toEqual({
      manual: { outcome: 'pass', at: NOW.toISOString(), by: 'Ada Lovelace', note: 'checked in Chrome', hash, version: '1', commit: expect.any(String) },
    })
    // The change is shown as a diff, like every other edit the page makes. (The ID is spliced in: written out with its
    // quotes and colon, the trace would read the line as a test case named after it.)
    const id = 'S-001.3'
    const diff = res.body.state.changes.find((c: { file: string }) => c.file === PROOF)
    expect(diff.lines).toEqual(expect.arrayContaining(['+  "scenarios": {', `+    "${id}": {`, '+        "note": "checked in Chrome",', '+        "outcome": "pass",']))
  },

  'S-019.2': async () => {
    const root = project()
    expect((await prove(root, 'S-001.3', 'fail', 'the greeting was curt')).status).toBe(200)
    expect(proofOf(root, 'S-001.3').manual).toMatchObject({ outcome: 'fail', note: 'the greeting was curt' })
    const [x] = (await person(root)).doneItems
    expect(x!.state.word).toBe('failed a check')
    expect(x!.state.why).toMatchObject({ sentence: 'Ada Lovelace found it failing on 2026-10-18.', note: 'Their note: the greeting was curt' })
  },

  'S-019.3': async () => {
    const root = project()
    expect((await prove(root, 'S-001.3')).status).toBe(200)
    edit(root, `${STORY}/spec.md`, s => s.replace('THEN the greeting is friendly', 'THEN the greeting is warm'))
    const [x] = (await person(root)).pendingItems
    expect(x!.state.why.then).toBe('The greeting is friendly\nWHEN a person looks at the greeting\nTHEN the greeting is friendly')
    expect(x!.state.why.now).toBe('The greeting is friendly\nWHEN a person looks at the greeting\nTHEN the greeting is warm')
    expect(x!.state.why.action).toEqual({ label: 'Check again', op: 'check-again', target: 'S-001.3' })
    // The page shows them side by side.
    expect(await (await served(root)).html()).toContain('<div class="thennow">')
    // Checking again proves the new text.
    expect((await prove(root, 'S-001.3')).status).toBe(200)
    expect((await person(root)).doneItems.map(d => [d.title, d.state.word])).toEqual([['The greeting is friendly', 'checked']])
    // A check of text the page no longer shows is refused.
    const { post } = await served(root)
    expect((await post({ op: 'prove', id: 'S-001.3', hash: 'not-the-text', outcome: 'pass' })).status).toBe(409)
  },

  'S-019.4': async () => {
    const page = project()
    const cli = join(mkdtempSync(join(tmpdir(), 'storyspec-cli-')), 'app')
    cleanup.push(() => rmSync(join(cli, '..'), { recursive: true, force: true }))
    cpSync(page, cli, { recursive: true })
    expect((await prove(page, 'S-001.3', 'pass', 'looked fine')).status).toBe(200)
    execFileSync('node', [join(import.meta.dirname, '../../packages/storyspec/dist/cli.js'), 'prove', 'S-001.3', '--note', 'looked fine', '--root', cli], { stdio: 'ignore' })
    // The same entry, but for the moment it was made.
    const { at: _a, ...fromPage } = proofOf(page, 'S-001.3').manual
    const { at: _b, ...fromCli } = proofOf(cli, 'S-001.3').manual
    expect(fromPage).toEqual(fromCli)
    // And the trace reads it as proof.
    const sc = (await trace(page, { write: false })).rows[0]!.scenarios.find(x => x.id === 'S-001.3')!
    expect(sc.tiers).toEqual([{ tier: 'manual', state: 'proven', entry: expect.objectContaining({ outcome: 'pass', by: 'Ada Lovelace', note: 'looked fine' }) }])
  },

  'S-019.5': async () => {
    const root = project('Grace Hopper')
    expect((await prove(root, 'S-001.3')).message).toBe('Recorded proof in the manual tier for S-001.3 (by Grace Hopper)')
    expect(proofOf(root, 'S-001.3').manual.by).toBe('Grace Hopper')
  },

  'S-019.6': async () => {
    const root = project()
    manual(root, 4, 'The greeting is easy to read')
    manual(root, 5, 'The greeting fits on one line')
    expect((await prove(root, 'S-001.4')).status).toBe(200)
    const p = await person(root)
    expect(p.pendingItems.map(x => [x.title, x.steps, x.state.why.action?.label])).toEqual([
      ['The greeting is friendly', ['WHEN a person looks at the greeting', 'THEN the greeting is friendly'], 'Check'],
      ['The greeting fits on one line', ['WHEN a person looks at the greeting', 'THEN the greeting fits on one line'], 'Check'],
    ])
    expect(p.doneItems.map(x => [x.title, x.entry])).toEqual([['The greeting is easy to read', { by: 'Ada Lovelace', date: '2026-10-18' }]])
  },
})
