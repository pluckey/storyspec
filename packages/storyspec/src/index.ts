// Library API, for tools that want the trace without the CLI.
import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { delimiter, dirname, join } from 'node:path'
import { loadConfig, type Config } from './config.js'
import { evaluate, portCoverage, type Finding, type PortCoverage } from './trace/rules.js'
import { rows, traceMarkdown, type TraceRow } from './trace/report.js'
import { scan } from './trace/scan.js'

export { defaults, loadConfig, type Config } from './config.js'
export { genStatus, renderGen, writeGen } from './gen.js'
export { newStory } from './new-story.js'
export type { Finding, PortCoverage } from './trace/rules.js'
export type { TraceRow } from './trace/report.js'
export { scan } from './trace/scan.js'

export type TraceResult = { rows: TraceRow[]; ports: PortCoverage[]; findings: Finding[]; ok: boolean }

/** Runs the configured test command, writing its JSON report where the trace reads it. */
export const runTests = (root: string, config: Config) => {
  const report = join(root, config.testReport)
  rmSync(report, { force: true })
  mkdirSync(dirname(report), { recursive: true })
  // Like npm scripts: the repo's own binaries come first, so `storyspec trace` works outside `npm run`.
  const PATH = [join(root, 'node_modules', '.bin'), process.env.PATH].filter(Boolean).join(delimiter)
  const r = spawnSync(config.testCommand, { cwd: root, shell: true, stdio: 'ignore', env: { ...process.env, PATH } })
  return { exitCode: r.status ?? 1 }
}

export const trace = (root: string, opts: { runTests?: boolean; write?: boolean } = {}): TraceResult => {
  const config = loadConfig(root)
  if (opts.runTests) runTests(root, config)
  const repo = scan(root, config)
  const findings = evaluate(repo)
  if (opts.runTests && !repo.hasReport)
    findings.push({ rule: 'tests', severity: 'error', message: `"${config.testCommand}" did not write ${config.testReport}` })
  const rs = rows(repo)
  const ports = portCoverage(repo)
  if (opts.write !== false) writeFileSync(join(root, config.storiesDir, 'TRACE.md'), traceMarkdown(rs, ports))
  return { rows: rs, ports, findings, ok: !findings.some(f => f.severity === 'error') }
}
