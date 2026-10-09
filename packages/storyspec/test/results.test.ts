// JUnit reports: scenario IDs written the way each language allows, and a project whose code and tests aren't TypeScript.
// Results come from the python fixture's canned .storyspec/junit.xml (what `pytest --junitxml` writes).
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { trace } from '../src/index.js'
import { readProof } from '../src/proof.js'
import { junitTitle } from '../src/trace/results.js'
import { sync } from '../src/sync.js'

const roots: string[] = []
afterEach(() => { for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true }) })

const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), 'storyspec-py-'))
  cpSync(join(import.meta.dirname, 'fixtures/python'), root, { recursive: true })
  sync(root)
  roots.push(root)
  return root
}
const S = 'stories/S-001-greet-a-person'
const edit = (root: string, file: string, f: (s: string) => string) =>
  writeFileSync(join(root, file), f(readFileSync(join(root, file), 'utf8')))
const junit = (...cases: string[]) =>
  `<?xml version="1.0" encoding="utf-8"?><testsuites><testsuite name="pytest">${cases.join('')}</testsuite></testsuites>`
const pass = (name: string, props = '') => `<testcase classname="tests.test_greet" name="${name}">${props}</testcase>`
const fail = (name: string, message: string) => `<testcase classname="tests.test_greet" name="${name}"><failure message="${message}">trace</failure></testcase>`
const rulesOf = async (root: string, severity: 'error' | 'warning' = 'error') =>
  [...new Set((await trace(root, { write: false })).findings.filter(f => f.severity === severity).map(f => f.rule))].sort()

describe('junitTitle', () => {
  test.each([
    ['test_S_001_1_greets_by_name', {}, 'local', 'S-001.1 greets by name'],
    ['test_S_012_10', {}, 'local', 'S-012.10'],
    ['test_S_001_1[ada]', {}, 'local', 'S-001.1 [ada]'],
    ['test_S_001_1__deployed__greets', {}, 'local', 'S-001.1 [deployed] greets'],
    ['test_S_001_1_greets', {}, 'deployed', 'S-001.1 [deployed] greets'],
    ['test_greets', { scenario: 'S-001.2' }, 'local', 'S-001.2 test_greets'],
    ['test_greets', { scenario: 'S-001.2', tier: 'deployed' }, 'local', 'S-001.2 [deployed] test_greets'],
    ['S-001.1 greets by name', {}, 'local', 'S-001.1 greets by name'],
    ['S-001.1 [deployed] greets', {}, 'local', 'S-001.1 [deployed] greets'],
    ['S-001.1 greets', {}, 'staging', 'S-001.1 [staging] greets'],
  ])('%s %o in %s → %s', (name, props, tier, expected) => {
    expect(junitTitle('S', name, props, tier)).toBe(expected)
  })

  test.each(['test_greets', 'test_S_001', 'test_S_001_x', 'TEST_S_001_1', 'test_SS_001_1'])('%s names no scenario', name => {
    expect(junitTitle('S', name, {})).toBeUndefined()
  })
})

describe('a Python project', () => {
  test('is clean from its JUnit report, with no generated TypeScript', async () => {
    const root = fixture()
    const r = await trace(root, { write: false })
    expect(r.findings).toEqual([])
    expect(r.rows.map(x => [x.story, x.status, x.implementation, x.scenarios.map(s => s.outcome)]))
      .toEqual([['S-001', 'done', 'app/greet.py', ['pass', 'pass']]])
    expect(existsSync(join(root, S, 'scenarios.gen.ts'))).toBe(false)
  })

  test('a failed test fails its scenario', async () => {
    const root = fixture()
    writeFileSync(join(root, '.storyspec/junit.xml'), junit(fail('test_S_001_1_greets_by_name', 'assert &apos;Hi&apos; == &apos;Hello, Ada!&apos;'), pass('test_S_001_2')))
    expect(await rulesOf(root)).toEqual(['failing-test'])
    const r = await trace(root, { write: false })
    expect(r.findings[0]!.message).toContain("assert 'Hi' == 'Hello, Ada!'")
  })

  test('a failure message keeps its line breaks', async () => {
    const root = fixture()
    writeFileSync(join(root, '.storyspec/junit.xml'), junit(fail('test_S_001_1', 'first&#10;second'), pass('test_S_001_2')))
    const r = await trace(root, { write: false })
    expect(r.findings[0]!.message).toMatch(/first\n\s*second/)
  })

  test('a scenario no test ran is untested', async () => {
    const root = fixture()
    writeFileSync(join(root, '.storyspec/junit.xml'), junit(pass('test_S_001_1_greets_by_name')))
    expect(await rulesOf(root)).toEqual(['untested-scenario'])
  })

  test('a test naming a scenario the spec lacks is an orphan', async () => {
    const root = fixture()
    writeFileSync(join(root, '.storyspec/junit.xml'), junit(pass('test_S_001_1'), pass('test_S_001_2'), pass('test_S_001_3')))
    expect(await rulesOf(root)).toEqual(['orphan-test'])
  })

  test('a failure outside any scenario fails the trace', async () => {
    const root = fixture()
    writeFileSync(join(root, '.storyspec/junit.xml'), junit(pass('test_S_001_1'), pass('test_S_001_2'), fail('test_store_contract', 'boom')))
    expect(await rulesOf(root)).toEqual(['failing-test'])
  })

  test('a skipped test proves nothing', async () => {
    const root = fixture()
    writeFileSync(join(root, '.storyspec/junit.xml'), junit(pass('test_S_001_1'), '<testcase classname="t" name="test_S_001_2"><skipped message="later"/></testcase>'))
    const r = await trace(root, { write: false })
    expect(r.rows[0]!.status).toBe('in-progress')
    expect(r.rows[0]!.scenarios.map(s => s.outcome)).toEqual(['pass', 'not-run'])
  })

  test('implementedBy must name files that exist', async () => {
    const root = fixture()
    edit(root, `${S}/story.md`, s => s.replace('implementedBy: app/greet.py', 'implementedBy: app/greet.py, app/missing.py'))
    expect(await rulesOf(root)).toEqual(['implementation'])
  })

  test('without implementedBy or @implements, the story has no implementation', async () => {
    const root = fixture()
    edit(root, `${S}/story.md`, s => s.replace('implementedBy: app/greet.py\n', ''))
    // It then counts as a TypeScript story, which needs its generated file too.
    expect(await rulesOf(root)).toEqual(['gen-fresh', 'implementation'])
  })

  test('another tier records what its command ran, whether or not the tests name the tier', async () => {
    const root = fixture()
    edit(root, 'storyspec.config.json', () => JSON.stringify({
      testCommand: 'true', testReport: '.storyspec/junit.xml',
      tiers: { deployed: { command: 'true', report: '.storyspec/deployed.xml' } },
      defaultProof: ['local', 'deployed'],
    }))
    writeFileSync(join(root, '.storyspec/deployed.xml'), junit(pass('test_S_001_1_greets_by_name'), fail('test_S_001_2', 'no')))
    await trace(root, { write: false, tier: 'deployed', now: '2026-10-08T19:00:00Z' })
    const proof = readProof({ root, config: { storiesDir: 'stories' } as never })
    expect(Object.fromEntries(Object.entries(proof.scenarios).map(([id, t]) => [id, t.deployed?.outcome]))).toEqual({ 'S-001.1': 'pass', 'S-001.2': 'fail' })
    const local = await trace(root, { write: false })
    expect(local.rows[0]!.status).toBe('in-progress')
    expect(local.findings.map(f => f.rule)).toEqual(['proof'])
  })
})
