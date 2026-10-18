import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect } from 'vitest'
import { story } from 'storyspec/vitest'
import { trace } from '../../packages/storyspec/src/index.js'
import { edit, fail, junit, pass, pythonProject, rulesOf } from '../../test/python-project.js'
import { gen } from './scenarios.gen.js'

// The python project with testReport listing two JUnit files.
const twoReports = (first: string[], second: string[] | undefined) => {
  const root = pythonProject()
  edit(root, 'storyspec.config.json', () => JSON.stringify({ testCommand: 'true', testReport: ['.storyspec/pytest.xml', '.storyspec/suite.xml'] }))
  writeFileSync(join(root, '.storyspec/pytest.xml'), junit(...first))
  if (second) writeFileSync(join(root, '.storyspec/suite.xml'), junit(...second))
  return root
}

story(gen, {
  'S-003.1': async () => {
    const r = await trace(twoReports([pass('test_S_001_1')], [pass('test_S_001_2')]), { write: false })
    expect(r.findings).toEqual([])
    expect(r.rows[0]!.status).toBe('done')
  },

  'S-003.2': async () => {
    const root = twoReports([pass('test_S_001_1'), pass('test_S_001_2')], ['<testcase name="hurl/tags.hurl"><failure message="Assert failure">x</failure></testcase>'])
    expect(await rulesOf(root)).toEqual(['failing-test'])
  },

  'S-003.3': async () => {
    const r = await trace(twoReports([pass('test_S_001_1'), pass('test_S_001_2')], undefined), { write: false })
    expect(r.findings).toEqual([])
    expect(r.rows[0]!.scenarios.map(s => s.outcome)).toEqual(['pass', 'pass'])
  },

  'S-003.4': async () => {
    const root = twoReports([], undefined)
    const r = await trace(root, { write: false, runTests: true })
    const finding = r.findings.find(f => f.rule === 'tests')
    expect(finding?.message).toBe('"true" did not write .storyspec/pytest.xml or .storyspec/suite.xml')
  },
})
