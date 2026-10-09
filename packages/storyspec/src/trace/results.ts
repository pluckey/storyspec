// Reads a test report into one shape, whatever wrote it: vitest's JSON reporter, or JUnit XML (pytest --junitxml,
// vitest/jest JUnit reporters, go-junit-report, …). The format is recognised from the content.
import { readFileSync } from 'node:fs'
import { XMLParser } from 'fast-xml-parser'

export type TestCase = {
  /** The name the trace matches scenario IDs against: "S-001.1 [deployed] title", or the runner's own name. */
  title: string
  /** The name with its describe blocks or class, which contract suites put their adapter's path in. */
  fullName: string
  status: 'passed' | 'failed' | 'skipped'
  message?: string
}
export type TestFile = { name?: string; failed: boolean; message?: string; cases: TestCase[] }

type VitestJson = { testResults?: { name?: string; status?: string; message?: string; assertionResults?: { title: string; fullName?: string; ancestorTitles?: string[]; status: string; failureMessages?: string[] }[] }[] }

const fromVitest = (json: VitestJson): TestFile[] =>
  (json.testResults ?? []).map(f => ({
    name: f.name,
    failed: f.status === 'failed',
    message: f.message,
    cases: (f.assertionResults ?? []).map(a => ({
      title: a.title,
      fullName: a.fullName || [...a.ancestorTitles ?? [], a.title].join(' '),
      status: a.status === 'passed' ? 'passed' : a.status === 'failed' ? 'failed' : 'skipped',
      message: a.failureMessages?.[0],
    })),
  }))

/**
 * A JUnit test's scenario, written the way its language allows:
 * - a property `scenario` (pytest: `record_property("scenario", "S-001.1")`), with an optional `tier` property;
 * - the ID in its name, as other runners write it: "S-001.1 [deployed] title";
 * - the ID in a function name, where `-` and `.` aren't allowed: `test_S_001_1_title` or `test_S_001_1__deployed__title`.
 * A test that names no tier ran in the tier whose command wrote the report: nothing like `story()` registers tests per
 * tier in other languages, so the tier's command selects them (`pytest tests/deployed`, `pytest -m deployed`).
 * Returns the name in the trace's form, "S-001.1 [tier] rest", or undefined when the test names no scenario.
 */
export const junitTitle = (prefix: string, name: string, props: Record<string, string>, runTier = 'local') => {
  const tag = (tier: string | undefined) => {
    const t = tier ?? (runTier === 'local' ? undefined : runTier)
    return t ? ` [${t}]` : ''
  }
  if (props.scenario) return `${props.scenario}${tag(props.tier)} ${name}`
  const named = name.match(new RegExp(`^(${prefix}-\\d+\\.\\d+)\\b(?:\\s+\\[([a-z0-9-]+)\\])?\\s*(.*)$`))
  if (named) return `${named[1]}${tag(named[2] ?? props.tier)} ${named[3]}`.trimEnd()
  const m = name.match(new RegExp(`^(?:test_?)?${prefix}_(\\d+)_(\\d+)(?=_|\\[|$)(?:__([a-z0-9]+)__)?_?(.*)$`))
  if (m) return `${prefix}-${m[1]}.${m[2]}${tag(m[3] ?? props.tier)} ${m[4]!.replace(/_/g, ' ')}`.trimEnd()
}

const asList = <T>(v: T | T[] | undefined): T[] => v === undefined ? [] : Array.isArray(v) ? v : [v]
type Node = Record<string, unknown>
const text = (n: unknown): string | undefined =>
  n === undefined ? undefined : typeof n === 'string' ? n : String((n as Node)['@_message'] ?? (n as Node)['#text'] ?? '') || 'failed'

const fromJunit = (xml: string, prefix: string, runTier: string): TestFile[] => {
  const doc = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text', parseTagValue: false, parseAttributeValue: false, htmlEntities: true }).parse(xml) as Node
  // <testsuites><testsuite>… or a lone <testsuite>; suites may nest.
  const suites: Node[] = []
  const collect = (s: Node) => { suites.push(s); for (const inner of asList(s.testsuite as Node | Node[])) collect(inner) }
  for (const s of asList((doc.testsuites as Node | undefined)?.testsuite as Node | Node[])) collect(s)
  for (const s of asList(doc.testsuite as Node | Node[])) collect(s)
  const byFile = new Map<string, TestFile>()
  for (const suite of suites) for (const c of asList(suite.testcase as Node | Node[])) {
    const name = String(c['@_name'] ?? '')
    const classname = String(c['@_classname'] ?? '')
    const props = Object.fromEntries(asList((c.properties as Node | undefined)?.property as Node | Node[]).map(p => [String(p['@_name']), String(p['@_value'] ?? '')]))
    const problem = c.failure ?? c.error
    const file = String(c['@_file'] ?? suite['@_file'] ?? (classname || suite['@_name'] || ''))
    const f = byFile.get(file) ?? { name: file || undefined, failed: false, cases: [] }
    f.cases.push({
      title: junitTitle(prefix, name, props, runTier) ?? name,
      fullName: [classname, name].filter(Boolean).join(' '),
      status: problem !== undefined ? 'failed' : c.skipped !== undefined ? 'skipped' : 'passed',
      message: text(asList(problem as unknown)[0]),
    })
    if (problem !== undefined) f.failed = true
    byFile.set(file, f)
  }
  return [...byFile.values()]
}

/** The report's test files and their tests, from a run of `runTier`. JUnit names are rewritten to carry their scenario
 * ID (and tier) the way storyspec/vitest names them. */
export const readResults = (path: string, prefix: string, runTier = 'local'): TestFile[] => {
  const raw = readFileSync(path, 'utf8')
  return raw.trimStart().startsWith('<') ? fromJunit(raw, prefix, runTier) : fromVitest(JSON.parse(raw) as VitestJson)
}
