// Proof: what each scenario has been proven by. The local tier reruns on every trace, so it is never recorded. Every
// other tier's results (a deployed run, a person's manual check) are recorded in stories/PROOF.json, committed with the
// code, each with a hash of the scenario's text, so a proof of other wording is known to be stale. A story is done when
// every scenario is proven in every tier it needs, at its current text; nobody marks it done by hand.
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Repo, Scenario, SourceFile, Story } from './trace/scan.js'

export type ProofEntry = { outcome: 'pass' | 'fail'; at: string; hash: string; version?: string; commit?: string; by?: string; note?: string }
export type AdapterEntry = { at: string; commit?: string }
export type ProofFile = {
  scenarios: Record<string, Record<string, ProofEntry>>
  // Adapters a recorded tier exercised (a contract suite against the real service).
  adapters: Record<string, Record<string, AdapterEntry>>
}

export const PROOF_FILE = 'PROOF.json'
const proofPath = (repo: Pick<Repo, 'root' | 'config'>) => join(repo.root, repo.config.storiesDir, PROOF_FILE)

export const readProof = (repo: Pick<Repo, 'root' | 'config'>): ProofFile => {
  const p = proofPath(repo)
  if (!existsSync(p)) return { scenarios: {}, adapters: {} }
  const raw = JSON.parse(readFileSync(p, 'utf8')) as Partial<ProofFile>
  return { scenarios: raw.scenarios ?? {}, adapters: raw.adapters ?? {} }
}

// Keys sorted at every level, so a recorded run changes only the lines it should.
const sorted = (v: unknown): unknown =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })).map(([k, x]) => [k, sorted(x)]))
    : v
export const writeProof = (repo: Pick<Repo, 'root' | 'config'>, proof: ProofFile) =>
  writeFileSync(proofPath(repo), JSON.stringify(sorted(proof), null, 2) + '\n')

/** The commit the proof was made at, marked -dirty when the working tree had changes; undefined outside git. */
export const currentCommit = (root: string): string | undefined => {
  try {
    const head = execSync('git rev-parse --short HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).trim()
    const dirty = execSync('git status --porcelain', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).trim()
    return dirty ? `${head}-dirty` : head
  } catch { return undefined }
}

const adapterFiles = (repo: Repo) =>
  repo.kernel.filter(f => f.path === repo.config.adaptersDir || f.path.startsWith(repo.config.adaptersDir + '/')).filter(f => !/\.(test|spec)\./.test(f.path))

/** Adapters the run's executed tests exercise: a test imports the adapter, or imports a module that does. */
export const exercisedAdapters = (repo: Repo): string[] => {
  const byPath = new Map(repo.kernel.map(f => [f.path.replace(/\.(c|m)?tsx?$/, ''), f]))
  const executed = repo.kernel.filter(f => repo.executedTests.includes(f.path))
  const reach = (t: SourceFile) => [t, ...t.imports.map(i => byPath.get(i)).filter((x): x is SourceFile => !!x)]
  return adapterFiles(repo).map(a => a.path).filter(a => {
    const bare = a.replace(/\.(c|m)?tsx?$/, '')
    return executed.some(t => reach(t).some(f => f.imports.includes(bare)))
  })
}

/** Records what a run of `tier` proved: its scenarios that need that tier, and the adapters it exercised. */
export const recordRun = (repo: Repo, tier: string, now: string, commit = currentCommit(repo.root)): ProofFile => {
  const proof = readProof(repo)
  for (const s of repo.stories) for (const sc of s.scenarios) {
    const outcome = repo.tierOutcomes.get(sc.id)?.get(tier)
    if (!outcome || !sc.proof.includes(tier)) continue
    proof.scenarios[sc.id] = { ...proof.scenarios[sc.id], [tier]: { outcome, at: now, hash: sc.hash, version: s.front.version, ...(commit && { commit }) } }
  }
  if (repo.hasReport) for (const a of exercisedAdapters(repo))
    proof.adapters[a] = { ...proof.adapters[a], [tier]: { at: now, ...(commit && { commit }) } }
  writeProof(repo, proof)
  return proof
}

/** Records a person's proof of scenarios (a story ID means all of its scenarios that need `tier`). */
export const recordManual = (repo: Repo, target: string, tier: string, entry: { outcome: 'pass' | 'fail'; at: string; by?: string; note?: string }) => {
  const matches = repo.stories.flatMap(s => s.scenarios.filter(sc => sc.id === target || s.id === target).map(sc => ({ s, sc })))
  if (!matches.length) throw new Error(`No story or scenario ${target}`)
  const needing = matches.filter(({ sc }) => sc.proof.includes(tier))
  if (!needing.length) throw new Error(`${target} doesn't need the ${tier} tier (its scenarios need ${[...new Set(matches.flatMap(m => m.sc.proof))].join(', ')})`)
  const proof = readProof(repo)
  const commit = currentCommit(repo.root)
  for (const { s, sc } of needing)
    proof.scenarios[sc.id] = { ...proof.scenarios[sc.id], [tier]: { ...entry, hash: sc.hash, version: s.front.version, ...(commit && { commit }) } }
  writeProof(repo, proof)
  return needing.map(({ sc }) => sc.id)
}

export type TierState = { tier: string; state: 'proven' | 'failed' | 'stale' | 'awaiting'; entry?: ProofEntry }

/** Where a scenario stands in each tier it needs: local from this run, the others from PROOF.json. */
export const scenarioStates = (repo: Repo, proof: ProofFile, sc: Scenario): TierState[] =>
  sc.proof.map(tier => {
    if (tier === 'local') {
      const o = repo.tierOutcomes.get(sc.id)?.get('local')
      return { tier, state: o === 'pass' ? 'proven' : o === 'fail' ? 'failed' : 'awaiting' }
    }
    const entry = proof.scenarios[sc.id]?.[tier]
    if (!entry) return { tier, state: 'awaiting' }
    if (entry.hash !== sc.hash) return { tier, state: 'stale', entry }
    return { tier, state: entry.outcome === 'pass' ? 'proven' : 'failed', entry }
  })

/** A story's status as the trace reports it: superseded and planning states (gapsOnlyWarnFor) as written, otherwise done when every
 * scenario is proven in every tier it needs, else in-progress. */
export const derivedStatus = (repo: Repo, proof: ProofFile, s: Story): string => {
  const written = s.front.status ?? ''
  if (repo.config.exemptStatuses.includes(written) || repo.config.gapsOnlyWarnFor.includes(written)) return written
  const proven = s.scenarios.length > 0 && s.scenarios.every(sc => scenarioStates(repo, proof, sc).every(t => t.state === 'proven'))
  return proven ? 'done' : 'in-progress'
}
