// Library API, for tools that want the trace without the CLI.
import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { delimiter, dirname, join } from 'node:path'
import { loadConfig, reportPaths, type Config } from './config.js'
import { evaluate, portCoverage, type Finding, type PortCoverage } from './trace/rules.js'
import { derivedStatus, readProof, recordRun } from './proof.js'
import { rows, traceMarkdown, type TraceRow } from './trace/report.js'
import { scan, sourceFiles } from './trace/scan.js'
import { importGraph } from './trace/graph.js'

export { defaults, loadConfig, type Config } from './config.js'
export { genStatus, renderGen, writeGen } from './gen.js'
export { installedVersion, plan as syncPlan, sync, type SyncChange } from './sync.js'
export { newStory } from './new-story.js'
export type { Finding, PortCoverage } from './trace/rules.js'
export type { TraceRow } from './trace/report.js'
export { scan, sourceFiles } from './trace/scan.js'
export { importGraph, type ImportGraph } from './trace/graph.js'

export { currentCommit, derivedStatus, readProof, recordManual, recordRun, scenarioStates, type ProofFile } from './proof.js'

export type TraceResult = { rows: TraceRow[]; ports: PortCoverage[]; findings: Finding[]; ok: boolean }
export type TraceOptions = { runTests?: boolean; write?: boolean; tier?: string; requireProven?: boolean; now?: string }

/** The command and report of a tier that runs tests: local uses testCommand unless it sets its own. */
export const tierRun = (config: Config, tier: string) => {
  const t = config.tiers[tier]
  if (!t) throw new Error(`No tier "${tier}" in storyspec.config.json (tiers: ${Object.keys(config.tiers).join(', ')})`)
  const command = t.command ?? (tier === 'local' ? config.testCommand : undefined)
  if (!command) throw new Error(`The ${tier} tier has no command; prove its scenarios with: storyspec prove <ID> --tier ${tier}`)
  return { command, reports: reportPaths(t.report ?? config.testReport) }
}

/** Runs a tier's tests (STORYSPEC_TIER set to it), writing its report(s) where the trace reads them. */
export const runTests = (root: string, config: Config, tier = 'local') => {
  const { command, reports } = tierRun(config, tier)
  for (const report of reports) {
    rmSync(join(root, report), { force: true })
    mkdirSync(dirname(join(root, report)), { recursive: true })
  }
  // Like npm scripts: the repo's own binaries come first, so `storyspec trace` works outside `npm run`.
  const PATH = [join(root, 'node_modules', '.bin'), process.env.PATH].filter(Boolean).join(delimiter)
  const r = spawnSync(command, { cwd: root, shell: true, stdio: 'ignore', env: { ...process.env, PATH, STORYSPEC_TIER: tier } })
  return { exitCode: r.status ?? 1 }
}

export const trace = async (root: string, opts: TraceOptions = {}): Promise<TraceResult> => {
  const tier = opts.tier ?? 'local'
  const loaded = loadConfig(root)
  // The trace reads the report of the tier it ran.
  const config = { ...loaded, testReport: tierRun(loaded, tier).reports }
  if (opts.runTests) runTests(root, config, tier)
  const repo = scan(root, config, await importGraph(root, sourceFiles(root, config)), tier)
  // Another tier's results are recorded; the local tier reruns every time.
  const proof = tier !== 'local' && repo.hasReport ? recordRun(repo, tier, opts.now ?? new Date().toISOString()) : readProof(repo)
  const derived = new Map(repo.stories.map(s => [s.id, derivedStatus(repo, proof, s)]))
  // Severities a project chose for particular rules ("off" drops the rule).
  const findings = evaluate(repo, { proof, requireProven: opts.requireProven, derived }).flatMap(f => {
    const setting = config.rules[f.rule]
    return setting === 'off' ? [] : setting ? [{ ...f, severity: setting }] : [f]
  })
  if (opts.runTests && !repo.hasReport)
    findings.push({ rule: 'tests', severity: 'error', message: `"${tierRun(config, tier).command}" did not write ${reportPaths(config.testReport).join(' or ')}` })
  const rs = rows(repo, proof, derived)
  const ports = portCoverage(repo, proof, tier)
  if (opts.write !== false) writeFileSync(join(root, config.storiesDir, 'TRACE.md'), traceMarkdown(rs, ports))
  return { rows: rs, ports, findings, ok: !findings.some(f => f.severity === 'error') }
}
