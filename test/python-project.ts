// A copy of the python fixture (packages/storyspec/test/fixtures/python): a project whose code and tests are Python,
// with a canned pytest JUnit report. Each test gets its own copy and changes one thing.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach } from 'vitest'
import { sync, trace } from '../packages/storyspec/src/index.js'

const roots: string[] = []
afterEach(() => { for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true }) })

export const STORY = 'stories/S-001-greet-a-person'

export const pythonProject = () => {
  const root = mkdtempSync(join(tmpdir(), 'storyspec-py-'))
  cpSync(join(import.meta.dirname, '../packages/storyspec/test/fixtures/python'), root, { recursive: true })
  sync(root)
  roots.push(root)
  return root
}

export const edit = (root: string, file: string, f: (s: string) => string) =>
  writeFileSync(join(root, file), f(readFileSync(join(root, file), 'utf8')))

export const junit = (...cases: string[]) =>
  `<?xml version="1.0" encoding="utf-8"?><testsuites><testsuite name="pytest">${cases.join('')}</testsuite></testsuites>`
export const pass = (name: string, props = '') => `<testcase classname="tests.test_greet" name="${name}">${props}</testcase>`
export const fail = (name: string, message: string) =>
  `<testcase classname="tests.test_greet" name="${name}"><failure message="${message}">trace</failure></testcase>`
export const report = (root: string, ...cases: string[]) => writeFileSync(join(root, '.storyspec/junit.xml'), junit(...cases))

export const rulesOf = async (root: string, severity: 'error' | 'warning' = 'error') =>
  [...new Set((await trace(root, { write: false })).findings.filter(f => f.severity === severity).map(f => f.rule))].sort()
