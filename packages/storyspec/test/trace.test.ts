// Each case copies the base fixture, breaks exactly one thing, and checks the trace reports
// exactly the expected rule. Test results come from the fixture's canned .storyspec/vitest.json.
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { trace } from '../src/index.js'
import { loadConfig } from '../src/config.js'
import { newStory } from '../src/new-story.js'
import { writeGen } from '../src/gen.js'
import { scan } from '../src/trace/scan.js'
import { sync } from '../src/sync.js'

const base = join(import.meta.dirname, 'fixtures/base')
const roots: string[] = []
afterEach(() => { for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true }) })

// A project kept up to date: the base fixture with this version's agent guidance synced in.
const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), 'storyspec-'))
  cpSync(base, root, { recursive: true })
  sync(root)
  roots.push(root)
  return root
}
const S = 'stories/S-001-do-thing'
const edit = (root: string, file: string, f: (s: string) => string) =>
  writeFileSync(join(root, file), f(readFileSync(join(root, file), 'utf8')))
const append = (root: string, file: string, text: string) => edit(root, file, s => s + text)
const regen = (root: string) => writeGen(root, scan(root, loadConfig(root)).stories)
const run = (root: string) => trace(root, { write: false })
const rulesOf = (root: string, severity: 'error' | 'warning' = 'error') =>
  [...new Set(run(root).findings.filter(f => f.severity === severity).map(f => f.rule))].sort()

describe('trace', () => {
  test('the base fixture is clean', () => {
    const r = run(fixture())
    expect(r.ok).toBe(true)
    expect(r.findings).toEqual([])
    expect(r.rows.map(x => [x.story, x.scenarios.map(s => s.outcome)])).toEqual([['S-001', ['pass', 'pass']]])
  })

  test('story-files: story.md id must match the folder', () => {
    const root = fixture()
    edit(root, `${S}/story.md`, s => s.replace('id: S-001', 'id: S-009'))
    expect(rulesOf(root)).toEqual(['story-files'])
  })

  test('requirement-tag: spec needs {#ID}', () => {
    const root = fixture()
    edit(root, `${S}/spec.md`, s => s.replace(' {#S-001}', ''))
    expect(rulesOf(root)).toEqual(['requirement-tag'])
  })

  test('scenario-ownership: a scenario tagged with another story’s ID', () => {
    const root = fixture()
    append(root, `${S}/spec.md`, '\n#### Scenario: Stray {#S-002.1}\n')
    regen(root)
    expect(rulesOf(root)).toContain('scenario-ownership')
  })

  test('implementation: a story needs exactly one @implements', () => {
    const root = fixture()
    edit(root, `${S}/do-thing.ts`, s => s.replace('// @implements S-001\n', ''))
    expect(rulesOf(root)).toEqual(['implementation'])
  })

  test('orphan-test: a case for a scenario the spec doesn’t have', () => {
    const root = fixture()
    edit(root, `${S}/do-thing.test.ts`, s => s.replace("})\n", "  'S-001.9': async () => {},\n})\n"))
    expect(rulesOf(root)).toEqual(['orphan-test'])
  })

  test('untested-scenario + gen-fresh: a new scenario without a test or regenerated types', () => {
    const root = fixture()
    append(root, `${S}/spec.md`, '\n#### Scenario: Does it thrice {#S-001.3}\n')
    expect(rulesOf(root)).toEqual(['gen-fresh', 'untested-scenario'])
    regen(root)
    expect(rulesOf(root)).toEqual(['untested-scenario'])
  })

  test('must-pass: a done story with a failing test', () => {
    const root = fixture()
    edit(root, '.storyspec/vitest.json', s => s.replace('"S-001.2 Does it twice", "status": "passed"', '"S-001.2 Does it twice", "status": "failed"'))
    expect(rulesOf(root)).toEqual(['must-pass'])
  })

  test('story-imports: stories can’t import each other or adapters', () => {
    const root = fixture()
    edit(root, `${S}/do-thing.ts`, s => s + "import '../../src/adapters/memory/things'\n")
    expect(rulesOf(root)).toEqual(['story-imports'])
  })

  test('ids-outside-stories: story IDs in the kernel', () => {
    const root = fixture()
    append(root, 'src/adapters/memory/things.ts', '// handles the S-001 edge case\n')
    expect(rulesOf(root)).toEqual(['ids-outside-stories'])
  })

  test('wiring: only composition roots import stories', () => {
    const root = fixture()
    append(root, 'src/adapters/memory/things.ts', "import { doThing } from '../../../stories/S-001-do-thing/do-thing'\n")
    expect(rulesOf(root)).toEqual(['ids-outside-stories', 'wiring'])
  })

  test('layers: domain importing a port', () => {
    const root = fixture()
    append(root, 'src/domain/thing.ts', "import type { ThingStore } from '../ports/thing-store'\n")
    expect(rulesOf(root)).toEqual(['layers'])
  })

  test('port-adapter: a port without an adapter is a warning', () => {
    const root = fixture()
    append(root, 'src/ports/thing-store.ts', '\nexport interface Mailer {\n  send(): Promise<void>\n}\n')
    expect(rulesOf(root)).toEqual([])
    expect(rulesOf(root, 'warning')).toEqual(['port-adapter'])
  })

  test('contract-tests: a port with an adapter needs an executed test outside stories', () => {
    const root = fixture()
    edit(root, '.storyspec/vitest.json', s => s.replace('"test/contracts/things.test.ts"', '"test/contracts/never-ran.test.ts"'))
    expect(rulesOf(root)).toEqual(['contract-tests'])
    expect(run(root).ports).toEqual([{ port: 'ThingStore', file: 'src/ports/thing-store.ts', adapters: ['src/adapters/memory/things.ts'], contractTests: [] }])
  })

  test('the ports table lists executed contract runners', () => {
    expect(run(fixture()).ports[0]?.contractTests).toEqual(['test/contracts/things.test.ts'])
  })

  test('slug: folder name drifting from the title is a warning', () => {
    const root = fixture()
    edit(root, `${S}/story.md`, s => s.replace('title: Do thing', 'title: Do another thing'))
    expect(rulesOf(root)).toEqual(['gen-fresh'])
    regen(root)
    expect(rulesOf(root)).toEqual([])
    expect(rulesOf(root, 'warning')).toEqual(['slug'])
  })

  test('superseded stories are listed but exempt from story rules', () => {
    const root = fixture()
    edit(root, `${S}/story.md`, s => s.replace('status: done', 'status: superseded'))
    edit(root, `${S}/do-thing.ts`, s => s.replace('// @implements S-001\n', ''))
    append(root, `${S}/spec.md`, '\n#### Scenario: Retired case {#S-001.3}\n')
    const r = run(root)
    expect(r.ok).toBe(true)
    expect(r.rows.map(x => x.status)).toEqual(['superseded'])
  })

  test('wiring: a multi-line import of a story in the composition root is allowed', () => {
    const root = fixture()
    edit(root, 'src/entry/composition.ts', s => s.replace("import { doThing } from '../../stories/S-001-do-thing/do-thing'", "import {\n  doThing,\n} from '../../stories/S-001-do-thing/do-thing'"))
    expect(rulesOf(root)).toEqual([])
  })

  test('port-adapter: naming a port only in a comment does not count as an adapter', () => {
    const root = fixture()
    append(root, 'src/ports/thing-store.ts', '\nexport interface Mailer {\n  send(): Promise<void>\n}\n')
    append(root, 'src/adapters/memory/things.ts', '// TODO: a Mailer adapter\n')
    expect(rulesOf(root, 'warning')).toEqual(['port-adapter'])
  })

  test('requirement-shape: exactly one SHALL statement', () => {
    const root = fixture()
    edit(root, `${S}/spec.md`, s => s.replace('WHEN asked THE SYSTEM SHALL do the thing.', 'WHEN asked THE SYSTEM SHALL do the thing.\nWHEN asked twice THE SYSTEM SHALL do it twice.'))
    expect(rulesOf(root)).toEqual(['requirement-shape'])
    edit(root, `${S}/spec.md`, s => s.replace(/WHEN asked.*\n.*twice\./, 'The thing gets done.'))
    expect(rulesOf(root)).toEqual(['requirement-shape'])
  })

  test('requirement-shape: SHALL inside scenarios does not count', () => {
    const root = fixture()
    append(root, `${S}/spec.md`, '- THEN THE SYSTEM SHALL say so\n')
    expect(rulesOf(root)).toEqual([])
  })

  test('requirement-tag: one requirement per story', () => {
    const root = fixture()
    append(root, `${S}/spec.md`, '\n### Requirement: Another {#S-001}\n')
    expect(rulesOf(root)).toEqual(['requirement-tag'])
  })

  test('must-pass: the failure message is included', () => {
    const root = fixture()
    edit(root, '.storyspec/vitest.json', s => s.replace('"S-001.2 Does it twice", "status": "passed"', '"S-001.2 Does it twice", "status": "failed", "failureMessages": ["AssertionError: expected 2 to be 3\\n    at do-thing.test.ts:7:5"]'))
    const f = run(root).findings.find(x => x.rule === 'must-pass')
    expect(f?.message).toContain('AssertionError: expected 2 to be 3')
  })

  test('draft stories only warn about gaps', () => {
    const root = fixture()
    newStory(root, loadConfig(root), 'Undo thing', 'E-1 Things', new Date('2026-10-07'))
    regen(root)
    const r = run(root)
    expect(r.ok).toBe(true)
    expect([...new Set(r.findings.filter(f => f.severity === 'warning').map(f => f.rule))].sort()).toEqual(['implementation', 'untested-scenario'])
    expect(existsSync(join(root, 'stories/S-002-undo-thing/scenarios.gen.ts'))).toBe(true)
  })

  test('empty front-matter fields stay empty', () => {
    const root = fixture()
    edit(root, `${S}/story.md`, s => s.replace('epic: E-1 Things', 'epic:'))
    const r = run(root)
    expect(r.rows[0]).toMatchObject({ epic: '', status: 'done' })
    expect(r.ok).toBe(true)
  })

  test('a custom idPrefix is honoured', () => {
    const root = fixture()
    writeFileSync(join(root, 'storyspec.config.json'), JSON.stringify({ idPrefix: 'US' }))
    newStory(root, loadConfig(root), 'Prefixed', '', new Date('2026-10-07'))
    expect(existsSync(join(root, 'stories/US-001-prefixed/story.md'))).toBe(true)
  })

  test('config: unknown keys and wrong types are rejected', () => {
    const root = fixture()
    writeFileSync(join(root, 'storyspec.config.json'), JSON.stringify({ idPrefx: 'S', wiring: 'x' }))
    expect(() => loadConfig(root)).toThrow(/unknown key "idPrefx".*"wiring" should be a list of strings/)
  })

  test('failing-test: a failing scenario fails the trace whatever the status; a draft\'s only warns', () => {
    const root = fixture()
    const report = '.storyspec/vitest.json'
    edit(root, report, r => r.replace('{ "title": "S-001.2 Does it twice", "status": "passed" }', '{ "title": "S-001.2 Does it twice", "status": "failed", "failureMessages": ["expected 2 to be 3"] }'))
    edit(root, `${S}/story.md`, s => s.replace('status: done', 'status: in-progress'))
    expect(rulesOf(root)).toEqual(['failing-test'])
    expect(run(root).findings.find(f => f.rule === 'failing-test')?.message).toContain('expected 2 to be 3')
    edit(root, `${S}/story.md`, s => s.replace('status: in-progress', 'status: draft'))
    expect(rulesOf(root)).toEqual([])
    expect(rulesOf(root, 'warning')).toContain('failing-test')
  })

  test('failing-test: a failing test outside stories, or a file that crashed, fails the trace', () => {
    const root = fixture()
    edit(root, '.storyspec/vitest.json', r => r.replace('{ "title": "saves a thing", "status": "passed" }', '{ "title": "saves a thing", "fullName": "ThingStore contract: memory saves a thing", "status": "failed", "failureMessages": ["lost it"] }'))
    expect(run(root).findings.filter(f => f.rule === 'failing-test').map(f => [f.file, f.message.split('\n')[0]]))
      .toEqual([['test/contracts/things.test.ts', '"ThingStore contract: memory saves a thing" fails']])
    const crashed = fixture()
    edit(crashed, '.storyspec/vitest.json', r => r.replace('] }\n] }', '] },\n  { "name": "test/broken.test.ts", "status": "failed", "message": "Cannot find module x", "assertionResults": [] }\n] }'))
    expect(run(crashed).findings.filter(f => f.rule === 'failing-test').map(f => [f.file, f.message.split('\n')[0]])).toEqual([['test/broken.test.ts', 'the file fails']])
  })

  test('config rules: a project can lower, raise or turn off a rule', () => {
    const root = fixture()
    edit(root, `${S}/spec.md`, s => s + '\n#### Scenario: Extra {#S-001.3}\n\n- GIVEN x\n- WHEN y\n- THEN z\n')
    regen(root)
    writeFileSync(join(root, 'storyspec.config.json'), JSON.stringify({ rules: { 'untested-scenario': 'warning' } }))
    expect(rulesOf(root)).toEqual([])
    expect(rulesOf(root, 'warning')).toContain('untested-scenario')
    writeFileSync(join(root, 'storyspec.config.json'), JSON.stringify({ rules: { 'untested-scenario': 'off' } }))
    expect(run(root).findings.some(f => f.rule === 'untested-scenario')).toBe(false)
    writeFileSync(join(root, 'storyspec.config.json'), JSON.stringify({ rules: { slug: 'loud' } }))
    expect(() => loadConfig(root)).toThrow(/"rules" should map rule names/)
  })

  test('framework-sync: stale or missing agent guidance is a warning, never an error', () => {
    const root = fixture()
    edit(root, 'AGENTS.md', s => s.replace(/storyspec:begin \S+/, 'storyspec:begin 0.0.1'))
    expect(rulesOf(root)).toEqual([])
    expect(run(root).findings.filter(f => f.rule === 'framework-sync').map(f => f.message)).toEqual(['AGENTS.md has storyspec guidance from another version; run storyspec sync'])
    edit(root, 'AGENTS.md', s => s.replace('## A story', '## A story, our way'))
    expect(run(root).findings.filter(f => f.rule === 'framework-sync').map(f => f.message)).toEqual(['AGENTS.md has a storyspec block edited by hand; run storyspec sync'])
    rmSync(join(root, 'AGENTS.md'))
    expect(run(root).findings.filter(f => f.rule === 'framework-sync').map(f => f.message)).toEqual(['AGENTS.md is missing the storyspec guidance; run storyspec sync'])
  })
})
