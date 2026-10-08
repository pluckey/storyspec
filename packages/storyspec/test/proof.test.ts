// Proof tiers: what each scenario has been proven by, recorded in stories/PROOF.json, and the status worked out from it.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { loadConfig } from '../src/config.js'
import { writeGen } from '../src/gen.js'
import { trace } from '../src/index.js'
import { readProof, recordManual } from '../src/proof.js'
import { traceMarkdown } from '../src/trace/report.js'
import { scan, scenarioHash } from '../src/trace/scan.js'
import { sync } from '../src/sync.js'

const base = join(import.meta.dirname, 'fixtures/base')
const roots: string[] = []
afterEach(() => { for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true }) })

const S = 'stories/S-001-do-thing'
const SPEC = `### Requirement: Thing {#S-001}

WHEN asked THE SYSTEM SHALL do the thing.

#### Scenario: Does it {#S-001.1}

#### Scenario: Does it twice {#S-001.2 proof=local,deployed}

- GIVEN a thing
- THEN it is done twice

#### Scenario: Looks right {#S-001.3 proof=manual}
`
// A project with a deployed tier, whose S-001.2 needs local and deployed proof and S-001.3 a person's.
const project = () => {
  const root = mkdtempSync(join(tmpdir(), 'storyspec-proof-'))
  cpSync(base, root, { recursive: true })
  sync(root)
  writeFileSync(join(root, 'storyspec.config.json'), JSON.stringify({ tiers: { deployed: { command: 'true' } } }))
  writeFileSync(join(root, S, 'spec.md'), SPEC)
  writeFileSync(join(root, S, 'do-thing.test.ts'), `import { story } from 'storyspec/vitest'
import { gen } from './scenarios.gen'

story(gen, {
  'S-001.1': () => {},
  'S-001.2': { local: () => {}, deployed: () => {} },
  'S-001.3': {},
})
`)
  writeGen(root, scan(root, loadConfig(root)).stories)
  roots.push(root)
  return root
}
// The test report a run of `tier` writes.
type Result = { title: string; status: 'passed' | 'failed' }
const report = (root: string, results: Result[], contracts = true) => writeFileSync(join(root, '.storyspec/vitest.json'), JSON.stringify({ testResults: [
  { name: `${S}/do-thing.test.ts`, assertionResults: results },
  ...(contracts ? [{ name: 'test/contracts/things.test.ts', assertionResults: [{ title: 'saves a thing', status: 'passed' }] }] : []),
] }))
const LOCAL: Result[] = [{ title: 'S-001.1 Does it', status: 'passed' }, { title: 'S-001.2 [local] Does it twice', status: 'passed' }]
const DEPLOYED = (status: Result['status'] = 'passed'): Result[] => [...LOCAL, { title: 'S-001.2 [deployed] Does it twice', status }]
const run = (root: string, opts: Parameters<typeof trace>[1] = {}) => trace(root, { write: false, now: '2026-10-08T12:00:00.000Z', ...opts })
const states = async (root: string, id: string) => (await run(root)).rows[0]!.scenarios.find(s => s.id === id)!.tiers.map(t => `${t.tier}:${t.state}`)

describe('proof', () => {
  test('a scenario\'s hash follows its wording, not its whitespace or tag', async () => {
    const at = SPEC.indexOf('{#S-001.2')
    const h = scenarioHash(SPEC, at)
    expect(scenarioHash(SPEC.replace('- GIVEN a thing', '-   GIVEN   a thing'), at + 0)).toBe(h)
    expect(scenarioHash(SPEC.replace('proof=local,deployed', 'proof=deployed'), SPEC.replace('proof=local,deployed', 'proof=deployed').indexOf('{#S-001.2'))).toBe(h)
    expect(scenarioHash(SPEC.replace('done twice', 'done thrice'), at)).not.toBe(h)
  })

  test('a story is in progress until every scenario is proven in every tier it needs', async () => {
    const root = project()
    report(root, LOCAL)
    expect((await run(root)).rows[0]!.status).toBe('in-progress')
    expect(await states(root, 'S-001.2')).toEqual(['local:proven', 'deployed:awaiting'])
    expect(await states(root, 'S-001.3')).toEqual(['manual:awaiting'])
    // Nothing to run for a manual scenario, so it isn't untested.
    expect((await run(root)).findings.filter(f => f.rule === 'untested-scenario')).toEqual([])
  })

  test('a deployed run is recorded for the scenarios that need that tier, and a person proves the manual one', async () => {
    const root = project()
    report(root, DEPLOYED())
    await run(root, { tier: 'deployed' })
    const proof = readProof({ root, config: loadConfig(root) })
    expect(Object.keys(proof.scenarios)).toEqual(['S-001.2'])
    expect(proof.scenarios['S-001.2']!.deployed).toMatchObject({ outcome: 'pass', at: '2026-10-08T12:00:00.000Z', version: '1' })
    // The contract suite that ran exercised the memory adapter in the deployed tier.
    expect(Object.keys(proof.adapters)).toEqual(['src/adapters/memory/things.ts'])

    report(root, LOCAL)
    expect((await run(root)).rows[0]!.status).toBe('in-progress')
    expect(recordManual(scan(root, loadConfig(root)), 'S-001', 'manual', { outcome: 'pass', at: '2026-10-08T13:00:00.000Z', by: 'ana' })).toEqual(['S-001.3'])
    const r = (await run(root))
    expect(r.rows[0]!.status).toBe('done')
    expect(r.ok).toBe(true)
    const md = traceMarkdown(r.rows, r.ports)
    expect(md).toContain('done (v1)')
    expect(md).toContain('✓ local · ✓ deployed 2026-10-08')
    expect(md).toContain('✓ manual 2026-10-08 (ana)')
    expect(md).toContain('src/adapters/memory/things.ts (✓ local, ✓ deployed 2026-10-08)')
  })

  test('a proof of other wording is stale: a warning, and the story is no longer done', async () => {
    const root = project()
    report(root, DEPLOYED())
    await run(root, { tier: 'deployed' })
    recordManual(scan(root, loadConfig(root)), 'S-001.3', 'manual', { outcome: 'pass', at: '2026-10-08T13:00:00.000Z' })
    report(root, LOCAL)
    expect((await run(root)).rows[0]!.status).toBe('done')

    writeFileSync(join(root, S, 'spec.md'), SPEC.replace('done twice', 'done twice, quickly'))
    writeGen(root, scan(root, loadConfig(root)).stories)
    const r = (await run(root))
    expect(r.rows[0]!.status).toBe('in-progress')
    expect(r.ok).toBe(true)
    expect(r.findings.filter(f => f.rule === 'proof').map(f => [f.severity, f.message])).toEqual([
      ['warning', 'S-001.2: its text changed since it was proven in the deployed tier on 2026-10-08; prove it again (storyspec trace --tier deployed)'],
    ])
  })

  test('a failed recorded tier fails the trace, and --require-proven fails until every story is done', async () => {
    const root = project()
    report(root, DEPLOYED('failed'))
    const r = (await run(root, { tier: 'deployed' }))
    expect(r.findings.filter(f => f.rule === 'proof').map(f => f.severity)).toEqual(['error'])
    expect(r.ok).toBe(false)

    report(root, DEPLOYED())
    await run(root, { tier: 'deployed' })
    report(root, LOCAL)
    const gate = (await run(root, { requireProven: true }))
    expect(gate.ok).toBe(false)
    expect(gate.findings.find(f => f.rule === 'unproven')?.message).toBe('S-001: not done; still to prove: S-001.3 manual (awaiting)')
  })

  test('prove refuses a scenario that doesn\'t need the tier', async () => {
    const root = project()
    expect(() => recordManual(scan(root, loadConfig(root)), 'S-001.1', 'manual', { outcome: 'pass', at: 'x' }))
      .toThrow("S-001.1 doesn't need the manual tier (its scenarios need local)")
    expect(() => recordManual(scan(root, loadConfig(root)), 'S-009', 'manual', { outcome: 'pass', at: 'x' })).toThrow('No story or scenario S-009')
  })

  test('PROOF.json is written sorted, so a run changes only its own lines', async () => {
    const root = project()
    report(root, DEPLOYED())
    await run(root, { tier: 'deployed' })
    const text = readFileSync(join(root, 'stories/PROOF.json'), 'utf8')
    expect(text.indexOf('"adapters"')).toBeLessThan(text.indexOf('"scenarios"'))
    expect(text.indexOf('"at"')).toBeLessThan(text.indexOf('"hash"'))
  })

  test('a story still written as done gets a warning to migrate', async () => {
    const root = project()
    writeFileSync(join(root, S, 'story.md'), readFileSync(join(root, S, 'story.md'), 'utf8').replace('status: in-progress', 'status: done'))
    report(root, LOCAL)
    expect((await run(root)).findings.filter(f => f.rule === 'derived-status').map(f => f.severity)).toEqual(['warning'])
  })
})
