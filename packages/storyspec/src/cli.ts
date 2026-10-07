#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { loadConfig } from './config.js'
import { genStatus, writeGen } from './gen.js'
import { newStory } from './new-story.js'
import { trace } from './index.js'
import { findingsText, portTable, table } from './trace/report.js'
import { scan } from './trace/scan.js'

const HELP = `storyspec: story-first, spec-driven development

Usage:
  storyspec trace [--no-run] [--json]   Run tests, write stories/TRACE.md, check every rule
  storyspec gen [--check]               Write scenarios.gen.ts for each story (--check: fail if stale)
  storyspec story "<title>" [--epic "<epic>"]   Create the next story folder from templates
  storyspec check                       gen --check, then trace

Options:
  --root <dir>   Repo root (default: nearest folder with package.json)
`

const args = process.argv.slice(2)
const flag = (name: string) => { const i = args.indexOf(name); if (i < 0) return false; args.splice(i, 1); return true }
const option = (name: string) => { const i = args.indexOf(name); if (i < 0) return undefined; const v = args[i + 1]; args.splice(i, 2); return v }

const findRoot = (start: string) => {
  let dir = resolve(start)
  while (!existsSync(join(dir, 'package.json'))) {
    const up = resolve(dir, '..')
    if (up === dir) return resolve(start)
    dir = up
  }
  return dir
}

const main = (): number => {
  if (flag('--help') || flag('-h') || args.length === 0) { console.log(HELP); return 0 }
  const root = findRoot(option('--root') ?? process.cwd())
  const command = args.shift()
  const config = loadConfig(root)

  if (command === 'gen') {
    const check = flag('--check')
    const stories = scan(root, config).stories
    if (check) {
      const stale = genStatus(root, stories).filter(g => g.state !== 'fresh')
      for (const g of stale) console.error(`${g.file} is ${g.state}`)
      if (stale.length) { console.error('Run: storyspec gen'); return 1 }
      return 0
    }
    const written = writeGen(root, stories)
    for (const g of written) console.log(`wrote ${g.file}`)
    if (!written.length) console.log('scenarios.gen.ts files are up to date')
    return 0
  }

  if (command === 'story') {
    const epic = option('--epic') ?? ''
    const title = args.join(' ').trim()
    if (!title) { console.error('usage: storyspec story "<title>" [--epic "<epic>"]'); return 1 }
    const { id, folder } = newStory(root, config, title, epic)
    writeGen(root, scan(root, config).stories)
    console.log(`${id}  ${folder}/`)
    return 0
  }

  if (command === 'trace' || command === 'check') {
    const json = flag('--json')
    const run = !flag('--no-run')
    const result = trace(root, { runTests: run })
    if (json) console.log(JSON.stringify(result, null, 2))
    else {
      console.log(table(result.rows))
      if (result.ports.length) console.log('\n' + portTable(result.ports))
      const text = findingsText(result.findings)
      if (text) (result.ok ? console.log : console.error)(text)
      const n = result.rows.reduce((a, r) => a + r.scenarios.length, 0)
      if (result.ok) console.log(`\nOK: ${result.rows.length} stories, ${n} scenarios traced.`)
    }
    return result.ok ? 0 : 1
  }

  console.error(`Unknown command "${command}".\n\n${HELP}`)
  return 1
}

try {
  process.exitCode = main()
} catch (e) {
  console.error((e as Error).message)
  process.exitCode = 1
}
