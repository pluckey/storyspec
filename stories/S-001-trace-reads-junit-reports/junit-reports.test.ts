import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect } from 'vitest'
import { story } from 'storyspec/vitest'
import { readProof, trace } from '../../packages/storyspec/src/index.js'
import { junitTitle } from '../../packages/storyspec/src/trace/results.js'
import { edit, fail, pass, pythonProject, report, rulesOf, STORY } from '../../test/python-project.js'
import { gen } from './scenarios.gen.js'

story(gen, {
  'S-001.1': () => {
    const cases: [string, Record<string, string>, string][] = [
      ['test_S_001_1_greets_by_name', {}, 'S-001.1 greets by name'],
      ['test_S_012_10', {}, 'S-012.10'],
      ['test_S_001_1[ada]', {}, 'S-001.1 [ada]'],
      ['test_S_001_1__deployed__greets', {}, 'S-001.1 [deployed] greets'],
      ['test_greets', { scenario: 'S-001.2' }, 'S-001.2 test_greets'],
      ['test_greets', { scenario: 'S-001.2', tier: 'deployed' }, 'S-001.2 [deployed] test_greets'],
      ['S-001.1 greets by name', {}, 'S-001.1 greets by name'],
      ['S-001.1 [deployed] greets', {}, 'S-001.1 [deployed] greets'],
    ]
    for (const [name, props, expected] of cases) expect(junitTitle('S', name, props), name).toBe(expected)
  },

  'S-001.2': () => {
    expect(junitTitle('S', 'test_S_001_1_greets', {}, 'deployed')).toBe('S-001.1 [deployed] greets')
    expect(junitTitle('S', 'S-001.1 greets', {}, 'staging')).toBe('S-001.1 [staging] greets')
  },

  'S-001.3': () => {
    for (const name of ['test_greets', 'test_S_001', 'test_S_001_x', 'TEST_S_001_1', 'test_SS_001_1'])
      expect(junitTitle('S', name, {}), name).toBeUndefined()
  },

  'S-001.4': async () => {
    const root = pythonProject()
    const r = await trace(root, { write: false })
    expect(r.findings).toEqual([])
    expect(r.rows.map(x => [x.story, x.status, x.scenarios.map(s => s.outcome)])).toEqual([['S-001', 'done', ['pass', 'pass']]])
    expect(existsSync(join(root, STORY, 'scenarios.gen.ts'))).toBe(false)
  },

  'S-001.5': async () => {
    const root = pythonProject()
    report(root, fail('test_S_001_1_greets_by_name', 'assert &apos;Hi&apos; == &apos;Hello, Ada!&apos;'), pass('test_S_001_2'))
    expect(await rulesOf(root)).toEqual(['failing-test'])
    expect((await trace(root, { write: false })).findings[0]!.message).toContain("assert 'Hi' == 'Hello, Ada!'")
  },

  'S-001.6': async () => {
    const root = pythonProject()
    report(root, fail('test_S_001_1', 'first&#10;second'), pass('test_S_001_2'))
    expect((await trace(root, { write: false })).findings[0]!.message).toMatch(/first\n\s*second/)
  },

  'S-001.7': async () => {
    const root = pythonProject()
    report(root, pass('test_S_001_1_greets_by_name'))
    expect(await rulesOf(root)).toEqual(['untested-scenario'])
  },

  'S-001.8': async () => {
    const root = pythonProject()
    report(root, pass('test_S_001_1'), pass('test_S_001_2'), pass('test_S_001_3'))
    expect(await rulesOf(root)).toEqual(['orphan-test'])
  },

  'S-001.9': async () => {
    const root = pythonProject()
    report(root, pass('test_S_001_1'), pass('test_S_001_2'), fail('test_store_contract', 'boom'))
    expect(await rulesOf(root)).toEqual(['failing-test'])
  },

  'S-001.10': async () => {
    const root = pythonProject()
    report(root, pass('test_S_001_1'), '<testcase classname="t" name="test_S_001_2"><skipped message="later"/></testcase>')
    const r = await trace(root, { write: false })
    expect(r.rows[0]!.status).toBe('in-progress')
    expect(r.rows[0]!.scenarios.map(s => s.outcome)).toEqual(['pass', 'not-run'])
  },

  'S-001.11': async () => {
    const root = pythonProject()
    edit(root, 'storyspec.config.json', () => JSON.stringify({
      testCommand: 'true', testReport: '.storyspec/junit.xml',
      tiers: { deployed: { command: 'true', report: '.storyspec/deployed.xml' } },
      defaultProof: ['local', 'deployed'],
    }))
    writeFileSync(join(root, '.storyspec/deployed.xml'), `<testsuite>${pass('test_S_001_1_greets_by_name')}${fail('test_S_001_2', 'no')}</testsuite>`)
    await trace(root, { write: false, tier: 'deployed', now: '2026-10-08T19:00:00Z' })
    const proof = readProof({ root, config: { storiesDir: 'stories' } as never })
    expect(Object.fromEntries(Object.entries(proof.scenarios).map(([id, t]) => [id, t.deployed?.outcome]))).toEqual({ 'S-001.1': 'pass', 'S-001.2': 'fail' })
  },
})
