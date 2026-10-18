// Every screen of storyspec ui is a definition: its columns, its row source, its tabs (named filters, counted) and what
// a row expands to. The page has one router and one grid (grid.ts), and draws each screen from its definition with the
// rows below; a screen with markup of its own would be a layer violation of the ui. Each word is the vocabulary's, so
// the definitions are built from it. What each screen contains is S-016 to S-022's; this module is only how it is drawn.
import { say } from './route.js'
import type { Action, DecisionItem, Model, RecordView, ScenarioItem, State, StoryLine } from './view.js'
import type { ScreenKey, StateKey, Vocabulary } from './vocabulary.js'

export type ScreenId = 'needs-you' | ScreenKey
export type ColumnKey = keyof Vocabulary['columns']
/** A column, by the key a row's cells use. The first is the row's title; `action` holds at most one button. */
export type Column = { key: ColumnKey; label: string; sort: boolean }
/** A named filter: the rows of these kinds, or every row when `kinds` is empty. */
export type Tab = { key: string; label: string; kinds: string[] }
/** What an opened row shows, in order: its sentence, its state's why, its requirement, its steps, a vocabulary file, a
 * record's lifecycle, or a nested grid of its children from `source`, drawn by the same grid with the row as scope. */
export type Part =
  | { part: 'text' } | { part: 'why' } | { part: 'requirement'; label: string } | { part: 'steps' } | { part: 'prose' } | { part: 'lifecycle' }
  | { part: 'grid'; source: string; title: string; columns: Column[]; expand: Part[]; action?: Action }
export type ScreenDefinition = { id: ScreenId; title: string; question: string; columns: Column[]; source: string | string[]; tabs: Tab[]; expand: Part[] }

/** One row of any grid. `cells` are the text search and sort read, by column; `kind` is what tabs match. */
export type GridRow = {
  key: string; kind: string; cells: Partial<Record<ColumnKey, string>>
  state?: State; action?: Action; details?: string
  text?: string; requirement?: string; steps?: string[]; edit?: string; html?: string; record?: RecordView
  children?: Record<string, GridRow[]>
  /** What a nested grid with no rows says, by source. */
  empty?: Record<string, string>
}
/** A screen's rows, what it says with none, its primary action (shown in its header only) and a note under it. */
export type Grid = { rows: GridRow[]; empty: string; action?: Action; note?: string }

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1)

/** The thirteen screens, in the navigation's order: Needs you, then Model, Implementation and Proof. */
export const screenDefinitions = (words: Vocabulary): ScreenDefinition[] => {
  const col = (key: ColumnKey): Column => ({ key, label: words.columns[key], sort: key !== 'action' })
  const cols = (...keys: ColumnKey[]) => keys.map(col)
  const tab = (key: string, label: string, kinds: string[] = [key]): Tab => ({ key, label, kinds })
  const all = tab('all', words.grid.all, [])
  const toFix = tab('to-fix', words.grid.toFix, ['finding'])
  const stateTab = (k: StateKey) => tab(k, cap(words.states[k].word))
  const named = (k: keyof Vocabulary['screens']) => ({ title: words.screens[k].heading, question: words.screens[k].intro })
  const grid = (source: string, title: string, columns: Column[], expand: Part[], action?: Action): Part => ({ part: 'grid', source, title, columns, expand, ...(action && { action }) })
  const scenarioExpand: Part[] = [{ part: 'why' }, { part: 'steps' }]
  const storyExpand: Part[] = [
    { part: 'why' }, { part: 'requirement', label: words.page.requirement },
    grid('scenarios', words.page.scenarios, cols('scenario', 'state', 'action'), scenarioExpand, { label: words.actions['add-scenario'], op: 'add-scenario' }),
  ]
  const storyGrid = (k: StateKey) => grid(k, cap(words.states[k].word), cols('story', 'state', 'summary', 'action'), storyExpand)
  const scenarioTabs = [all, stateTab('checked'), stateTab('needs-a-look'), stateTab('failed-a-check'), stateTab('waiting-on-you'), toFix]
  return [
    {
      id: 'needs-you', ...named('inbox'), columns: cols('kind', 'what', 'who', 'since', 'action'), source: ['decide', 'approve', 'check-again', 'check', 'claim'],
      tabs: [all, tab('decide', words.actions.decide), tab('approve', words.actions.approve), tab('check', words.actions.check, ['check-again', 'check']), tab('claim', words.actions.claim)],
      expand: [{ part: 'text' }, { part: 'why' }],
    },
    {
      id: 'people', ...named('people'), columns: cols('persona', 'summary', 'action'), source: 'personas',
      tabs: [all, tab('waiting', words.decisions.waiting), toFix],
      expand: [{ part: 'text' }, grid('waiting', words.people.waitingOnThem, cols('decision', 'story', 'action'), [{ part: 'text' }]), storyGrid('can-do-today'), storyGrid('being-built'), storyGrid('planned')],
    },
    {
      id: 'stories', ...named('stories'), columns: cols('story', 'persona', 'state', 'summary', 'since', 'action'), source: 'stories',
      tabs: [all, stateTab('can-do-today'), stateTab('being-built'), stateTab('planned'), toFix], expand: storyExpand,
    },
    {
      id: 'decisions', ...named('decisions'), columns: cols('decision', 'story', 'who', 'kind', 'since', 'action'), source: 'decisions',
      tabs: [all, tab('open', words.decisions.waiting), tab('answered', words.decisions.answered), toFix], expand: [{ part: 'text' }],
    },
    {
      id: 'records', ...named('records'), columns: cols('record', 'states'), source: 'records', tabs: [all, toFix],
      expand: [{ part: 'text' }, { part: 'lifecycle' }, grid('states', words.columns.states, cols('recordState', 'event', 'enteredBy', 'starts', 'next'), [])],
    },
    { id: 'words', ...named('words'), columns: cols('file'), source: 'vocabulary files', tabs: [all], expand: [{ part: 'prose' }] },
    {
      id: 'code', ...named('code'), columns: cols('what', 'files', 'action'), source: 'code', tabs: [all, tab('claim', words.actions.claim, ['unclaimed']), toFix],
      expand: [{ part: 'text' }, grid('files', words.columns.files, cols('file'), [])],
    },
    {
      id: 'ports', ...named('ports'), columns: cols('port', 'adapters', 'tests'), source: 'ports', tabs: [all, toFix],
      expand: [grid('adapters', words.columns.adapters, cols('file', 'exercised'), [])],
    },
    { id: 'layers', ...named('layers'), columns: cols('layer', 'may'), source: 'layer rules', tabs: [all, toFix], expand: [] },
    { id: 'by-tests', ...named('by-tests'), columns: cols('scenario', 'story', 'state', 'since', 'action'), source: 'scenarios a test proves', tabs: scenarioTabs, expand: scenarioExpand },
    { id: 'by-a-run', ...named('by-a-run'), columns: cols('scenario', 'story', 'state', 'since', 'action'), source: 'scenarios a run proves', tabs: scenarioTabs, expand: scenarioExpand },
    {
      id: 'by-a-person', ...named('by-a-person'), columns: cols('scenario', 'story', 'who', 'since', 'state', 'action'), source: 'scenarios a person checks',
      tabs: [all, tab('pending', words.screens['by-a-person'].pending), tab('done', words.screens['by-a-person'].done), toFix], expand: scenarioExpand,
    },
    { id: 'stale', ...named('stale'), columns: cols('scenario', 'story', 'who', 'since', 'state', 'action'), source: 'stale proofs', tabs: [all, toFix], expand: scenarioExpand },
  ]
}

/** Each screen's rows, from the model view.ts builds. A screen's findings are rows of kind `finding` at its foot. */
export const gridsOf = (page: Model, words: Vocabulary): Record<ScreenId, Grid> => {
  const t = (template: string, vars: Record<string, unknown> = {}) => say(template, vars, words.nouns)
  const s = page.screens
  /** An action the action column shows as a button: only one the page can do. */
  const button = (a?: Action) => a?.op ? a : undefined
  // A screen's primary action is in its header only, so a finding that asks for it says so instead of repeating it.
  const primary = { people: s.people.action.op } as Partial<Record<ScreenId, string>>
  const findings = (screen: Exclude<ScreenId, 'needs-you' | 'words'>, first: ColumnKey): GridRow[] =>
    s[screen].findings.map((f, i) => ({
      key: `finding:${i}:${f.details}`, kind: 'finding', cells: { [first]: f.sentence }, details: f.details,
      action: f.action.op && f.action.op === primary[screen] ? { label: f.action.label } : f.action,
    }))
  const scenarioRow = (x: ScenarioItem, extra: Partial<GridRow> = {}): GridRow => ({
    key: x.id, kind: x.state.key, cells: { scenario: x.title, story: x.story, state: x.state.word, since: x.since },
    state: x.state, action: button(x.state.why.action), steps: x.steps, details: x.details, ...extra,
  })
  const storyRow = (l: StoryLine): GridRow => ({
    key: l.id, kind: l.state.key, cells: { story: l.title, persona: l.personas.join(', '), state: l.state.word, summary: l.summary, since: l.since },
    state: l.state, action: button(l.state.why.action), requirement: l.requirement, details: l.details,
    children: { scenarios: l.scenarios.map(x => scenarioRow(x, { edit: x.id })) },
  })
  const decisionRow = (d: DecisionItem): GridRow => ({
    key: d.key, kind: d.open ? 'open' : 'answered',
    cells: { decision: d.title, story: d.story, who: d.who, kind: d.open ? words.decisions.waiting : words.decisions.answered, since: d.since },
    action: d.open ? d.action : undefined, text: d.sentence, details: d.details,
  })
  const lines = new Map(s.stories.lines.map(l => [l.id, l]))
  const byState = (ids: string[], k: StateKey) => ids.map(id => lines.get(id)).filter((l): l is StoryLine => l?.state.key === k).map(storyRow)

  const people: GridRow[] = [
    ...s.people.personas.map(p => {
      const parts = [p.counts.done && `${p.counts.done} ${words.states['can-do-today'].word}`, p.counts.building && `${p.counts.building} ${words.states['being-built'].word}`,
        p.counts.planned && `${p.counts.planned} ${words.states.planned.word}`, p.waiting.length && t(words.people.waiting, { n: p.waiting.length })].filter(Boolean)
      return {
        key: p.key, kind: p.waiting.length ? 'waiting' : 'persona',
        cells: { persona: p.name, summary: p.stories.length ? parts.join(words.summary.join) : words.people.noStories },
        action: { label: words.actions['start-story'], op: 'start-story' as const, target: p.key }, text: p.prose,
        children: { waiting: p.waiting.map(decisionRow), ...Object.fromEntries((['can-do-today', 'being-built', 'planned'] as const).map(k => [k, byState(p.stories, k)])) },
        empty: { waiting: t(words.decisions.noneWaiting, { key: p.key }) },
      }
    }),
    ...(s.people.unassigned.length ? [{
      key: 'unassigned', kind: 'waiting', cells: { persona: words.decisions.unassigned, summary: t(words.people.waiting, { n: s.people.unassigned.length }) },
      text: words.decisions.unassignedIntro, children: { waiting: s.people.unassigned.map(decisionRow) },
    }] : []),
    ...findings('people', 'persona'),
  ]

  const inbox: GridRow[] = page.inbox.items.map(i => ({
    key: i.action.target ?? `${i.kind}:${i.title}`, kind: i.kind, cells: { kind: words.actions[i.kind], what: i.title, who: i.who, since: i.since },
    action: i.action, text: i.sentence, ...(i.state && { state: i.state }), details: i.details,
  }))

  const code: GridRow[] = [
    ...s.code.claims.map(c => ({ key: c.title, kind: 'unclaimed', cells: { what: c.title }, action: c.action, text: c.sentence, details: c.details })),
    ...s.code.stories.map(x => ({
      key: `code:${x.id}`, kind: 'claimed', cells: { what: x.title, files: x.files.join(', ') }, details: x.details,
      children: { files: x.files.map(f => ({ key: f, kind: 'file', cells: { file: f } })) },
    })),
    ...findings('code', 'what'),
  ]

  const ports: GridRow[] = [
    ...s.ports.ports.map(p => ({
      key: `port:${p.name}`, kind: 'port', details: p.file,
      cells: { port: p.name, adapters: p.adapters.map(a => a.file).join(', ') || s.ports.noAdapter, tests: p.tests.join(', ') || s.ports.noTests },
      children: { adapters: p.adapters.map(a => ({ key: a.file, kind: 'adapter', cells: { file: a.file, exercised: a.tiers.join(', ') } })) },
    })),
    ...findings('ports', 'port'),
  ]

  const layers: GridRow[] = [
    ...s.layers.rules.map(r => ({ key: `layer:${r.layer}`, kind: 'layer', cells: { layer: r.layer, may: r.may.join(', ') } })),
    ...(s.layers.wiringFiles.length ? [{ key: 'wiring', kind: 'wiring', cells: { layer: s.layers.wiring, may: s.layers.wiringFiles.join(', ') } }] : []),
    ...findings('layers', 'layer'),
  ]

  const records: GridRow[] = [
    ...s.records.records.map(r => ({
      key: `record:${r.name}`, kind: 'record', cells: { record: r.name, states: r.states.map(x => x.name).join(', ') }, text: words.records.arrows, record: r,
      children: {
        states: r.states.map(x => ({
          key: x.name, kind: 'state', cells: {
            recordState: x.start ? `${x.name} (${words.records.start})` : x.name, event: x.event,
            enteredBy: [...new Set([...x.movedBy, ...(x.start ? x.createdBy : [])])].join(', ') || (x.start ? '—' : `✗ ${words.records.noStory}`),
            starts: x.starts.join(', ') || (x.next.length ? '—' : words.records.nothing), next: x.next.join(', ') || '—',
          },
        })),
      },
    })),
    ...findings('records', 'record'),
  ]

  const scenarios = (screen: 'by-tests' | 'by-a-run' | 'stale', items: ScenarioItem[], who = false) => [
    ...items.map(x => scenarioRow(x, who && x.entry ? { cells: { scenario: x.title, story: x.story, state: x.state.word, since: x.since, who: x.entry.by } } : {})),
    ...findings(screen, 'scenario'),
  ]
  const person = s['by-a-person']
  const checked = (x: ScenarioItem, kind: string): GridRow => ({
    ...scenarioRow(x), kind, cells: { scenario: x.title, story: x.story, state: x.state.word, since: x.since, ...(x.entry && { who: x.entry.by }) },
    ...(x.entry?.note && { text: t(words.why.note, { note: x.entry.note }) }),
  })

  const grid = (rows: GridRow[], empty: string | undefined, fallback: string, extra: Partial<Grid> = {}): Grid => ({ rows, empty: empty ?? fallback, ...extra })
  return {
    'needs-you': grid(inbox, page.inbox.empty, words.grid.none),
    people: grid(people, s.people.empty, words.grid.none, { action: s.people.action }),
    stories: grid([...s.stories.lines.map(storyRow), ...findings('stories', 'story')], s.stories.empty, words.grid.none, s.stories.retired ? { note: s.stories.retired } : {}),
    decisions: grid([...s.decisions.items.map(decisionRow), ...findings('decisions', 'decision')], s.decisions.empty, words.grid.none),
    records: grid(records, s.records.empty, words.grid.none),
    words: grid(s.words.files.map(f => ({ key: `words:${f.name}`, kind: 'file', cells: { file: f.name }, html: f.html })), s.words.empty, words.grid.none),
    code: grid(code, s.code.empty, words.grid.none),
    ports: grid(ports, s.ports.empty, words.grid.none),
    layers: grid(layers, s.layers.empty, words.grid.none),
    'by-tests': grid(scenarios('by-tests', s['by-tests'].items), s['by-tests'].empty, words.grid.none),
    'by-a-run': grid(scenarios('by-a-run', s['by-a-run'].items), s['by-a-run'].empty, words.grid.none),
    'by-a-person': grid([...person.pendingItems.map(x => checked(x, 'pending')), ...person.doneItems.map(x => checked(x, 'done')), ...findings('by-a-person', 'scenario')], person.empty, words.grid.none),
    stale: grid(scenarios('stale', s.stale.items, true), s.stale.empty, words.grid.none),
  }
}
