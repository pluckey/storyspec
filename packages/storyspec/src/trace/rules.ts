// Judgements over a scanned repo. Each finding names its rule so docs/rules.md can explain it.
import { genStatus } from '../gen.js'
import { ids, type Repo } from './scan.js'

export type Severity = 'error' | 'warning'
export type Finding = { rule: string; severity: Severity; file?: string; message: string }

const under = (path: string, prefixes: string[]) =>
  prefixes.some(p => path === p || path.startsWith(p + '/') || path.startsWith(p + '.'))

export const evaluate = (repo: Repo): Finding[] => {
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

    if (!s.requirementTagged) gap('requirement-tag', `${s.id}: spec.md has no requirement tagged {#${s.id}}`, `${s.dir}/spec.md`)
    if (s.scenarios.length === 0) gap('scenarios', `${s.id}: spec.md has no scenarios`, `${s.dir}/spec.md`)
    for (const sc of s.scenarios)
      if (!sc.id.startsWith(`${s.id}.`)) add('scenario-ownership', 'error', `${s.id}: spec.md tags ${sc.id}, which belongs to another story`, `${s.dir}/spec.md`)
    const dupes = s.scenarios.map(x => x.id).filter((x, i, a) => a.indexOf(x) !== i)
    for (const d of new Set(dupes)) add('scenario-ownership', 'error', `${s.id}: ${d} is tagged more than once`, `${s.dir}/spec.md`)

    const impls = s.code.filter(f => [...f.text.matchAll(re.implTag)].some(m => m[1] === s.id))
    if (impls.length > 1) add('implementation', 'error', `${s.id}: ${impls.length} files say @implements ${s.id}; a story has one use case`, s.dir)
    if (impls.length === 0) gap('implementation', `${s.id}: no file says @implements ${s.id}`, s.dir)
    for (const f of s.code) for (const m of f.text.matchAll(re.implTag))
      if (m[1] !== s.id) add('implementation', 'error', `@implements ${m[1]} inside ${s.id}'s folder`, f.path)

    const scenarioIds = s.scenarios.map(x => x.id)
    for (const t of s.testedIds)
      if (!scenarioIds.includes(t)) add('orphan-test', 'error', `${s.id}: a test is named ${t}, which isn't a scenario in spec.md`, s.dir)
    for (const sc of s.scenarios)
      if (!s.testedIds.includes(sc.id)) gap('untested-scenario', `${sc.id}: no test`, `${s.dir}/spec.md`)

    if (config.mustPassFor.includes(status)) for (const sc of s.scenarios) {
      if (!s.testedIds.includes(sc.id)) continue
      const o = outcomes.get(sc.id)
      if (o !== 'pass') add('must-pass', 'error', `${sc.id}: story is ${status} but its test ${o === 'fail' ? 'fails' : repo.hasReport ? 'did not run' : 'has no result (run without --no-run)'}`, s.dir)
    }

    for (const f of [...s.code, ...s.tests]) {
      const isTest = s.tests.includes(f)
      const allowed = [s.dir, ...config.storyMayImport, ...(isTest ? config.storyTestMayAlsoImport : [])]
      for (const imp of f.imports)
        if (!under(imp, allowed)) add('story-imports', 'error', `imports ${imp}; stories may import only their own folder, ${allowed.slice(1).join(', ')}`, f.path)
    }
  }

  for (const g of genStatus(repo.root, stories))
    if (g.state !== 'fresh') add('gen-fresh', 'error', `${g.story}: ${g.file} is ${g.state}; run storyspec gen`, g.file)

  for (const f of kernel) {
    const isWiring = config.wiring.includes(f.path)
    const text = isWiring ? f.text.replace(/^\s*import\s.*$/gm, '') : f.text
    for (const m of text.matchAll(re.any)) add('ids-outside-stories', 'error', `mentions ${m[0]}; story logic belongs in ${config.storiesDir}/`, f.path)
    const layer = Object.keys(config.layers).filter(l => under(f.path, [l])).sort((a, b) => b.length - a.length)[0]
    for (const imp of f.imports) {
      if (under(imp, [config.storiesDir]) && !isWiring) add('wiring', 'error', `imports ${imp}; only ${config.wiring.join(', ')} may import stories`, f.path)
      else if (layer && !under(imp, config.layers[layer]!)) add('layers', 'error', `imports ${imp}; ${layer} may import ${config.layers[layer]!.join(', ')}`, f.path)
    }
  }

  const adapterText = kernel.filter(f => under(f.path, [config.adaptersDir])).map(f => f.text).join('\n')
  for (const port of kernel.filter(f => under(f.path, [config.portsDir])))
    for (const m of port.text.matchAll(/export interface (\w+)/g))
      if (!new RegExp(`\\b${m[1]}\\b`).test(adapterText)) add('port-adapter', 'warning', `${m[1]} has no adapter yet`, port.path)

  return out
}
