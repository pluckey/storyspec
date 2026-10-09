import { expect } from 'vitest'
import { story } from 'storyspec/vitest'
import { trace } from '../../packages/storyspec/src/index.js'
import { edit, pythonProject, rulesOf, STORY } from '../../test/python-project.js'
import { gen } from './scenarios.gen.js'

story(gen, {
  'S-002.1': async () => {
    const root = pythonProject()
    const r = await trace(root, { write: false })
    expect(r.findings.filter(f => f.rule === 'implementation')).toEqual([])
    expect(r.rows[0]!.implementation).toBe('app/greet.py')
  },

  'S-002.2': async () => {
    const root = pythonProject()
    edit(root, `${STORY}/story.md`, s => s.replace('implementedBy: app/greet.py', 'implementedBy: app/greet.py, app/missing.py'))
    const r = await trace(root, { write: false })
    expect(await rulesOf(root)).toEqual(['implementation'])
    expect(r.findings[0]!.message).toContain('app/missing.py')
  },

  'S-002.3': async () => {
    const root = pythonProject()
    edit(root, `${STORY}/story.md`, s => s.replace('implementedBy: app/greet.py\n', ''))
    expect(await rulesOf(root)).toEqual(['ids-outside-stories', 'implementation'])
  },
})
