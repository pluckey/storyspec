import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export type Config = {
  /** Story ID prefix: S → S-001, S-001.1. */
  idPrefix: string
  /** Folder holding one sub-folder per story, named <ID>-<slug>. */
  storiesDir: string
  /** Path prefixes story code may import, besides its own folder. */
  storyMayImport: string[]
  /** Extra prefixes story tests may import. */
  storyTestMayAlsoImport: string[]
  /** Files allowed to import stories (composition roots). */
  wiring: string[]
  /** For each folder, the path prefixes its files may import. The longest matching folder applies. */
  layers: Record<string, string[]>
  /** Where port interfaces live; each exported interface should have an adapter. */
  portsDir: string
  /** Where adapters live. */
  adaptersDir: string
  /** Statuses whose missing code or tests are warnings instead of errors. */
  gapsOnlyWarnFor: string[]
  /** Statuses that require every scenario test to pass. */
  mustPassFor: string[]
  /** Statuses listed in the trace but exempt from every story rule (retired stories). */
  exemptStatuses: string[]
  /** Command that runs the tests and writes its report(s) to `testReport`. */
  testCommand: string
  /** Vitest/Jest JSON or JUnit XML. A list reads several reports; one that wasn't written is skipped. */
  testReport: string | string[]
  /** Optional folder of story templates (story.md, spec.md); the built-in ones are used otherwise. */
  storyTemplateDir: string
  /** Path prefixes never scanned. */
  ignore: string[]
  /** Severity per rule name, overriding the default: "error", "warning" or "off". */
  rules: Record<string, RuleSetting>
  /**
   * Where scenarios can be proven. `local` runs `testCommand` (or its own `command`) on every trace; any other tier with
   * a `command` runs on `storyspec trace --tier <name>` and its results are recorded in stories/PROOF.json; a tier with no
   * command (`manual`) is proven with `storyspec prove`.
   */
  tiers: Record<string, Tier>
  /** The tiers a scenario must be proven in, unless its story (`proof:` in story.md) or its tag (`{#S-001.1 proof=…}`) says otherwise. */
  defaultProof: string[]
}

export type Tier = { command?: string; report?: string | string[] }

/** A report setting as a list of paths. */
export const reportPaths = (report: string | string[]) => typeof report === 'string' ? [report] : report

export type RuleSetting = 'error' | 'warning' | 'off'

export const defaults: Config = {
  idPrefix: 'S',
  storiesDir: 'stories',
  storyMayImport: ['src/domain', 'src/ports'],
  storyTestMayAlsoImport: ['test'],
  wiring: ['src/entry/composition.ts'],
  layers: {
    'src/domain': ['src/domain'],
    'src/ports': ['src/domain', 'src/ports'],
    'src/adapters': ['src/domain', 'src/ports', 'src/adapters'],
    'src/presenters': ['src/domain', 'src/presenters'],
    'src/entry': ['src', 'stories'],
    test: ['src/domain', 'src/ports', 'src/adapters', 'test'],
  },
  portsDir: 'src/ports',
  adaptersDir: 'src/adapters',
  gapsOnlyWarnFor: ['draft', 'ready'],
  mustPassFor: ['done'],
  exemptStatuses: ['superseded'],
  testCommand: 'vitest run --passWithNoTests --reporter=json --outputFile=.storyspec/vitest.json',
  testReport: '.storyspec/vitest.json',
  storyTemplateDir: 'templates/story',
  ignore: ['node_modules', 'dist', '.storyspec', '.git'],
  rules: {},
  tiers: { local: {}, manual: {} },
  defaultProof: ['local'],
}

const stringList = (v: unknown) => Array.isArray(v) && v.every(x => typeof x === 'string')

export const loadConfig = (root: string): Config => {
  const file = join(root, 'storyspec.config.json')
  if (!existsSync(file)) return defaults
  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'))
  } catch (e) {
    throw new Error(`storyspec.config.json is not valid JSON: ${(e as Error).message}`)
  }
  const problems: string[] = []
  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith('$')) continue
    if (!(key in defaults)) { problems.push(`unknown key "${key}"`); continue }
    if (key === 'tiers') {
      const bad = value === null || typeof value !== 'object' || Object.values(value as object).some(t =>
        t === null || typeof t !== 'object' || Object.entries(t as object).some(([k, v]) =>
          k === 'command' ? typeof v !== 'string' : k === 'report' ? !(typeof v === 'string' || (stringList(v) && (v as string[]).length > 0)) : true))
      if (bad) problems.push('"tiers" should map tier names to { "command"?: string, "report"?: string or a list of strings }')
      continue
    }
    if (key === 'rules') {
      const bad = value === null || typeof value !== 'object' || Object.values(value).some(v => !['error', 'warning', 'off'].includes(v as string))
      if (bad) problems.push('"rules" should map rule names to "error", "warning" or "off"')
      continue
    }
    if (key === 'testReport') {
      if (!(typeof value === 'string' || (stringList(value) && (value as string[]).length > 0))) problems.push('"testReport" should be a string or a list of strings')
      continue
    }
    const expected = defaults[key as keyof Config]
    const okType = Array.isArray(expected) ? stringList(value)
      : typeof expected === 'object' ? value !== null && typeof value === 'object' && Object.values(value).every(stringList)
      : typeof value === typeof expected
    if (!okType) problems.push(`"${key}" should be ${Array.isArray(expected) ? 'a list of strings' : typeof expected === 'object' ? 'an object of string lists' : `a ${typeof expected}`}`)
  }
  // local and manual always exist; a project adds tiers or gives local its own command.
  const tiers = { ...defaults.tiers, ...(raw.tiers as Record<string, Tier> | undefined) }
  const defaultProof = (raw.defaultProof as string[] | undefined) ?? defaults.defaultProof
  for (const t of defaultProof) if (!(t in tiers)) problems.push(`"defaultProof" names tier "${t}", which isn't in "tiers"`)
  if (problems.length) throw new Error(`storyspec.config.json: ${problems.join('; ')}`)
  return { ...defaults, ...(raw as Partial<Config>), tiers, defaultProof }
}
