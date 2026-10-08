// Reads a repo into a model of stories and kernel files. No judgements here; see rules.ts.
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import type { Config } from '../config.js'
import type { ImportGraph } from './graph.js'

// `imports`: repo files it imports, without extension (from the import graph); `typeOnly`: those imported only for types.
export type SourceFile = { path: string; text: string; imports: string[]; typeOnly: string[] }

// `proof`: the tiers it must be proven in. `hash`: its text (heading and steps, whitespace-normalised), so a proof
// recorded against other wording is known to be stale.
export type Scenario = { id: string; title: string; proof: string[]; hash: string }

export type Story = {
  id: string
  dir: string
  hasStoryMd: boolean
  hasSpecMd: boolean
  front: Record<string, string>
  spec: string
  requirementTagged: boolean
  /** Number of SHALL statements in the requirement's body (its text up to the next heading). */
  requirementShalls: number
  scenarios: Scenario[]
  code: SourceFile[]
  tests: SourceFile[]
  /** Scenario IDs a test names, via test('S-001.1 …') or story(gen, { 'S-001.1': … }). */
  testedIds: string[]
}

export type Repo = {
  root: string; config: Config; stories: Story[]; kernel: SourceFile[]; outcomes: Map<string, 'pass' | 'fail'>; failures: Map<string, string>; hasReport: boolean; executedTests: string[]
  // Results by scenario and tier: a test named "S-001.1 [deployed] …" ran in the deployed tier; an untagged one counts as local.
  tierOutcomes: Map<string, Map<string, 'pass' | 'fail'>>
  // Full names (with their describe blocks) of the tests that passed, which name the adapters contract suites ran against.
  passedTestNames: string[]
  // Failed tests that aren't scenarios (contract suites, other tests), and test files that failed without running a test.
  otherFailures: { file: string; test?: string; message: string }[]
}

export const ids = (prefix: string) => ({
  storyFolder: new RegExp(`^(${prefix}-\\d+)-`),
  scenarioTag: new RegExp(`\\{#(${prefix}-\\d+\\.\\d+)(?:\\s+proof=([a-z0-9,-]+))?\\}`, 'g'),
  scenarioHeading: new RegExp(`^#{2,6}\\s*Scenario:\\s*(.+?)\\s*\\{#(${prefix}-\\d+\\.\\d+)(?:\\s+proof=[a-z0-9,-]+)?\\}\\s*$`, 'gm'),
  implTag: new RegExp(`@implements (${prefix}-\\d+)\\b`, 'g'),
  testCall: new RegExp(`\\b(?:test|it)(?:\\.\\w+)?\\(\\s*['"\`](${prefix}-\\d+\\.\\d+)\\b`, 'g'),
  caseKey: new RegExp(`['"](${prefix}-\\d+\\.\\d+)['"]\\s*:`, 'g'),
  any: new RegExp(`\\b${prefix}-\\d+(?:\\.\\d+)?\\b`, 'g'),
  resultTitle: new RegExp(`^(${prefix}-\\d+\\.\\d+)\\b(?:\\s+\\[([a-z0-9-]+)\\])?`),
})

const isSource = (f: string) => /\.(c|m)?tsx?$/.test(f) && !f.endsWith('.d.ts')
const isTest = (f: string) => /\.(test|spec)\.(c|m)?tsx?$/.test(f)

const walker = (root: string, config: Config) => {
  const rel = (p: string) => relative(root, p).split('\\').join('/')
  const ignored = (r: string) => config.ignore.some(i => r === i || r.startsWith(i + '/'))
  const walk = (dir: string): string[] =>
    !existsSync(dir) ? [] : readdirSync(dir).flatMap(f => {
      const p = join(dir, f)
      if (ignored(rel(p))) return []
      return statSync(p).isDirectory() ? walk(p) : [p]
    })
  return { rel, walk }
}

/** Every source file the trace reads, repo-relative: the input to the import graph. */
export const sourceFiles = (root: string, config: Config) => {
  const { rel, walk } = walker(root, config)
  return walk(root).filter(isSource).map(rel)
}

/** Reads the repo. `graph` supplies imports (trace builds it with importGraph); without it, files have none, which is
 * enough for gen, story and migrate. */
export const scan = (root: string, config: Config, graph: ImportGraph = new Map()): Repo => {
  const { rel, walk } = walker(root, config)
  const read = (p: string) => readFileSync(p, 'utf8')
  const source = (p: string): SourceFile => {
    const path = rel(p)
    const deps = graph.get(path)
    return { path, text: read(p), imports: deps?.imports ?? [], typeOnly: deps?.typeOnly ?? [] }
  }
  const re = ids(config.idPrefix)

  const storiesRoot = join(root, config.storiesDir)
  const stories: Story[] = (existsSync(storiesRoot) ? readdirSync(storiesRoot) : [])
    .filter(n => re.storyFolder.test(n) && statSync(join(storiesRoot, n)).isDirectory())
    .sort()
    .map(name => {
      const dir = join(storiesRoot, name)
      const id = name.match(re.storyFolder)![1]!
      const storyMd = join(dir, 'story.md'), specMd = join(dir, 'spec.md')
      const front = existsSync(storyMd) ? frontmatter(read(storyMd)) : {}
      const spec = existsSync(specMd) ? read(specMd) : ''
      const titles = new Map([...spec.matchAll(re.scenarioHeading)].map(m => [m[2]!, m[1]!]))
      const storyProof = list(front.proof)
      const scenarios = [...spec.matchAll(re.scenarioTag)].map(m => ({
        id: m[1]!, title: titles.get(m[1]!) ?? '',
        proof: list(m[2]) ?? storyProof ?? config.defaultProof,
        hash: scenarioHash(spec, m.index!),
      }))
      const files = walk(dir).filter(isSource).map(source)
      const tests = files.filter(f => isTest(f.path))
      const code = files.filter(f => !isTest(f.path))
      const testedIds = [...new Set(tests.flatMap(t => [...t.text.matchAll(re.testCall), ...t.text.matchAll(re.caseKey)].map(m => m[1]!)))]
      return {
        id, dir: rel(dir), hasStoryMd: existsSync(storyMd), hasSpecMd: existsSync(specMd), front, spec,
        requirementTagged: spec.includes(`{#${id}}`), requirementShalls: shallCount(spec, id), scenarios, code, tests, testedIds,
      }
    })

  const kernel = walk(root).filter(isSource).map(rel).filter(r => !r.startsWith(config.storiesDir + '/')).map(r => source(join(root, r)))

  const outcomes = new Map<string, 'pass' | 'fail'>()
  const tierOutcomes: Repo['tierOutcomes'] = new Map()
  const passedTestNames: string[] = []
  const executedTests: string[] = []
  const failures = new Map<string, string>()
  const otherFailures: Repo['otherFailures'] = []
  const firstLines = (msg: string) => msg.replace(/\u001b\[[0-9;]*m/g, '').split('\n').slice(0, 6).join('\n')
  const report = join(root, config.testReport)
  const hasReport = existsSync(report)
  if (hasReport) {
    const json = JSON.parse(read(report)) as { testResults?: { name?: string; status?: string; message?: string; assertionResults?: { title: string; fullName?: string; ancestorTitles?: string[]; status: string; failureMessages?: string[] }[] }[] }
    for (const f of json.testResults ?? []) for (const a of f.assertionResults ?? [])
      if (a.status === 'passed') passedTestNames.push(a.fullName || [...a.ancestorTitles ?? [], a.title].join(' '))
    for (const f of json.testResults ?? []) if (f.name && (f.assertionResults ?? []).length) executedTests.push(rel(resolve(root, f.name)))
    for (const f of json.testResults ?? []) {
      const file = f.name ? rel(resolve(root, f.name)) : '(unknown file)'
      if (f.status === 'failed' && !(f.assertionResults ?? []).some(a => a.status === 'failed'))
        otherFailures.push({ file, message: firstLines(f.message || 'the file failed before its tests ran') })
      for (const a of f.assertionResults ?? [])
        if (a.status === 'failed' && !re.resultTitle.test(a.title)) otherFailures.push({ file, test: a.fullName || a.title, message: firstLines(a.failureMessages?.[0] ?? '') })
    }
    for (const f of json.testResults ?? []) for (const a of f.assertionResults ?? []) {
      const m = a.title.match(re.resultTitle)
      const id = m?.[1]
      if (!id) continue
      // A scenario run more than once (e.g. retried) fails if any run failed.
      const outcome = a.status === 'passed' ? 'pass' : 'fail'
      if (outcomes.get(id) !== 'fail') outcomes.set(id, outcome)
      const byTier = tierOutcomes.get(id) ?? new Map<string, 'pass' | 'fail'>()
      const tier = m[2] ?? 'local'
      if (byTier.get(tier) !== 'fail') byTier.set(tier, outcome)
      tierOutcomes.set(id, byTier)
      const msg = a.failureMessages?.[0]
      if (msg) failures.set(id, firstLines(msg))
    }
  }

  return { root, config, stories, kernel, outcomes, failures, hasReport, executedTests, otherFailures, tierOutcomes, passedTestNames }
}

// "local, deployed" → ['local', 'deployed']; absent → undefined.
const list = (v: string | undefined) => v?.trim() ? v.split(',').map(x => x.trim()).filter(Boolean) : undefined

// A scenario's text from its heading to the next heading, without its tag and with whitespace collapsed.
export const scenarioHash = (spec: string, tagAt: number) => {
  const start = spec.lastIndexOf('\n', tagAt) + 1
  const rest = spec.slice(spec.indexOf('\n', tagAt) + 1)
  const next = rest.search(/^#{1,6}\s/m)
  const text = (spec.slice(start, spec.indexOf('\n', tagAt) + 1) + (next < 0 ? rest : rest.slice(0, next)))
    .replace(/\{#[^}]*\}/g, '').replace(/\s+/g, ' ').trim()
  return createHash('sha256').update(text).digest('hex').slice(0, 12)
}

const frontmatter = (md: string) =>
  Object.fromEntries([...(md.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '').matchAll(/^(\w+):[ \t]*(.*)$/gm)].map(m => [m[1]!, m[2]!.trim()]))

/** Source text without comments, for name matching that comments shouldn't satisfy. */
export const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')

const shallCount = (spec: string, id: string) => {
  const at = spec.indexOf(`{#${id}}`)
  if (at < 0) return 0
  const body = spec.slice(spec.indexOf('\n', at) + 1)
  const next = body.search(/^#{1,6}\s/m)
  return ((next < 0 ? body : body.slice(0, next)).match(/\bSHALL\b/g) ?? []).length
}
