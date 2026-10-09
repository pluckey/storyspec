// Judgements over a scanned repo. Each finding names its rule so docs/rules.md can explain it.
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { genStatus } from '../gen.js'
import { slugify } from '../new-story.js'
import { plan } from '../sync.js'
import { exercisedAdapters, type ProofFile, scenarioStates } from '../proof.js'
import { ids, isTypeScript, stripComments, type Repo, type SourceFile } from './scan.js'
import { languageOf } from './languages.js'

export type Severity = 'error' | 'warning'
export type Finding = { rule: string; severity: Severity; file?: string; message: string }

export const under = (path: string, prefixes: string[]) =>
  prefixes.some(p => path === p || path.startsWith(p + '/') || path.startsWith(p + '.'))

export type EvaluateOptions = { proof?: ProofFile; requireProven?: boolean; derived?: Map<string, string> }

export const evaluate = (repo: Repo, opts: EvaluateOptions = {}): Finding[] => {
  const proof = opts.proof ?? { scenarios: {}, adapters: {} }
  const { config, stories, kernel, outcomes } = repo
  const re = ids(config.idPrefix)
  const out: Finding[] = []
  const add = (rule: string, severity: Severity, message: string, file?: string) => out.push({ rule, severity, message, file })

  for (const s of stories) {
    const status = s.front.status ?? ''
    const gapSeverity: Severity = config.gapsOnlyWarnFor.includes(status) ? 'warning' : 'error'
    const gap = (rule: string, message: string, file?: string) => add(rule, gapSeverity, message, file)

    if (!s.hasStoryMd) { add('story-files', 'error', `${s.id}: missing story.md`, s.dir); continue }
    if (!s.hasSpecMd) { add('story-files', 'error', `${s.id}: missing spec.md`, s.dir); continue }
    if (s.front.id !== s.id) add('story-files', 'error', `${s.id}: story.md says id "${s.front.id ?? ''}"`, `${s.dir}/story.md`)
    if (config.exemptStatuses.includes(status)) continue
    const expectedFolder = `${s.id}-${slugify(s.front.title ?? '')}`
    if (s.front.title && s.dir.split('/').pop() !== expectedFolder)
      add('slug', 'warning', `${s.id}: folder doesn't match the title "${s.front.title}"; rename it to ${expectedFolder}`, s.dir)

    if (!s.requirementTagged) gap('requirement-tag', `${s.id}: spec.md has no requirement tagged {#${s.id}}`, `${s.dir}/spec.md`)
    else if (s.spec.split(`{#${s.id}}`).length > 2)
      add('requirement-tag', 'error', `${s.id}: {#${s.id}} is tagged more than once. A story has one requirement: one sentence for the behaviour, with every condition and edge case as a scenario. If these are separate behaviours, split them into another story (storyspec story).`, `${s.dir}/spec.md`)
    else if (s.requirementShalls === 0)
      gap('requirement-shape', `${s.id}: the requirement has no SHALL statement. Write one sentence: WHEN <trigger> THE SYSTEM SHALL <response>.`, `${s.dir}/spec.md`)
    else if (s.requirementShalls > 1)
      add('requirement-shape', 'error', `${s.id}: the requirement has ${s.requirementShalls} SHALL statements. Keep one sentence for the behaviour and make each extra condition or edge case a scenario, so it gets a test.`, `${s.dir}/spec.md`)
    if (s.scenarios.length === 0) gap('scenarios', `${s.id}: spec.md has no scenarios`, `${s.dir}/spec.md`)
    for (const sc of s.scenarios)
      if (!sc.id.startsWith(`${s.id}.`)) add('scenario-ownership', 'error', `${s.id}: spec.md tags ${sc.id}, which belongs to another story`, `${s.dir}/spec.md`)
    const dupes = s.scenarios.map(x => x.id).filter((x, i, a) => a.indexOf(x) !== i)
    for (const d of new Set(dupes)) add('scenario-ownership', 'error', `${s.id}: ${d} is tagged more than once`, `${s.dir}/spec.md`)

    const impls = s.code.filter(f => [...f.text.matchAll(re.implTag)].some(m => m[1] === s.id))
    if (impls.length > 1) add('implementation', 'error', `${s.id}: ${impls.length} files say @implements ${s.id}; a story has one use case`, s.dir)
    for (const f of s.implementedBy)
      if (!existsSync(join(repo.root, f))) add('implementation', 'error', `${s.id}: story.md says implementedBy ${f}, which doesn't exist`, `${s.dir}/story.md`)
    if (impls.length === 0 && s.implementedBy.length === 0)
      gap('implementation', `${s.id}: no file says @implements ${s.id} (or, for code that isn't TypeScript in the story's folder, list it under implementedBy: in story.md)`, s.dir)
    for (const f of s.code) for (const m of f.text.matchAll(re.implTag))
      if (m[1] !== s.id) add('implementation', 'error', `@implements ${m[1]} inside ${s.id}'s folder`, f.path)

    const scenarioIds = s.scenarios.map(x => x.id)
    for (const t of s.testedIds)
      if (!scenarioIds.includes(t)) add('orphan-test', 'error', `${s.id}: a test is named ${t}, which isn't a scenario in spec.md`, s.dir)
    // A scenario proven only by hand (manual) has nothing to run.
    for (const sc of s.scenarios)
      if (!s.testedIds.includes(sc.id) && sc.proof.some(t => t !== 'manual')) gap('untested-scenario', `${sc.id}: no test`, `${s.dir}/spec.md`)

    if (status === 'done') add('derived-status', 'warning', `${s.id}: "done" is worked out from proof now, not written; run storyspec migrate (it sets status: in-progress) and the trace shows done when every scenario is proven`, `${s.dir}/story.md`)
    for (const sc of s.scenarios) for (const t of scenarioStates(repo, proof, sc)) {
      if (t.tier === 'local') continue
      const when = t.entry ? ` on ${t.entry.at.slice(0, 10)}${t.entry.commit ? ` at ${t.entry.commit}` : ''}` : ''
      if (t.state === 'failed') gap('proof', `${sc.id}: failed in the ${t.tier} tier${when}`, s.dir)
      if (t.state === 'stale') add('proof', 'warning', `${sc.id}: its text changed since it was proven in the ${t.tier} tier${when}; prove it again (storyspec ${t.tier === 'manual' || !repo.config.tiers[t.tier]?.command ? `prove ${sc.id} --tier ${t.tier}` : `trace --tier ${t.tier}`})`, s.dir)
    }
    if (opts.requireProven && !config.gapsOnlyWarnFor.includes(status) && opts.derived?.get(s.id) !== 'done') {
      const missing = s.scenarios.flatMap(sc => scenarioStates(repo, proof, sc).filter(t => t.state !== 'proven').map(t => `${sc.id} ${t.tier} (${t.state})`))
      add('unproven', 'error', `${s.id}: not done; still to prove: ${missing.join(', ')}`, s.dir)
    }

    // A failing test is reported whatever the story's status: a draft's only warns, any other's fails the trace
    // (a done story's is a must-pass finding below).
    if (!config.mustPassFor.includes(status)) for (const sc of s.scenarios) {
      // This run's local result; a recorded tier's failure is a `proof` finding.
      if (repo.tierOutcomes.get(sc.id)?.get('local') !== 'fail') continue
      const why = repo.failures.get(sc.id)
      gap('failing-test', `${sc.id}: its test fails${why ? `\n${why.split('\n').map(l => '      ' + l).join('\n')}` : ''}`, s.dir)
    }

    if (config.mustPassFor.includes(status)) for (const sc of s.scenarios) {
      if (!s.testedIds.includes(sc.id)) continue
      const o = outcomes.get(sc.id)
      const why = repo.failures.get(sc.id)
      if (o !== 'pass') add('must-pass', 'error', `${sc.id}: story is ${status} but its test ${o === 'fail' ? 'fails' : repo.hasReport ? 'did not run' : 'has no result (run without --no-run)'}${why ? `\n${why.split('\n').map(l => '      ' + l).join('\n')}` : ''}`, s.dir)
    }

    for (const f of [...s.code, ...s.tests]) {
      const isTest = s.tests.includes(f)
      const allowed = [s.dir, ...config.storyMayImport, ...(isTest ? config.storyTestMayAlsoImport : [])]
      for (const imp of f.imports)
        if (!under(imp, allowed)) add('story-imports', 'error', `imports ${imp}; stories may import only their own folder, ${allowed.slice(1).join(', ')}`, f.path)
    }
  }

  const exempt = new Set(stories.filter(s => config.exemptStatuses.includes(s.front.status ?? '')).map(s => s.id))
  for (const g of genStatus(repo.root, stories.filter(s => !exempt.has(s.id))))
    if (g.state !== 'fresh') add('gen-fresh', 'error', `${g.story}: ${g.file} is ${g.state}; run storyspec gen`, g.file)

  for (const f of kernel) {
    const isWiring = config.wiring.includes(f.path)
    // Import statements (single- or multi-line) are skipped: who may import a story is the wiring rule's question.
    const text = f.text.replace(/^\s*import\s[\s\S]*?from\s*['"][^'"]+['"];?/gm, '').replace(/^\s*import\s*['"][^'"]+['"];?/gm, '')
    // A file a story names under implementedBy may say which story it implements, and a test in another language may
    // name the scenarios it proves (its tests can't always sit in the story's folder); nothing else outside stories may.
    const implementing = stories.filter(s => s.implementedBy.includes(f.path)).map(s => s.id)
    const testInOtherLanguage = !isTypeScript(f.path) && (languageOf(f.path)?.tests.test(f.path) ?? false)
    if (!testInOtherLanguage) for (const m of text.matchAll(re.any))
      if (!implementing.some(id => m[0] === id && new RegExp(`@implements ${id}\\b`).test(text)))
        add('ids-outside-stories', 'error', `mentions ${m[0]}; story logic belongs in ${config.storiesDir}/`, f.path)
    const layer = Object.keys(config.layers).filter(l => under(f.path, [l])).sort((a, b) => b.length - a.length)[0]
    for (const imp of f.imports) {
      // A story's request and response types carry no behaviour, so importing them for their types alone is fine anywhere.
      const typesOnly = f.typeOnly.includes(imp) && imp.endsWith('.types')
      if (under(imp, [config.storiesDir]) && !isWiring && !typesOnly) add('wiring', 'error', `imports ${imp}; only ${config.wiring.join(', ')} may import stories`, f.path)
      else if (layer && !under(imp, config.layers[layer]!)) add('layers', 'error', `imports ${imp}; ${layer} may import ${config.layers[layer]!.join(', ')}`, f.path)
    }
  }

  for (const f of repo.otherFailures)
    add('failing-test', 'error', `${f.test ? `"${f.test}" fails` : 'the file fails'}${f.message ? `\n${f.message.split('\n').map(l => '      ' + l).join('\n')}` : ''}`, f.file)

  for (const c of plan(repo.root)) {
    if (c.action === 'unchanged') continue
    const why = c.action === 'created' ? 'is missing the storyspec guidance' : c.action === 'edited' ? 'has a storyspec block edited by hand' : 'has storyspec guidance from another version'
    add('framework-sync', 'warning', `${c.file} ${why}; run storyspec sync`, c.file)
  }

  // Every adapter should be exercised by some tier: this run, or a recorded run of another tier.
  const exercised = new Set(repo.hasReport ? exercisedAdapters(repo) : [])
  for (const p of portCoverage(repo)) for (const a of p.adapters)
    if (repo.hasReport && !exercised.has(a) && !Object.keys(proof.adapters[a] ?? {}).length)
      add('adapter-untested', 'warning', `${a} (${p.port}) isn't exercised by any test in any tier; run its contract suite against it (for an adapter over a real service, in the tier that reaches the service: storyspec trace --tier <name>)`, a)

  for (const p of portCoverage(repo)) {
    if (p.adapters.length === 0) add('port-adapter', 'warning', `${p.port} has no adapter yet`, p.file)
    else if (repo.hasReport && p.contractTests.length === 0)
      add('contract-tests', 'error', `${p.port} has an adapter (${p.adapters.join(', ')}) but no test outside ${config.storiesDir}/ that ran exercises it; add a runner in test/contracts (*.test.ts) that calls its contract suite`, p.file)
  }

  return out
}

// `exercisedIn`: per adapter, the tiers whose tests exercised it (this run's tier, and recorded tiers with their date).
export type PortCoverage = { port: string; file: string; adapters: string[]; contractTests: string[]; exercisedIn: Record<string, string[]> }

/** Every exported port interface, the adapters that mention it, and the executed non-story tests that exercise it. */
export const portCoverage = (repo: Repo, proof?: ProofFile, tier = 'local'): PortCoverage[] => {
  const now = new Set(repo.hasReport ? exercisedAdapters(repo) : [])
  const exercisedIn = (a: string) => [
    ...(now.has(a) && tier === 'local' ? ['local'] : []),
    ...Object.entries(proof?.adapters[a] ?? {}).map(([t, e]) => `${t} ${e.at.slice(0, 10)}`),
  ]
  const { config, kernel } = repo
  const byPath = new Map(kernel.map(f => [f.path.replace(/\.(c|m)?tsx?$/, ''), f]))
  const executed = kernel.filter(f => repo.executedTests.includes(f.path))
  // A test exercises a port if it, or a module it imports directly, names the port.
  const reach = (t: SourceFile) => [t, ...t.imports.map(i => byPath.get(i)).filter((x): x is SourceFile => !!x)]
  const mentions = (f: SourceFile, name: string) => new RegExp(`\\b${name}\\b`).test(stripComments(f.text))
  return kernel.filter(f => under(f.path, [config.portsDir])).flatMap(port =>
    [...port.text.matchAll(/export interface (\w+)/g)].map(m => {
      const name = m[1]!
      const adapters = kernel.filter(f => under(f.path, [config.adaptersDir]) && !/\.(test|spec)\./.test(f.path) && mentions(f, name)).map(f => f.path)
      return {
        port: name,
        file: port.path,
        adapters,
        contractTests: executed.filter(t => reach(t).some(f => mentions(f, name))).map(t => t.path),
        exercisedIn: Object.fromEntries(adapters.map(a => [a, exercisedIn(a)])),
      }
    }))
}
