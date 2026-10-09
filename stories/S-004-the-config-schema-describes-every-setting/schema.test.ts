import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect } from 'vitest'
import { story } from 'storyspec/vitest'
import { defaults, loadConfig } from '../../packages/storyspec/src/config.js'
import { gen } from './scenarios.gen.js'

const schema = JSON.parse(readFileSync(join(import.meta.dirname, '../../packages/storyspec/schema/storyspec.config.schema.json'), 'utf8')) as { properties: Record<string, unknown> }

const load = (config: object) => {
  const root = mkdtempSync(join(tmpdir(), 'storyspec-config-'))
  try {
    writeFileSync(join(root, 'storyspec.config.json'), JSON.stringify(config))
    return () => loadConfig(root)
  } finally {
    setTimeout(() => rmSync(root, { recursive: true, force: true }), 1000)
  }
}

story(gen, {
  'S-004.1': () => {
    expect(Object.keys(schema.properties).filter(k => k !== '$schema').sort()).toEqual(Object.keys(defaults).sort())
  },

  'S-004.2': () => {
    expect(load({ tiers: { deployed: { command: 'x', report: 'a.xml' } } })).not.toThrow()
    expect(load({ tiers: { deployed: { command: 'x', report: ['a.xml', 'b.xml'] } }, testReport: ['c.xml'] })).not.toThrow()
    expect(load({ tiers: { deployed: { command: 'x', report: [] } } })).toThrow(/tiers/)
    expect(load({ tiers: { deployed: { report: 3 } } })).toThrow(/tiers/)
    expect(load({ testReport: [] })).toThrow(/testReport/)
  },
})
