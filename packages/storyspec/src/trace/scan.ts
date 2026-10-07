// Reads a repo into a model of stories and kernel files. No judgements here; see rules.ts.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import type { Config } from '../config.js'

export type SourceFile = { path: string; text: string; imports: string[] }

export type Scenario = { id: string; title: string }

export type Story = {
  id: string
  dir: string
  hasStoryMd: boolean
  hasSpecMd: boolean
  front: Record<string, string>
  spec: string
  requirementTagged: boolean
  scenarios: Scenario[]
  code: SourceFile[]
  tests: SourceFile[]
  /** Scenario IDs a test names, via test('S-001.1 …') or story(gen, { 'S-001.1': … }). */
  testedIds: string[]
}

export type Repo = { root: string; config: Config; stories: Story[]; kernel: SourceFile[]; outcomes: Map<string, 'pass' | 'fail'>; failures: Map<string, string>; hasReport: boolean; executedTests: string[] }

export const ids = (prefix: string) => ({
  storyFolder: new RegExp(`^(${prefix}-\\d+)-`),
  scenarioTag: new RegExp(`\\{#(${prefix}-\\d+\\.\\d+)\\}`, 'g'),
  scenarioHeading: new RegExp(`^#{2,6}\\s*Scenario:\\s*(.+?)\\s*\\{#(${prefix}-\\d+\\.\\d+)\\}\\s*$`, 'gm'),
  implTag: new RegExp(`@implements (${prefix}-\\d+)\\b`, 'g'),
  testCall: new RegExp(`\\b(?:test|it)(?:\\.\\w+)?\\(\\s*['"\`](${prefix}-\\d+\\.\\d+)\\b`, 'g'),
  caseKey: new RegExp(`['"](${prefix}-\\d+\\.\\d+)['"]\\s*:`, 'g'),
  any: new RegExp(`\\b${prefix}-\\d+(?:\\.\\d+)?\\b`, 'g'),
  resultTitle: new RegExp(`^(${prefix}-\\d+\\.\\d+)\\b`),
})

const isSource = (f: string) => /\.(c|m)?tsx?$/.test(f) && !f.endsWith('.d.ts')
const isTest = (f: string) => /\.(test|spec)\.(c|m)?tsx?$/.test(f)

export const scan = (root: string, config: Config): Repo => {
  const rel = (p: string) => relative(root, p).split('\\').join('/')
  const ignored = (r: string) => config.ignore.some(i => r === i || r.startsWith(i + '/'))
  const walk = (dir: string): string[] =>
    !existsSync(dir) ? [] : readdirSync(dir).flatMap(f => {
      const p = join(dir, f)
      if (ignored(rel(p))) return []
      return statSync(p).isDirectory() ? walk(p) : [p]
    })
  const read = (p: string) => readFileSync(p, 'utf8')
  const source = (p: string): SourceFile => {
    const text = read(p)
    const imports = [...text.matchAll(/^\s*(?:import|export)\s[^'"]*?['"]([^'"]+)['"]/gm)]
      .map(m => m[1]!)
      .filter(s => s.startsWith('.'))
      .map(s => rel(resolve(dirname(p), s)).replace(/\.(c|m)?js$/, ''))
    return { path: rel(p), text, imports }
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
      const scenarios = [...spec.matchAll(re.scenarioTag)].map(m => ({ id: m[1]!, title: titles.get(m[1]!) ?? '' }))
      const files = walk(dir).filter(isSource).map(source)
      const tests = files.filter(f => isTest(f.path))
      const code = files.filter(f => !isTest(f.path))
      const testedIds = [...new Set(tests.flatMap(t => [...t.text.matchAll(re.testCall), ...t.text.matchAll(re.caseKey)].map(m => m[1]!)))]
      return {
        id, dir: rel(dir), hasStoryMd: existsSync(storyMd), hasSpecMd: existsSync(specMd), front, spec,
        requirementTagged: spec.includes(`{#${id}}`), scenarios, code, tests, testedIds,
      }
    })

  const kernel = walk(root).filter(isSource).map(rel).filter(r => !r.startsWith(config.storiesDir + '/')).map(r => source(join(root, r)))

  const outcomes = new Map<string, 'pass' | 'fail'>()
  const executedTests: string[] = []
  const failures = new Map<string, string>()
  const report = join(root, config.testReport)
  const hasReport = existsSync(report)
  if (hasReport) {
    const json = JSON.parse(read(report)) as { testResults?: { name?: string; assertionResults?: { title: string; fullName?: string; status: string; failureMessages?: string[] }[] }[] }
    for (const f of json.testResults ?? []) if (f.name && (f.assertionResults ?? []).length) executedTests.push(rel(resolve(root, f.name)))
    for (const f of json.testResults ?? []) for (const a of f.assertionResults ?? []) {
      const id = a.title.match(re.resultTitle)?.[1]
      if (!id) continue
      // A scenario run more than once (e.g. retried) fails if any run failed.
      if (outcomes.get(id) !== 'fail') outcomes.set(id, a.status === 'passed' ? 'pass' : 'fail')
      const msg = a.failureMessages?.[0]
      if (msg) failures.set(id, msg.replace(/\u001b\[[0-9;]*m/g, '').split('\n').slice(0, 6).join('\n'))
    }
  }

  return { root, config, stories, kernel, outcomes, failures, hasReport, executedTests }
}

const frontmatter = (md: string) =>
  Object.fromEntries([...(md.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '').matchAll(/^(\w+):[ \t]*(.*)$/gm)].map(m => [m[1]!, m[2]!.trim()]))

/** Source text without comments, for name matching that comments shouldn't satisfy. */
export const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
