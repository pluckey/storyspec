import { scenarioStates, type ProofFile, type TierState } from '../proof.js'
import type { Finding, PortCoverage } from './rules.js'
import { blockedScenarios, type Repo } from './scan.js'
import { startStates, type ModelRecord } from './model.js'
import type { Persona } from './personas.js'

export type TraceRow = {
  epic: string
  story: string
  title: string
  status: string
  version: string
  implementation: string
  decisions: { text: string; pinnedBy: string[]; free: boolean; open: boolean; owner?: string }[]
  after: string[]
  trigger: string[]
  emits: string[]
  personas: string[]
  scenarios:{ id: string; title: string; tested: boolean; blocked: boolean; outcome: 'pass' | 'fail' | 'not-run'; tiers: TierState[] }[]
}

export const rows = (repo: Repo, proof: ProofFile = { scenarios: {}, adapters: {} }, derived?: Map<string, string>): TraceRow[] => {
  const blocked = blockedScenarios(repo.stories)
  return repo.stories.map(s => {
    const impl = s.code.find(f => f.text.includes(`@implements ${s.id}`))
    return {
      epic: s.front.epic ?? '',
      story: s.id,
      title: s.front.title ?? '',
      status: derived?.get(s.id) ?? s.front.status ?? '',
      version: s.front.version ?? '',
      implementation: impl?.path ?? s.implementedBy.join('<br>'),
      decisions: s.decisions,
      after: s.after,
      trigger: s.trigger,
      emits: s.emits,
      personas: s.personas,
      scenarios:s.scenarios.map(sc => ({
        id: sc.id,
        title: sc.title,
        tested: s.testedIds.includes(sc.id),
        blocked: blocked.has(sc.id),
        outcome: repo.outcomes.get(sc.id) ?? 'not-run',
        tiers: scenarioStates(repo, proof, sc),
      })),
    }
  })
}

const tierMark = (t: TierState) => {
  const when = t.entry ? ` ${t.entry.at.slice(0, 10)}${t.entry.by ? ` (${t.entry.by})` : ''}` : ''
  return t.state === 'proven' ? `✓ ${t.tier}${when}` : t.state === 'failed' ? `✗ ${t.tier}${when}` : t.state === 'stale' ? `⚠ ${t.tier} stale` : `⧗ ${t.tier}`
}
// A scenario proven only locally reads as before; one with other tiers lists each.
const mark = (s: TraceRow['scenarios'][number]) => {
  const runnable = s.tiers.some(t => t.tier !== 'manual')
  if (s.blocked && !s.tested) return '⧗ blocked: open decision'
  if (!s.tested && runnable) return '✗ no test'
  if (s.tiers.length === 1 && s.tiers[0]!.tier === 'local') return s.outcome === 'pass' ? '✓ pass' : s.outcome === 'fail' ? '✗ fail' : '· not run'
  return s.tiers.map(tierMark).join(' · ')
}

export const table = (rs: TraceRow[]) => [
  '| Epic | Story | Status | v | Implementation | Scenario | Test |',
  '|---|---|---|---|---|---|---|',
  ...rs.flatMap(r => {
    const head = `| ${r.epic} | ${r.story} ${r.title}${r.trigger.length ? `<br>on ${r.trigger.join(', ')}` : ''}${r.after.length ? `<br>after ${r.after.join(', ')}` : ''} | ${r.status === 'done' && r.version ? `done (v${r.version})` : r.status} | ${r.version} | ${r.implementation} |`
    if (r.scenarios.length === 0) return [`${head} — | ✗ no scenarios |`]
    return r.scenarios.map((s, i) => i === 0 ? `${head} ${s.id} | ${mark(s)} |` : `| | | | | | ${s.id} | ${mark(s)} |`)
  }),
].join('\n')

export const portTable = (ports: PortCoverage[]) => [
  '| Port | Defined in | Adapters | Contract tests run |',
  '|---|---|---|---|',
  ...ports.map(p => {
    const adapters = p.adapters.map(a => `${a} ${(p.exercisedIn[a] ?? []).length ? `(${p.exercisedIn[a]!.map(t => `✓ ${t}`).join(', ')})` : '(✗ never exercised)'}`)
    return `| ${p.port} | ${p.file} | ${adapters.join('<br>') || '✗ none'} | ${p.contractTests.join('<br>') || '✗ none'} |`
  }),
].join('\n')

export const decisionTable = (rs: TraceRow[]) => [
  '| Story | Decision | Pinned by |',
  '|---|---|---|',
  ...rs.flatMap(r => r.decisions.map(d => `| ${r.story} | ${d.text.replace(/\|/g, '\\|')} | ${d.open ? `open${d.pinnedBy.length ? `: blocks ${d.pinnedBy.join(', ')}` : ''}` : d.pinnedBy.join(', ') || (d.free ? 'free' : '✗ neither')} |`)),
].join('\n')

/** Each trigger and the stories it starts, by kind (people, then events, schedules and other systems) and name; an
 * event also names the stories that emit it, and one that no story listens for still gets a row. */
export const triggerTable = (rs: TraceRow[]) => {
  const starts = new Map<string, string[]>()
  for (const r of rs) for (const t of r.trigger) starts.set(t, [...(starts.get(t) ?? []), r.story])
  for (const r of rs) for (const e of r.emits) if (!starts.has(`event:${e}`)) starts.set(`event:${e}`, [])
  const order = (t: string) => { const k = ['actor', 'event', 'schedule', 'external'].indexOf(t.split(':')[0]!); return k < 0 ? 4 : k }
  const triggers = [...starts.keys()].sort((a, b) => order(a) - order(b) || a.localeCompare(b))
  const emitters = (t: string) => t.startsWith('event:') ? rs.filter(r => r.emits.includes(t.slice(6))).map(r => r.story) : []
  return [
    '| Trigger | Emitted by | Starts |',
    '|---|---|---|',
    ...triggers.map(t => `| ${t} | ${emitters(t).join(', ') || (t.startsWith('event:') ? '✗ no story' : '—')} | ${starts.get(t)!.join(', ') || '—'} |`),
  ].join('\n')
}

/** Per record, each state: the stories that move a record into it (for the first state, also those that create one),
 * the stories that entering it starts, and the states that can follow it. */
export const modelTables = (model: ModelRecord[], rs: TraceRow[]) => model.flatMap(r => {
  const starts = startStates(r)
  const emitters = (e: string) => rs.filter(x => x.emits.includes(e)).map(x => x.story)
  const listeners = (e: string) => rs.filter(x => x.trigger.includes(`event:${e}`)).map(x => x.story)
  return [`### ${r.name}`, '', '| State | Entered by | Starts | Next |', '|---|---|---|---|',
    ...r.states.map(st => {
      const first = starts.includes(st)
      const events = [`${r.slug}.${st.slug}`, ...(first ? [`${r.slug}.created`] : [])]
      const by = [...new Set(events.flatMap(emitters))]
      const next = r.transitions.filter(([from]) => from === st.name).map(([, to]) => to)
      return `| ${st.name}${first ? ' (start)' : ''} | ${by.join(', ') || (first ? '—' : '✗ no story')} | ${listeners(`${r.slug}.${st.slug}`).join(', ') || '—'} | ${next.join(', ') || '—'} |`
    }), '']
}).join('\n')

/** The stories table, or with `by: 'persona'` one table per persona: described ones in PERSONAS.md order, then any a
 * story names that PERSONAS.md doesn't, then the stories that serve no one. A story serving two appears under both. */
export const storiesTables = (rs: TraceRow[], personas: Persona[] = [], by?: 'persona') => {
  if (by !== 'persona') return table(rs)
  const undescribed = [...new Set(rs.flatMap(r => r.personas))].filter(k => !personas.some(p => p.key === k))
  const groups = [...personas.map(p => [p.name, p.key] as const), ...undescribed.map(k => [`${k} (not in PERSONAS.md)`, k] as const)]
  const nobody = rs.filter(r => !r.personas.length)
  return [
    ...groups.map(([name, key]) => {
      const mine = rs.filter(r => r.personas.includes(key))
      return `### ${name}\n\n${mine.length ? table(mine) : 'No stories yet.'}\n`
    }),
    ...(nobody.length ? [`### No persona\n\n${table(nobody)}\n`] : []),
  ].join('\n')
}

/** Epics down, personas across; each cell counts the stories of that epic serving that persona as done / in progress /
 * draft (ready counts as draft: not started), and reads `·` when there are none. Superseded stories don't count. */
export const personaGrid = (rs: TraceRow[], personas: Persona[]) => {
  const live = rs.filter(r => r.status !== 'superseded')
  const epics = [...new Set(live.map(r => r.epic || 'no epic'))]
  const cell = (epic: string, key: string) => {
    const mine = live.filter(r => (r.epic || 'no epic') === epic && r.personas.includes(key))
    if (!mine.length) return '·'
    const n = (...st: string[]) => mine.filter(r => st.includes(r.status)).length
    return `${n('done')} / ${n('in-progress')} / ${n('draft', 'ready')}`
  }
  return [
    'Stories per epic and persona: done / in progress / draft (ready counts as draft).', '',
    `| Epic | ${personas.map(p => p.name).join(' | ')} |`,
    `|---|${personas.map(() => '---|').join('')}`,
    ...epics.map(e => `| ${e} | ${personas.map(p => cell(e, p.key)).join(' | ')} |`),
  ].join('\n')
}

export type TraceMarkdownOptions = { personas?: Persona[]; by?: 'persona' }

export const traceMarkdown = (rs: TraceRow[], ports: PortCoverage[] = [], model?: ModelRecord[], opts: TraceMarkdownOptions = {}) =>
  ['# Trace', '', 'Generated by `storyspec trace`. Do not edit.', '', '## Stories', '', storiesTables(rs, opts.personas, opts.by), '',
    ...(model ? ['## Model', '', modelTables(model, rs)] : []),
    ...(rs.some(r => r.trigger.length || r.emits.length) ? ['## Triggers', '', triggerTable(rs), ''] : []),
    ...(rs.some(r => r.decisions.length) ? ['## Decisions', '', decisionTable(rs), ''] : []),
    ...(ports.length ? ['## Ports', '', portTable(ports), ''] : []),
    // Always last when the project describes its personas, whatever the grouping above.
    ...(opts.personas ? ['## Personas', '', personaGrid(rs, opts.personas), ''] : [])].join('\n')

export const findingsText = (findings: Finding[]) => {
  const fmt = (f: Finding) => `  - [${f.rule}] ${f.file ? `${f.file}: ` : ''}${f.message}`
  const warnings = findings.filter(f => f.severity === 'warning')
  const errors = findings.filter(f => f.severity === 'error')
  return [
    warnings.length ? `\n${warnings.length} warning(s):\n${warnings.map(fmt).join('\n')}` : '',
    errors.length ? `\n${errors.length} problem(s):\n${errors.map(fmt).join('\n')}` : '',
  ].filter(Boolean).join('\n')
}
