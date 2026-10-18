import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { expect } from 'vitest'
import { story } from 'storyspec/vitest'
import { trace } from '../../packages/storyspec/src/index.js'
import { edit, pythonProject, STORY } from '../../test/python-project.js'
import { gen } from './scenarios.gen.js'

const write = (root: string, file: string, text: string) => {
  mkdirSync(dirname(join(root, file)), { recursive: true })
  writeFileSync(join(root, file), text)
}
const unclaimed = async (root: string) =>
  (await trace(root, { write: false })).findings.filter(f => f.rule === 'unclaimed-code').map(f => [f.severity, f.file])

story(gen, {
  'S-007.1': async () => {
    const root = pythonProject()
    write(root, 'app/extra.py', 'def extra():\n    return 1\n')
    expect(await unclaimed(root)).toEqual([['warning', 'app/extra.py']])
  },

  'S-007.2': async () => {
    const root = pythonProject()
    write(root, 'app/helpers.py', 'def shout(s):\n    return s.upper()\n')
    edit(root, 'app/greet.py', s => `from app.helpers import shout\n${s}`)
    write(root, 'app/cli.py', 'from app.greet import greet\n\nprint(greet("Ana"))\n')
    expect(await unclaimed(root)).toEqual([])
  },

  'S-007.3': async () => {
    const root = pythonProject()
    write(root, 'app/extra.py', 'def extra():\n    return 1\n')
    edit(root, 'storyspec.config.json', s => JSON.stringify({ ...JSON.parse(s), unspecified: ['app/extra.py'] }))
    expect(await unclaimed(root)).toEqual([])
  },

  'S-007.4': async () => {
    const root = pythonProject()
    for (const f of ['tests/test_more.py', 'conftest.py', 'app/__init__.py']) write(root, f, '\n')
    write(root, 'dist/bundle.js', 'export {}\n')
    write(root, 'vendor/lib.min.js', 'var x=1\n')
    write(root, 'tool.config.js', 'export default {}\n')
    expect(await unclaimed(root)).toEqual([])
  },

  'S-007.5': async () => {
    const root = pythonProject()
    write(root, 'ios/Home.swift', 'struct Home {}\n')
    expect(await unclaimed(root)).toEqual([['warning', 'ios/Home.swift']])
    edit(root, `${STORY}/story.md`, s => s.replace('implementedBy: app/greet.py', 'implementedBy: app/greet.py, ios/Home.swift'))
    expect(await unclaimed(root)).toEqual([])
  },
})
