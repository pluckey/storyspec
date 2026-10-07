// Ties every story to its spec, implementation and tests, and enforces the layer rules
// in storyspec.config.json. Writes <storiesDir>/TRACE.md; exits 1 on any violation.
//
//  1. Every story folder <ID>-<slug>/ has story.md (id matches the folder) and spec.md with a
//     requirement tagged {#<ID>}, scenarios tagged {#<ID>.<n>}, exactly one file tagged
//     `@implements <ID>`, and a test named after every scenario: test('<ID>.<n> …').
//  2. Story code imports only its own folder and `storyMayImport`; story tests may also
//     import `storyTestMayAlsoImport`. Stories never import each other.
//  3. Outside stories/, story IDs appear nowhere, and only `wiring` files import stories.
//  4. Each folder in `layers` imports only the prefixes listed for it.
//  5. A story whose status is in `mustPassFor` has every scenario test passing.
//  Stories whose status is in `gapsOnlyWarnFor` report missing code/tests as warnings.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

type Config = {
  idPrefix: string
  storiesDir: string
  storyMayImport: string[]
  storyTestMayAlsoImport: string[]
  wiring: string[]
  layers: Record<string, string[]>
  gapsOnlyWarnFor: string[]
  mustPassFor: string[]
}

const root = resolve(import.meta.dirname, '..')
const read = (p: string) => readFileSync(p, 'utf8')
const cfg = JSON.parse(read(join(root, 'storyspec.config.json'))) as Config
const P = cfg.idPrefix
const rel = (p: string) => relative(root, p)
const errors: string[] = []
const warnings: string[] = []
const fail = (m: string) => errors.push(m)

const storyId = new RegExp(`^(${P}-\\d+)-`)
const scenarioTag = new RegExp(`\\{#(${P}-\\d+\\.\\d+)\\}`, 'g')
const implTag = new RegExp(`@implements (${P}-\\d+)\\b`, 'g')
const testName = new RegExp(`\\b(?:test|it)\\(\\s*['"\`](${P}-\\d+\\.\\d+)\\b`, 'g')
const anyId = new RegExp(`\\b${P}-\\d+(?:\\.\\d+)?\\b`, 'g')

const walk = (dir: string): string[] =>
  !existsSync(dir) ? [] : readdirSync(dir).flatMap(f => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
const tsFiles = (dir: string) => walk(dir).filter(f => /\.tsx?$/.test(f))

const importsOf = (file: string) =>
  [...read(file).matchAll(/^\s*(?:import|export)\s[^'"]*?['"]([^'"]+)['"]/gm)].map(m => m[1]!)
    .filter(s => s.startsWith('.'))
    .map(s => rel(resolve(dirname(file), s)))

const under = (path: string, prefixes: string[]) => prefixes.some(p => path === p || path.startsWith(p + '/') || path.startsWith(p + '.'))

const frontmatter = (md: string) =>
  Object.fromEntries([...(md.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '').matchAll(/^(\w+):\s*(.*)$/gm)].map(m => [m[1]!, m[2]!.trim()]))

// Test results, when `npm run trace` ran vitest first.
type Outcome = 'pass' | 'fail'
const outcomes = new Map<string, Outcome>()
const report = join(root, '.trace/vitest.json')
if (existsSync(report)) {
  const json = JSON.parse(read(report)) as { testResults: { assertionResults: { title: string; status: string }[] }[] }
  for (const f of json.testResults) for (const a of f.assertionResults) {
    const id = a.title.match(new RegExp(`^(${P}-\\d+\\.\\d+)\\b`))?.[1]
    if (id) outcomes.set(id, a.status === 'passed' ? 'pass' : 'fail')
  }
}

// Stories.
type Scenario = { id: string; tested: boolean; outcome?: Outcome }
type Row = { id: string; title: string; epic: string; status: string; version: string; impl: string; scenarios: Scenario[] }
const rows: Row[] = []
const storiesDir = join(root, cfg.storiesDir)

for (const name of readdirSync(storiesDir).filter(n => storyId.test(n)).sort()) {
  const dir = join(storiesDir, name)
  const id = name.match(storyId)![1]!
  const storyMd = join(dir, 'story.md'), specMd = join(dir, 'spec.md')
  if (!existsSync(storyMd)) { fail(`${id}: missing story.md`); continue }
  if (!existsSync(specMd)) { fail(`${id}: missing spec.md`); continue }

  const fm = frontmatter(read(storyMd))
  if (fm.id !== id) fail(`${id}: story.md says id "${fm.id}"`)
  const status = fm.status ?? ''
  const gap = cfg.gapsOnlyWarnFor.includes(status) ? (m: string) => warnings.push(m) : fail

  const spec = read(specMd)
  if (!spec.includes(`{#${id}}`)) gap(`${id}: spec.md has no requirement tagged {#${id}}`)
  const scenarioIds = [...spec.matchAll(scenarioTag)].map(m => m[1]!)
  for (const s of scenarioIds) if (!s.startsWith(`${id}.`)) fail(`${id}: spec.md tags ${s}, which belongs to another story`)
  if (scenarioIds.length === 0) gap(`${id}: spec.md has no scenarios`)

  const files = tsFiles(dir)
  const tests = files.filter(f => /\.test\.tsx?$/.test(f))
  const code = files.filter(f => !tests.includes(f))

  const impls = code.filter(f => [...read(f).matchAll(implTag)].some(m => m[1] === id))
  if (impls.length > 1) fail(`${id}: ${impls.length} files say @implements ${id}; a story has one use case`)
  if (impls.length === 0) gap(`${id}: no file says @implements ${id}`)
  for (const f of code) for (const m of read(f).matchAll(implTag))
    if (m[1] !== id) fail(`${rel(f)}: @implements ${m[1]} inside ${id}'s folder`)

  const tested = new Set(tests.flatMap(f => [...read(f).matchAll(testName)].map(m => m[1]!)))
  for (const t of tested) if (!scenarioIds.includes(t)) fail(`${id}: a test is named ${t}, which isn't a scenario in spec.md`)
  const scenarios = scenarioIds.map(s => ({ id: s, tested: tested.has(s), outcome: outcomes.get(s) }))
  for (const s of scenarios) if (!s.tested) gap(`${s.id}: no test`)
  if (cfg.mustPassFor.includes(status)) for (const s of scenarios)
    if (s.tested && s.outcome !== 'pass') fail(`${s.id}: story is ${status} but its test ${s.outcome === 'fail' ? 'fails' : 'has no result (use npm run trace)'}`)

  for (const f of files) for (const imp of importsOf(f)) {
    const allowed = [rel(dir), ...cfg.storyMayImport, ...(tests.includes(f) ? cfg.storyTestMayAlsoImport : [])]
    if (!under(imp, allowed)) fail(`${rel(f)}: imports ${imp}; stories may import only their own folder, ${allowed.slice(1).join(', ')}`)
  }

  rows.push({ id, title: fm.title ?? '', epic: fm.epic ?? '', status, version: fm.version ?? '', impl: impls[0] ? rel(impls[0]) : '', scenarios })
}

// Everything outside stories/.
for (const f of walk(root).filter(f => /\.tsx?$/.test(f) && !rel(f).startsWith('node_modules') && !rel(f).startsWith(cfg.storiesDir + '/') && !rel(f).startsWith('tools/'))) {
  const r = rel(f)
  const isWiring = cfg.wiring.includes(r)
  const text = isWiring ? read(f).replace(/^\s*import\s.*$/gm, '') : read(f)
  for (const m of text.matchAll(anyId)) fail(`${r}: mentions ${m[0]}; story logic belongs in ${cfg.storiesDir}/`)
  const layer = Object.keys(cfg.layers).filter(l => under(r, [l])).sort((a, b) => b.length - a.length)[0]
  for (const imp of importsOf(f)) {
    if (imp.startsWith(cfg.storiesDir + '/') && !isWiring) fail(`${r}: imports ${imp}; only ${cfg.wiring.join(', ')} may import stories`)
    else if (layer && !under(imp, cfg.layers[layer]!)) fail(`${r}: imports ${imp}; ${layer} may import ${cfg.layers[layer]!.join(', ')}`)
  }
}

// Ports without an adapter are worth knowing about.
for (const port of tsFiles(join(root, 'src/ports'))) {
  const names = [...read(port).matchAll(/export interface (\w+)/g)].map(m => m[1]!)
  const adapters = tsFiles(join(root, 'src/adapters')).map(read).join('\n')
  for (const n of names) if (!new RegExp(`\\b${n}\\b`).test(adapters)) warnings.push(`${rel(port)}: ${n} has no adapter yet`)
}

// Matrix.
const mark = (s: Scenario) => !s.tested ? '✗ no test' : s.outcome === 'pass' ? '✓ pass' : s.outcome === 'fail' ? '✗ fail' : '· not run'
const table = [
  '| Epic | Story | Status | v | Implementation | Scenario | Test |',
  '|---|---|---|---|---|---|---|',
  ...rows.flatMap(r => r.scenarios.length === 0
    ? [`| ${r.epic} | ${r.id} ${r.title} | ${r.status} | ${r.version} | ${r.impl} | — | ✗ no scenarios |`]
    : r.scenarios.map((s, i) => i === 0
      ? `| ${r.epic} | ${r.id} ${r.title} | ${r.status} | ${r.version} | ${r.impl} | ${s.id} | ${mark(s)} |`
      : `| | | | | | ${s.id} | ${mark(s)} |`)),
]
writeFileSync(join(storiesDir, 'TRACE.md'), ['# Trace', '', 'Generated by `npm run trace`. Do not edit.', '', ...table, ''].join('\n'))
console.log(table.join('\n'))

if (warnings.length) console.log(`\n${warnings.length} warning(s):\n` + warnings.map(w => `  - ${w}`).join('\n'))
if (errors.length) {
  console.error(`\n${errors.length} problem(s):\n` + errors.map(e => `  - ${e}`).join('\n'))
  process.exit(1)
}
console.log(`\nOK: ${rows.length} stories, ${rows.reduce((n, r) => n + r.scenarios.length, 0)} scenarios traced.`)
