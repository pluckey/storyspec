#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { configFile, loadConfig } from './config.js'
import { migrate } from './migrate.js'
import { genStatus, writeGen } from './gen.js'
import { newStory } from './new-story.js'
import { trace } from './index.js'
import { findingsText, portTable, storiesTables } from './trace/report.js'
import { scan } from './trace/scan.js'
import { installedVersion, plan, sync } from './sync.js'
import { gitUser, recordManual } from './proof.js'
import { serveUi } from './ui/server.js'
import { findProjects, projectsBase } from './ui/projects.js'

const HELP = `story-spec: story-first, spec-driven development

Usage:
  story-spec trace [--tier <name>] [--require-proven] [--by persona] [--no-run] [--json]
                                        Run a tier's tests (default local), write stories/TRACE.md, check every rule.
                                        A tier other than local is recorded in stories/PROOF.json.
                                        --require-proven: fail unless every story past ready is done.
                                        --by persona: one stories table per persona in stories/PERSONAS.md.
  story-spec prove <ID> [--tier manual] [--fail] [--note "<text>"] [--by "<name>"]
                                        Record a proof by hand of a scenario (S-001.2) or of a story's scenarios (S-001)
  story-spec migrate                    Update the project for this version: from the old name (the config file, the
                                        state folder, imports, package.json, .gitignore, generated files and agent
                                        guidance), and from 0.2 (status: done becomes in-progress, since done is now
                                        worked out from proof). Safe to run again.
  story-spec gen [--check]              Write scenarios.gen.ts for each story (--check: fail if stale)
  story-spec story "<title>" [--epic "<epic>"]   Create the next story folder from templates
  story-spec check                      gen --check, then trace
  story-spec ui [--port 4400]           Open a page on localhost to manage the spec. It lands on Needs you, everything
                                        waiting on a person, then reads in three groups: Model (what should be: people,
                                        stories, decisions, records, words), Implementation (what is: code, ports,
                                        layers) and Proof (how we know: by tests, by a run, by a person, stale). Answer
                                        decisions, approve stories, edit scenarios, add personas, claim code and record
                                        a check by hand (as story-spec prove does). Each change is an edit to the
                                        project's files; commit them with git. It lists every story-spec project in this
                                        folder (or the folder above, when run inside a project) and switches between them.
  story-spec sync [--check] [--force] [--claude]
                                        Bring AGENTS.md (and CLAUDE.md, the /story command and its hooks,
                                        when the project uses Claude Code) up to the installed story-spec version.
                                        --check: change nothing, fail if anything is out of date.
                                        --force: also replace story-spec blocks that were edited by hand.
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

const main = async (): Promise<number> => {
  if (flag('--help') || flag('-h') || args.length === 0) { console.log(HELP); return 0 }
  const root = findRoot(option('--root') ?? process.cwd())
  const command = args.shift()

  // Before the config is read: migrate is what renames it.
  if (command === 'migrate') {
    const done = migrate(root)
    for (const m of done) (m.problem ? console.error : console.log)(`${m.file}: ${m.change}`)
    if (!done.length) console.log('Nothing to migrate.')
    else if (!done.some(m => m.problem)) console.log(`\nMigrated to story-spec ${installedVersion()}. Run your check (npm run check), then commit.`)
    return done.some(m => m.problem) ? 1 : 0
  }

  const config = loadConfig(root)

  if (command === 'gen') {
    const check = flag('--check')
    const stories = scan(root, config).stories
    if (check) {
      const stale = genStatus(root, stories).filter(g => g.state !== 'fresh')
      for (const g of stale) console.error(`${g.file} is ${g.state}`)
      if (stale.length) { console.error('Run: story-spec gen'); return 1 }
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
    if (!title) { console.error('usage: story-spec story "<title>" [--epic "<epic>"]'); return 1 }
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
    const by = option('--by')
    if (by !== undefined && by !== 'persona') { console.error(`--by takes "persona" (got "${by}")`); return 1 }
    const result = await trace(root, { runTests: run, tier, requireProven, by })
    if (json) console.log(JSON.stringify(result, null, 2))
    else {
      console.log(storiesTables(result.rows, result.personas, by))
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
    if (!target) { console.error('usage: story-spec prove <S-001 | S-001.2> [--tier manual] [--fail] [--note "…"] [--by "…"]'); return 1 }
    const ids = recordManual(scan(root, config), target, tier, { outcome: failed ? 'fail' : 'pass', at: new Date().toISOString(), ...(by && { by }), ...(note && { note }) })
    console.log(`Recorded ${failed ? 'a failure' : 'proof'} in the ${tier} tier for ${ids.join(', ')}${by ? ` (by ${by})` : ''}. Run story-spec trace to see where the story stands.`)
    return 0
  }

  if (command === 'ui') {
    const port = Number(option('--port') ?? 4400)
    // Run inside a project, the root is that project; run in a folder of projects, it's the folder itself.
    const start = configFile(root) ? root : resolve(option('--root') ?? process.cwd())
    await serveUi(start, { port })
    const found = findProjects(projectsBase(start))
    console.log(`story-spec ui: http://localhost:${port}  (${found.length} project${found.length === 1 ? '' : 's'} in ${projectsBase(start)}; Ctrl-C to stop)`)
    return new Promise<number>(() => {})
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
    if (check) { if (stale.length) console.error(`Run: story-spec sync (story-spec ${v})`); return stale.length ? 1 : 0 }
    if (!stale.length) console.log(`Agent guidance is up to date with story-spec ${v}.`)
    return changes.some(c => c.action === 'edited') ? 1 : 0
  }

  console.error(`Unknown command "${command}".\n\n${HELP}`)
  return 1
}

main().then(code => { process.exitCode = code }, (e: Error) => {
  console.error(e.message)
  process.exitCode = 1
})
