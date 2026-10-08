#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { loadConfig } from './config.js'
import { genStatus, writeGen } from './gen.js'
import { newStory } from './new-story.js'
import { trace } from './index.js'
import { findingsText, portTable, table } from './trace/report.js'
import { scan } from './trace/scan.js'
import { installedVersion, plan, sync } from './sync.js'
import { recordManual } from './proof.js'
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const HELP = `storyspec: story-first, spec-driven development

Usage:
  storyspec trace [--tier <name>] [--require-proven] [--no-run] [--json]
                                        Run a tier's tests (default local), write stories/TRACE.md, check every rule.
                                        A tier other than local is recorded in stories/PROOF.json.
                                        --require-proven: fail unless every story past ready is done.
  storyspec prove <ID> [--tier manual] [--fail] [--note "<text>"] [--by "<name>"]
                                        Record a proof by hand of a scenario (S-001.2) or of a story's scenarios (S-001)
  storyspec migrate                     Update stories for this version (0.3: status: done becomes in-progress,
                                        since done is now worked out from proof)
  storyspec gen [--check]               Write scenarios.gen.ts for each story (--check: fail if stale)
  storyspec story "<title>" [--epic "<epic>"]   Create the next story folder from templates
  storyspec check                       gen --check, then trace
  storyspec sync [--check] [--force] [--claude]
                                        Bring AGENTS.md (and CLAUDE.md, the /story command and its hooks,
                                        when the project uses Claude Code) up to the installed storyspec version.
                                        --check: change nothing, fail if anything is out of date.
                                        --force: also replace storyspec blocks that were edited by hand.
                                        --claude: write the Claude Code files even if the project has none yet.

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

const gitUser = (root: string) => {
  try { return execSync('git config user.name', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).trim() || undefined } catch { return undefined }
}

const main = async (): Promise<number> => {
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
    const requireProven = flag('--require-proven')
    const tier = option('--tier')
    const result = await trace(root, { runTests: run, tier, requireProven })
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

  if (command === 'prove') {
    const tier = option('--tier') ?? 'manual', note = option('--note'), by = option('--by') ?? gitUser(root)
    const failed = flag('--fail')
    const target = args.shift()
    if (!target) { console.error('usage: storyspec prove <S-001 | S-001.2> [--tier manual] [--fail] [--note "…"] [--by "…"]'); return 1 }
    const ids = recordManual(scan(root, config), target, tier, { outcome: failed ? 'fail' : 'pass', at: new Date().toISOString(), ...(by && { by }), ...(note && { note }) })
    console.log(`Recorded ${failed ? 'a failure' : 'proof'} in the ${tier} tier for ${ids.join(', ')}${by ? ` (by ${by})` : ''}. Run storyspec trace to see where the story stands.`)
    return 0
  }

  if (command === 'migrate') {
    // 0.3: done is derived from proof, so a story written as done goes back to in-progress.
    const changed: string[] = []
    for (const s of scan(root, config).stories) {
      if (s.front.status !== 'done') continue
      const file = join(root, s.dir, 'story.md')
      writeFileSync(file, readFileSync(file, 'utf8').replace(/^status:[ \t]*done[ \t]*$/m, 'status: in-progress'))
      changed.push(s.id)
    }
    console.log(changed.length
      ? `status: done → in-progress for ${changed.join(', ')}. The trace shows each one as done when its scenarios are proven.`
      : 'Nothing to migrate.')
    return 0
  }

  if (command === 'sync') {
    const check = flag('--check'), force = flag('--force'), claude = flag('--claude')
    const changes = check ? plan(root, { claude, force }) : sync(root, { claude, force })
    const v = installedVersion()
    for (const c of changes) {
      const line = `${c.file}: ${c.action === 'edited' ? 'not changed' : check && c.action !== 'unchanged' ? `out of date (would be ${c.action})` : c.action}${c.message ? ` (${c.message})` : ''}`
      ;(c.action === 'edited' ? console.error : console.log)(line)
    }
    const stale = changes.filter(c => c.action !== 'unchanged')
    if (check) { if (stale.length) console.error(`Run: storyspec sync (storyspec ${v})`); return stale.length ? 1 : 0 }
    if (!stale.length) console.log(`Agent guidance is up to date with storyspec ${v}.`)
    return changes.some(c => c.action === 'edited') ? 1 : 0
  }

  console.error(`Unknown command "${command}".\n\n${HELP}`)
  return 1
}

main().then(code => { process.exitCode = code }, (e: Error) => {
  console.error(e.message)
  process.exitCode = 1
})
