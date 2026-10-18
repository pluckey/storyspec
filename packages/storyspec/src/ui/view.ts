// What storyspec ui shows, worked out on the server from the same scan, trace and proof the CLI uses, so no state on
// the page can disagree with `storyspec trace`. The page renders this model and derives nothing: every state comes
// with the reason for it (its why), every finding with a sentence and an action, all in the vocabulary's words. IDs,
// versions, rule names and hashes go only into `details`, the muted line at the foot of an item.
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { Config } from '../config.js'
import { decisionQuestion, requirementText, scenarioSteps } from '../edit.js'
import type { ProofEntry, ProofFile, TierState } from '../proof.js'
import type { TraceRow } from '../trace/report.js'
import type { Finding, PortCoverage } from '../trace/rules.js'
import type { Persona } from '../trace/personas.js'
import { scenarioHash, type Repo, type Story } from '../trace/scan.js'
import { say } from './route.js'
import { gridsOf, screenDefinitions } from './screens.js'
import { VOCABULARY, type ActionOp, type FindingWords, type Module, type ScreenKey, type StateKey, type TraceStatus, type Vocabulary } from './vocabulary.js'

export type Action = { label: string; op?: ActionOp; target?: string }
export type Why = { sentence: string; items: { title: string; word?: string; action?: Action }[]; note?: string; then?: string; now?: string; action?: Action; details: string }
export type State = { key: StateKey; word: string; why: Why }
/** `since` is the day an item last changed: its file's last change, or a later proof. */
export type ScenarioItem = { id: string; storyId: string; title: string; story: string; state: State; steps: string[]; since: string; details: string; entry?: { by: string; date: string; note?: string } }
export type StoryLine = { id: string; title: string; personas: string[]; state: State; summary: string; requirement: string; scenarios: ScenarioItem[]; since: string; details: string }
export type FindingItem = { sentence: string; severity: 'error' | 'warning'; module: Module; screen: ScreenKey; action: Action; details: string }
export type InboxKind = 'decide' | 'approve' | 'check-again' | 'check' | 'claim'
/** `who` is whom an item waits on (a decision's owner) or concerns (its story's personas); a scenario's carries its state. */
export type InboxItem = { kind: InboxKind; title: string; sentence: string; owner?: string; who: string; since: string; state?: State; screen: ScreenKey; action: Action; details: string }
export type DecisionItem = { key: string; storyId: string; story: string; title: string; open: boolean; sentence: string; owner?: string; who: string; since: string; action?: Action; details: string }
/** A record of MODEL.md: each state with its event and the stories around it, by title. */
export type RecordView = {
  name: string; transitions: [string, string][]
  states: { name: string; event: string; start: boolean; quiet: boolean; movedBy: string[]; createdBy: string[]; starts: string[]; next: string[] }[]
}

export type ViewInput = {
  root: string; config: Config; repo: Repo; rows: TraceRow[]; findings: Finding[]; ports: PortCoverage[]; proof: ProofFile
  /** Each persona with the IDs of the live stories serving it, as uiState works them out. */
  personas?: (Persona & { stories: string[] })[]
}

// ---------- states ----------

/** A scenario's status as the trace marks it in TRACE.md: blocked, untested, failed, stale or proven, else what it
 * still waits for (its local run, a person, or another tier's run). */
export const scenarioStatus = (sc: TraceRow['scenarios'][number]): TraceStatus => {
  if (sc.blocked && !sc.tested) return 'blocked'
  if (!sc.tested && sc.tiers.some(t => t.tier !== 'manual')) return 'no-test'
  if (sc.tiers.some(t => t.state === 'failed')) return 'failed'
  if (sc.tiers.some(t => t.state === 'stale')) return 'stale'
  if (sc.tiers.length && sc.tiers.every(t => t.state === 'proven')) return 'proven'
  const waiting = sc.tiers.filter(t => t.state === 'awaiting').map(t => t.tier)
  return waiting.includes('local') || !waiting.length ? 'not-run' : waiting.includes('manual') ? 'awaiting-person' : 'awaiting-run'
}

/** The state word the vocabulary gives a trace status. */
export const stateOf = (status: TraceStatus, words: Vocabulary = VOCABULARY): StateKey =>
  (Object.entries(words.states) as [StateKey, { trace: TraceStatus[] }][]).find(([, s]) => s.trace.includes(status))![0]

const byId = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true })

/** The page: what each screen holds (the model), the screens' definitions, and each screen's rows as the grid draws
 * them (screens.ts). `words` is the vocabulary; every word comes from it. */
export const buildPage = (input: ViewInput, words: Vocabulary = VOCABULARY) => {
  const model = buildModel(input, words)
  return { ...model, definitions: screenDefinitions(words), grids: gridsOf(model, words) }
}

/** What each screen holds, in the vocabulary's words. */
const buildModel = (input: ViewInput, words: Vocabulary) => {
  const { root, config, repo, rows, proof } = input
  const t = (template: string, vars: Record<string, unknown> = {}) => say(template, vars, words.nouns)
  const prefix = config.idPrefix
  const exempt = (s: { front: Record<string, string> }) => config.exemptStatuses.includes(s.front.status ?? '')
  const stories = repo.stories
  const live = stories.filter(s => !exempt(s))
  const row = new Map(rows.map(r => [r.story, r]))
  const personaName = (key: string) => repo.personas?.find(p => p.key === key)?.name ?? key.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase())
  const storyTitle = (id: string) => stories.find(s => s.id === id)?.front.title ?? id
  const scenarioTitle = (id: string) => stories.flatMap(s => s.scenarios).find(sc => sc.id === id)?.title ?? id
  const quoted = (text: string) => `“${text}”`
  // A decision's text names stories and scenarios by ID; the page names them by title.
  const plain = (text: string) => text
    .replace(new RegExp(`\\b${prefix}-\\d+\\.\\d+\\b`, 'g'), id => quoted(scenarioTitle(id)))
    .replace(new RegExp(`\\b${prefix}-\\d+\\b`, 'g'), id => quoted(storyTitle(id)))
  const steps = new Map(stories.map(s => [s.id, scenarioSteps(s.spec, prefix)]))
  const decisionsOf = (s: Story) => s.decisions.map((d, i) => ({ ...d, key: `${s.id}#${i}`, story: s, question: decisionQuestion(d.text) }))
  const openDecisions = live.flatMap(decisionsOf).filter(d => d.open)
  const blocker = (id: string) => openDecisions.find(d => d.pinnedBy.includes(id))

  const tierWord = (tier: string) => tier === 'local' ? words.tiers.local : tier === 'manual' ? words.tiers.manual : t(words.tiers.other, { tier })
  const tierWords = (tiers: string[]) => [...new Set(tiers)].map(tierWord).join(words.tiers.and)
  const when = (e?: ProofEntry) => ({ by: e?.by || words.someone, date: e?.at.slice(0, 10) ?? '' })
  const action = (key: keyof Vocabulary['actions'], op?: ActionOp, target?: string, vars?: Record<string, unknown>): Action =>
    ({ label: t(words.actions[key], vars), ...(op && { op }), ...(target && { target }) })
  const details = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(' · ')
  const state = (status: TraceStatus, why: Why): State => { const key = stateOf(status, words); return { key, word: words.states[key].word, why } }
  const unclaimedFiles = input.findings.filter(f => f.rule === 'unclaimed-code' && f.file).map(f => f.file!)
  const day = changedOn(root, [config.storiesDir, ...unclaimedFiles])
  const latest = (...days: (string | undefined)[]) => days.filter((d): d is string => !!d).sort().at(-1) ?? ''
  const specDay = (s: Story) => day(`${s.dir}/spec.md`)

  // ---------- scenarios ----------
  const scenarioItem = (s: Story, sc: TraceRow['scenarios'][number]): ScenarioItem => {
    const status = scenarioStatus(sc)
    const hash = s.scenarios.find(x => x.id === sc.id)?.hash
    const tier = (st: TierState['state']) => sc.tiers.find(x => x.state === st)
    let why: Why
    if (status === 'proven') {
      const manual = sc.tiers.find(x => x.tier === 'manual'), run = sc.tiers.find(x => x.tier !== 'manual' && x.tier !== 'local')
      const sentence = [t(words.why.proven, { tiers: tierWords(sc.tiers.map(x => x.tier)) }),
        manual && t(words.why['proven-person'], when(manual.entry)),
        run && t(words.why['proven-run'], { tier: run.tier, ...when(run.entry) })].filter(Boolean).join(' ')
      why = { sentence, items: [], ...(manual?.entry?.note && { note: t(words.why.note, { note: manual.entry.note }) }), details: details(sc.id, `v${s.front.version}`, hash) }
    } else if (status === 'failed') {
      const f = tier('failed')!
      const by = f.tier === 'manual' ? 'failed-person' : f.tier === 'local' ? 'failed' : 'failed-run'
      why = {
        sentence: t(words.why[by], { tier: f.tier, ...when(f.entry) }), items: [],
        ...(f.entry?.note && { note: t(words.why.note, { note: f.entry.note }) }),
        action: f.tier === 'manual' ? action('check-again', 'check-again', sc.id) : f.tier === 'local' ? action('fix') : action('run-tier', undefined, undefined, { tier: f.tier }),
        details: details(sc.id, `v${s.front.version}`, f.tier === 'local' ? 'failing-test' : 'proof', hash),
      }
    } else if (status === 'stale') {
      const st = tier('stale')!
      const then = st.entry && thenText(root, s.dir, sc.id, st.entry.hash, st.entry.commit, prefix)
      why = {
        sentence: t(words.why[st.tier === 'manual' ? 'stale' : 'stale-run'], { tier: st.tier, ...when(st.entry) }) + (then ? '' : ` ${words.why['stale-unknown']}`),
        items: [], ...(then && { then }), now: [sc.title, ...(steps.get(s.id)?.[sc.id] ?? [])].join('\n'),
        action: st.tier === 'manual' ? action('check-again', 'check-again', sc.id) : action('run-tier', undefined, undefined, { tier: st.tier }),
        details: details(sc.id, st.entry?.version && st.entry.version !== s.front.version ? `v${st.entry.version} → v${s.front.version}` : `v${s.front.version}`, 'proof', `${st.entry?.hash} → ${hash}`),
      }
    } else if (status === 'blocked') {
      const d = blocker(sc.id)
      const vars = { question: d ? plain(d.question) : '', owner: d?.owner ? personaName(d.owner) : '' }
      why = { sentence: t(words.why[d?.owner ? 'blocked' : 'blocked-nobody'], vars), items: [], ...(d && { action: action('answer', 'decide', d.key) }), details: details(sc.id, `v${s.front.version}`, 'decisions', hash) }
    } else if (status === 'awaiting-person') {
      why = { sentence: words.why['awaiting-person'], items: [], action: action('check', 'check', sc.id), details: details(sc.id, `v${s.front.version}`, hash) }
    } else {
      const run = sc.tiers.find(x => x.state === 'awaiting' && x.tier !== 'local' && x.tier !== 'manual')
      why = {
        sentence: t(words.why[status], { tier: run?.tier ?? '' }), items: [],
        action: status === 'no-test' ? action('write-test') : status === 'not-run' ? action('run-tests') : action('run-tier', undefined, undefined, { tier: run?.tier ?? '' }),
        details: details(sc.id, `v${s.front.version}`, status === 'no-test' ? 'untested-scenario' : undefined, hash),
      }
    }
    const recorded = sc.tiers.find(x => x.tier === 'manual')?.entry
    return {
      id: sc.id, storyId: s.id, title: sc.title, story: s.front.title ?? '', state: state(status, why), steps: steps.get(s.id)?.[sc.id] ?? [],
      since: latest(specDay(s), ...sc.tiers.map(x => x.entry?.at.slice(0, 10))),
      details: why.details, ...(recorded && { entry: { ...when(recorded), ...(recorded.note && { note: recorded.note }) } }),
    }
  }
  const scenarioItems = new Map(live.map(s => [s.id, (row.get(s.id)?.scenarios ?? []).map(sc => scenarioItem(s, sc))]))

  // ---------- stories ----------
  const summary = (items: ScenarioItem[], r?: TraceRow) => {
    if (!items.length) return words.summary.none
    const n = { tests: 0, run: 0, person: 0, look: 0 }
    for (const sc of r?.scenarios ?? []) {
      if (scenarioStatus(sc) !== 'proven') n.look++
      else if (sc.tiers.some(x => x.tier === 'manual')) n.person++
      else if (sc.tiers.some(x => x.tier !== 'local')) n.run++
      else n.tests++
    }
    return (['tests', 'run', 'person', 'look'] as const).filter(k => n[k]).map(k => t(words.summary[k], { n: n[k] })).join(words.summary.join)
  }
  const storyLine = (s: Story): StoryLine => {
    const r = row.get(s.id)
    const items = scenarioItems.get(s.id) ?? []
    const status = (r?.status ?? s.front.status ?? 'draft') as TraceStatus
    const proven = items.filter(x => x.state.key === 'checked')
    let why: Why
    if (status === 'done') why = { sentence: t(words.why.done, { n: items.length, tiers: tierWords(s.scenarios.flatMap(x => x.proof)) }), items: [], details: details(s.id, `v${s.front.version}`) }
    else if (status === 'draft') why = { sentence: words.why.draft, items: [], action: action('approve', 'approve', s.id), details: details(s.id, `v${s.front.version}`) }
    else if (status === 'ready') why = { sentence: words.why.ready, items: [], action: action('start', 'start', s.id), details: details(s.id, `v${s.front.version}`) }
    else why = {
      sentence: items.length ? t(words.why['in-progress'], { proven: proven.length, n: items.length }) : words.why['in-progress-empty'],
      items: items.filter(x => x.state.key !== 'checked').map(x => ({ title: x.title, word: x.state.word, ...(x.state.why.action && { action: x.state.why.action }) })),
      ...(!items.length && { action: action('add-scenario', 'add-scenario', s.id) }),
      details: details(s.id, `v${s.front.version}`),
    }
    return {
      id: s.id, title: s.front.title ?? '', personas: s.personas.map(personaName), state: state(status === 'done' || status === 'draft' || status === 'ready' ? status : 'in-progress', why),
      summary: summary(items, r), requirement: requirementText(s.spec, s.id), scenarios: items, since: latest(day(`${s.dir}/story.md`), specDay(s)), details: why.details,
    }
  }
  const lines = live.map(storyLine)
  const lineOf = new Map(lines.map(l => [l.id, l]))

  // ---------- findings ----------
  const variant = (f: Finding) => {
    if (f.rule === 'decisions') return /has a test, but its decision/.test(f.message) ? 'decisions:assumed' : /which isn't a scenario$/.test(f.message) ? 'decisions:missing' : /" is open/.test(f.message) ? 'decisions:open' : 'decisions'
    if (f.rule === 'model' && f.severity === 'warning') return 'model:unreached'
    if (f.rule === 'trigger' && /no story emits/.test(f.message)) return 'trigger:unheard'
    if (f.rule === 'proof') return /text changed since/.test(f.message) ? 'proof:stale' : /in the manual tier/.test(f.message) ? 'proof:person' : 'proof'
    return f.rule
  }
  const findingWords = words.findings as Record<string, FindingWords>
  const thing = (f: Finding, key: string) => {
    const quotedText = f.message.match(/"([^"]*)"/)?.[1]
    if (key.startsWith('decisions') && key !== 'decisions:assumed' && quotedText !== undefined) return quoted(plain(decisionQuestion(quotedText)))
    if (key === 'model:unreached') { const m = f.message.match(/nothing moves an? (.+) to (.+)$/); if (m) return `a ${m[1]} to ${m[2]}` }
    if (f.rule === 'persona-without-stories') return personaName(f.message.split(':')[0]!)
    if (f.rule === 'port-adapter' || f.rule === 'contract-tests') return f.message.split(' ')[0]!
    if (f.rule === 'adapter-untested') return f.file ?? f.message.split(' ')[0]!
    const sc = f.message.match(new RegExp(`^(${prefix}-\\d+\\.\\d+)\\b`))?.[1]
    if (sc) return quoted(scenarioTitle(sc))
    const st = f.message.match(new RegExp(`^(${prefix}-\\d+)\\b`))?.[1]
    if (st) return quoted(storyTitle(st))
    // A file in a story's folder is named by its story, whose title the page uses everywhere.
    const inStory = f.file?.match(new RegExp(`^${config.storiesDir}/(${prefix}-\\d+)-`))?.[1]
    if (inStory) return quoted(storyTitle(inStory))
    return f.file ?? words.project
  }
  const findingIds = (f: Finding) => [...new Set(f.message.match(new RegExp(`\\b${prefix}-\\d+(?:\\.\\d+)?\\b`, 'g')) ?? [])]
  const findingTarget = (f: Finding, op?: ActionOp) => {
    if (op === 'claim') return f.file
    if (op === 'start-story') return f.message.split(':')[0]
    if (op === 'decide') { const q = f.message.match(/"([^"]*)"/)?.[1]; return live.flatMap(decisionsOf).find(d => d.text === q)?.key }
    return findingIds(f)[0]
  }
  /** A finding in the page's words: the sentence naming the thing and the fix, the action, and the rule on details. */
  const findingItem = (f: Finding): FindingItem => {
    const key = variant(f)
    const w = findingWords[key] ?? findingWords[f.rule] ?? { module: 'implementation', screen: 'code', sentence: '{thing}', action: words.actions.fix }
    const target = findingTarget(f, w.op)
    return {
      sentence: t(w.sentence, { thing: thing(f, key) }), severity: f.severity, module: w.module, screen: w.screen,
      action: { label: w.action, ...(w.op && target && { op: w.op, target }) },
      details: details(...findingIds(f), f.rule, f.file),
    }
  }
  // Findings Needs you already lists as an item (an open decision, a stale proof, unclaimed code) aren't listed twice.
  const inInbox = (f: Finding) => ['decisions:open', 'proof:stale'].includes(variant(f)) || f.rule === 'unclaimed-code'
  const findings = input.findings.filter(f => !inInbox(f)).map(findingItem)
  const findingsOn = (screen: ScreenKey) => findings.filter(f => f.screen === screen)

  // ---------- Needs you ----------
  const personasOf = (id: string) => lineOf.get(id)?.personas.join(', ') ?? ''
  const decide: InboxItem[] = openDecisions.map(d => ({
    kind: 'decide', title: plain(d.question), screen: 'decisions', action: action('answer', 'decide', d.key),
    sentence: [d.owner ? t(words.inbox.decide, { owner: personaName(d.owner) }) : words.inbox['decide-nobody'], d.pinnedBy.length ? t(words.inbox.blocks, { n: d.pinnedBy.length }) : ''].filter(Boolean).join(' '),
    ...(d.owner && { owner: personaName(d.owner) }), who: d.owner ? personaName(d.owner) : words.decisions.unassigned, since: specDay(d.story),
    details: details(d.story.id, ...d.pinnedBy, 'decisions'),
  }))
  const approve: InboxItem[] = live.filter(s => s.front.status === 'draft').map(s => ({
    kind: 'approve', title: s.front.title ?? '', sentence: words.inbox.approve, screen: 'stories', action: action('approve', 'approve', s.id),
    who: personasOf(s.id), since: lineOf.get(s.id)?.since ?? '', details: details(s.id, `v${s.front.version}`),
  }))
  const allItems = [...scenarioItems.values()].flat().sort((a, b) => byId(a.id, b.id))
  const stale = allItems.filter(x => (row.get(x.storyId)?.scenarios.find(sc => sc.id === x.id)?.tiers ?? []).some(tr => tr.state === 'stale'))
  const checkAgain: InboxItem[] = stale.map(x => ({
    kind: 'check-again', title: x.title, sentence: words.inbox['check-again'], screen: 'stale', state: x.state,
    action: x.state.why.action ?? action('check-again', 'check-again', x.id), who: personasOf(x.storyId), since: x.since, details: x.details,
  }))
  // A check is due once a story is being built: a draft's or a ready story's scenarios aren't built to check yet.
  const building = new Set(live.filter(s => !config.gapsOnlyWarnFor.includes(s.front.status ?? '')).map(s => s.id))
  const check: InboxItem[] = allItems.filter(x => building.has(x.storyId) && x.state.why.action?.op === 'check').map(x => ({
    kind: 'check', title: x.title, sentence: words.inbox.check, screen: 'by-a-person', state: x.state, action: action('check', 'check', x.id),
    who: personasOf(x.storyId), since: x.since, details: x.details,
  }))
  const claim: InboxItem[] = unclaimedFiles.map(file => ({
    kind: 'claim', title: file, sentence: words.inbox.claim, screen: 'code', action: action('claim', 'claim', file), who: '', since: day(file), details: details('unclaimed-code'),
  }))
  const inbox = [...decide, ...approve, ...checkAgain, ...check, ...claim]

  // ---------- navigation ----------
  const count = (screen: ScreenKey) => inbox.filter(i => i.screen === screen).length + findingsOn(screen).length
  const nav = {
    inbox: { label: words.nav.inbox, count: inbox.length },
    groups: words.nav.groups.map(g => ({
      key: g.key, label: g.label, caption: g.caption,
      count: g.screens.reduce((n, s) => n + count(s), 0),
      screens: g.screens.map(s => ({ key: s, label: words.nav.screens[s], count: count(s) })),
    })),
  }

  // ---------- screens ----------
  const decisionItems: DecisionItem[] = live.flatMap(decisionsOf).map(d => {
    const about = { key: d.key, storyId: d.story.id, story: d.story.front.title ?? '', since: specDay(d.story), details: details(d.story.id, ...d.pinnedBy) }
    return d.open
      ? { ...about, title: plain(d.question), open: true, sentence: decide.find(i => i.action.target === d.key)!.sentence, ...(d.owner && { owner: d.owner }),
        who: d.owner ? personaName(d.owner) : words.decisions.unassigned, action: action('answer', 'decide', d.key) }
      : { ...about, title: plain(d.text.replace(/\s*\((?:free)\)\s*$/i, '').replace(new RegExp(`[;,]?\\s*pinned by\\s+(?:${prefix}-\\d+\\.\\d+(?:\\s*,\\s*)?)+\\s*$`, 'i'), '')), open: false,
        sentence: d.pinnedBy.length ? t(words.decisions.pinned, { n: d.pinnedBy.length }) : d.free ? words.decisions.free : '', who: '' }
  })
  const sorted = (xs: DecisionItem[]) => [...xs.filter(d => d.open), ...xs.filter(d => !d.open)]
  const personaCounts = (ids: string[]) => {
    const mine = ids.map(id => lineOf.get(id)).filter((l): l is StoryLine => !!l)
    return { done: mine.filter(l => l.state.key === 'can-do-today').length, building: mine.filter(l => l.state.key === 'being-built').length, planned: mine.filter(l => l.state.key === 'planned').length }
  }
  const people = (input.personas ?? []).map(p => ({
    key: p.key, name: p.name, prose: p.prose || words.people.noProse, stories: p.stories, counts: personaCounts(p.stories),
    line: t(words.home.persona, { name: p.name, ...personaCounts(p.stories), doneWord: words.states['can-do-today'].word, buildingWord: words.states['being-built'].word }),
    waiting: sorted(decisionItems.filter(d => d.open && d.owner === p.key)),
    sub: p.stories.length ? t('{n|story}', { n: p.stories.length }) : words.people.noStories,
  }))
  const scenarioRows = (keep: (tiers: string[]) => boolean) => lines.filter(l => l.scenarios.length).flatMap(l => {
    const tiersOf = (id: string) => stories.find(s => s.id === l.id)!.scenarios.find(sc => sc.id === id)?.proof ?? []
    return l.scenarios.filter(sc => keep(tiersOf(sc.id)))
  })
  const manual = scenarioRows(tiers => tiers.includes('manual'))
  const doneByHand = (x: ScenarioItem) => ['checked', 'failed-a-check'].includes(x.state.key) && !!x.entry
  const implementing = live.map(s => ({
    title: s.front.title ?? '', id: s.id,
    files: [...new Set([...s.code.filter(f => f.text.includes(`@implements ${s.id}`)).map(f => f.path), ...s.implementedBy])],
    details: s.id,
  }))
  const checkedCount = allItems.filter(x => x.state.key === 'checked').length
  // Each record's states with the event a story emits to move a record into it (`<record>.<state>`), the stories that
  // do, and the stories entering it starts.
  const emitting = (e: string) => stories.filter(s => s.emits.includes(e)).map(s => s.front.title ?? s.id)
  const startedBy = (e: string) => stories.filter(s => s.trigger[0] === `event:${e}`).map(s => s.front.title ?? s.id)
  const records: RecordView[] = (repo.model ?? []).map(r => ({
    name: r.name, transitions: r.transitions,
    states: r.states.map(st => {
      const event = `${r.slug}.${st.slug}`, next = r.transitions.filter(([from]) => from === st.name).map(([, to]) => to)
      return {
        name: st.name, event, start: !r.transitions.some(([, to]) => to === st.name), quiet: !next.length && !startedBy(event).length,
        movedBy: emitting(event), createdBy: emitting(`${r.slug}.created`), starts: startedBy(event), next,
      }
    }),
  }))

  const screens = {
    people: { ...words.screens.people, empty: input.personas ? undefined : words.screens.people.empty, action: action('add-persona', 'add-persona'), personas: people,
      unassigned: sorted(decisionItems.filter(d => d.open && !d.owner)), findings: findingsOn('people') },
    stories: { ...words.screens.stories, lines, retired: stories.length - live.length ? t(words.screens.stories.retired, { n: stories.length - live.length }) : undefined,
      empty: lines.length ? undefined : words.screens.stories.empty, findings: findingsOn('stories') },
    decisions: { ...words.screens.decisions, items: sorted(decisionItems), empty: decisionItems.length ? undefined : words.screens.decisions.empty, findings: findingsOn('decisions') },
    records: { ...words.screens.records, records, empty: repo.model?.length ? undefined : words.screens.records.empty, findings: findingsOn('records') },
    words: (() => { const files = vocabularyFiles(root, config.storiesDir); return { ...words.screens.words, files, empty: files.length ? undefined : words.screens.words.empty } })(),
    code: { ...words.screens.code, stories: implementing.filter(s => s.files.length), claims: claim, empty: implementing.some(s => s.files.length) ? undefined : words.screens.code.empty, findings: findingsOn('code') },
    ports: { ...words.screens.ports, ports: input.ports.map(p => ({ name: p.port, file: p.file, adapters: p.adapters.map(a => ({ file: a, tiers: p.exercisedIn[a] ?? [] })), tests: p.contractTests })),
      empty: input.ports.length ? undefined : words.screens.ports.empty, findings: findingsOn('ports') },
    layers: { ...words.screens.layers, rules: Object.entries(config.layers).map(([layer, may]) => ({ layer, may })), wiringFiles: config.wiring,
      empty: Object.keys(config.layers).length || config.wiring.length ? undefined : words.screens.layers.empty, findings: findingsOn('layers') },
    'by-tests': (() => { const items = scenarioRows(tiers => tiers.includes('local')); return { ...words.screens['by-tests'], items, empty: items.length ? undefined : words.screens['by-tests'].empty, findings: findingsOn('by-tests') } })(),
    'by-a-run': (() => { const items = scenarioRows(tiers => tiers.some(x => x !== 'local' && x !== 'manual')); return { ...words.screens['by-a-run'], items, empty: items.length ? undefined : words.screens['by-a-run'].empty, findings: findingsOn('by-a-run') } })(),
    'by-a-person': { ...words.screens['by-a-person'], pendingItems: manual.filter(x => !doneByHand(x)), doneItems: manual.filter(doneByHand),
      empty: manual.length ? undefined : words.screens['by-a-person'].empty, findings: findingsOn('by-a-person') },
    stale: { ...words.screens.stale, items: stale, empty: stale.length ? undefined : words.screens.stale.empty, findings: findingsOn('stale') },
  }

  const home = {
    stories: t(words.home.stories, { n: lines.length }),
    personas: people.map(p => p.line),
    beingBuilt: t(words.home.beingBuilt, { n: lines.filter(l => l.state.key === 'being-built').length, buildingWord: words.states['being-built'].word }),
    decisions: t(words.home.decisions, { n: openDecisions.length }),
  }
  const summaries = nav.groups.map(g => ({
    key: g.key, label: g.label, caption: g.caption,
    text: g.key === 'model' ? t(words.home.model, { stories: lines.length, decisions: openDecisions.length, people: people.length })
      : g.key === 'implementation' ? t(words.home.implementation, { claimed: new Set(implementing.flatMap(s => s.files)).size, unclaimed: claim.length, ports: input.ports.length })
      : t(words.home.proof, { checked: checkedCount, n: allItems.length, stale: stale.length }),
  }))

  return {
    nav,
    inbox: { ...words.screens.inbox, items: inbox, empty: inbox.length ? undefined : words.screens.inbox.empty, home, summaries },
    screens,
  }
}

export type Model = ReturnType<typeof buildModel>
export type Page = ReturnType<typeof buildPage>

// ---------- helpers that read files ----------

/** The day each file under `paths` last changed (YYYY-MM-DD): its last commit, read in one `git log`; or, for a file git
 * hasn't committed as it is (new, edited, or no git at all), the day it was saved. */
const changedOn = (root: string, paths: string[]) => {
  const git = (...args: string[]) => {
    try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 }) } catch { return undefined }
  }
  const committed = new Map<string, string>()
  let day = ''
  for (const line of (git('log', '--format=@%cs', '--name-only', '--relative', '--', ...paths) ?? '').split('\n')) {
    if (line.startsWith('@')) day = line.slice(1)
    else if (line && !committed.has(line)) committed.set(line, day)
  }
  const uncommitted = new Set((git('ls-files', '-m', '-o', '--exclude-standard', '--', ...paths) ?? '').split('\n').filter(Boolean))
  const saved = (file: string) => { try { return statSync(join(root, file)).mtime.toISOString().slice(0, 10) } catch { return '' } }
  return (file: string) => uncommitted.has(file) || !committed.has(file) ? saved(file) : committed.get(file)!
}

/** The scenario's title and steps as they were when a proof with `hash` was recorded, from git: the commit the proof
 * names first, then the spec's recent history. Undefined when git doesn't have that text. */
const thenText = (root: string, dir: string, id: string, hash: string, commit: string | undefined, prefix: string) => {
  const git = (...args: string[]) => {
    try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 24 }) } catch { return undefined }
  }
  // ./ makes the path relative to the project, which may sit inside a larger repository.
  const file = `./${dir}/spec.md`
  const commits = [commit?.replace(/-dirty$/, ''), ...(git('log', '--format=%h', '-n', '50', '--', file) ?? '').split('\n')].filter((c): c is string => !!c)
  const tag = new RegExp(`\\{#${id.replace('.', '\\.')}[\\s}]`)
  for (const c of new Set(commits)) {
    const spec = git('show', `${c}:${file}`)
    const at = spec?.search(tag) ?? -1
    if (spec && at >= 0 && scenarioHash(spec, at) === hash) {
      const title = spec.slice(spec.lastIndexOf('\n', at) + 1, at).replace(/^#{2,6}\s*Scenario:\s*/, '').trim()
      return [title, ...(scenarioSteps(spec, prefix)[id] ?? [])].join('\n')
    }
  }
  return undefined
}

/** The stories folder's other Markdown files (not story folders, MODEL.md, PERSONAS.md or TRACE.md): the words the
 * project shares, rendered. */
const vocabularyFiles = (root: string, storiesDir: string) => {
  const dir = join(root, storiesDir)
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter(f => /\.md$/i.test(f) && !['MODEL.md', 'PERSONAS.md', 'TRACE.md'].includes(f) && statSync(join(dir, f)).isFile())
    .sort().map(name => ({ name, html: markdownHtml(readFileSync(join(dir, name), 'utf8')) }))
}

const esc = (t: string) => t.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const inline = (t: string) => esc(t)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
  .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" rel="noreferrer">$1</a>')

/** Enough Markdown for a vocabulary file: headings, paragraphs, lists, tables, quotes and code blocks. HTML in the file
 * is shown as text. */
export const markdownHtml = (md: string) => {
  const out: string[] = []
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  for (let i = 0; i < lines.length;) {
    const line = lines[i]!
    if (!line.trim()) { i++; continue }
    if (/^```/.test(line)) {
      const body: string[] = []
      for (i++; i < lines.length && !/^```/.test(lines[i]!); i++) body.push(lines[i]!)
      i++
      out.push(`<pre><code>${esc(body.join('\n'))}</code></pre>`)
      continue
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) { out.push(`<h${h[1]!.length}>${inline(h[2]!)}</h${h[1]!.length}>`); i++; continue }
    if (/^\s*\|/.test(line)) {
      const rows: string[][] = []
      for (; i < lines.length && /^\s*\|/.test(lines[i]!); i++) rows.push(lines[i]!.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()))
      const [head, ...rest] = rows
      const body = rest.filter(r => !r.every(c => /^:?-+:?$/.test(c)))
      out.push(`<table><thead><tr>${head!.map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`)
      continue
    }
    const list = line.match(/^\s*([-*+]|\d+\.)\s+/)
    if (list) {
      const ordered = /\d/.test(list[1]!)
      const items: string[] = []
      for (; i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i]!); i++) items.push(lines[i]!.replace(/^\s*([-*+]|\d+\.)\s+/, ''))
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.map(x => `<li>${inline(x)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`)
      continue
    }
    if (/^>\s?/.test(line)) {
      const quote: string[] = []
      for (; i < lines.length && /^>\s?/.test(lines[i]!); i++) quote.push(lines[i]!.replace(/^>\s?/, ''))
      out.push(`<blockquote>${inline(quote.join(' '))}</blockquote>`)
      continue
    }
    const para: string[] = []
    for (; i < lines.length && lines[i]!.trim() && !/^(#{1,6}\s|```|\s*\||\s*([-*+]|\d+\.)\s|>)/.test(lines[i]!); i++) para.push(lines[i]!.trim())
    out.push(`<p>${inline(para.join(' '))}</p>`)
  }
  return out.join('\n')
}
