import { readFileSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect } from 'vitest'
import { story } from 'story-spec/vitest'
import { gridComponent, type GridView } from '../../packages/story-spec/src/ui/grid.js'
import { formatRoute, parseRoute, say } from '../../packages/story-spec/src/ui/route.js'
import type { GridRow } from '../../packages/story-spec/src/ui/screens.js'
import { VOCABULARY } from '../../packages/story-spec/src/ui/vocabulary.js'
import { edit, pass, pythonProject, report, STORY } from '../../test/python-project.js'
import { another, front, gitRepo, pageOf, personas, prove, scenario, served, status, withDecisions } from '../../test/ui-project.js'
import { gen } from './scenarios.gen.js'

const G = gridComponent(VOCABULARY, say)
const template = readFileSync(join(import.meta.dirname, '../../packages/story-spec/ui/index.html'), 'utf8')
type Page = Awaited<ReturnType<typeof pageOf>>
const def = (page: Page, id: string) => page.definitions.find(d => d.id === id)!
/** A screen drawn as the page draws it: its definition, its rows and a view. */
const draw = (page: Page, id: string, view: Partial<GridView> = {}, hidden: string[] = []) =>
  G.html(def(page, id), page.grids[id as keyof Page['grids']], { open: [], q: '', ...view }, hidden)
const shown = (page: Page, id: string, view: Partial<GridView> = {}) => G.view(def(page, id), page.grids[id as keyof Page['grids']], { open: [], q: '', ...view })
/** The rows of a drawn table, as the text of each of their cells (an opened row's expansion is left out). */
const cellsOf = (html: string) => [...html.matchAll(/<tr class="(?:open)?">(.*?)<\/tr>/g)].map(m => [...m[1]!.matchAll(/<td class="([^"]+)">(.*?)<\/td>/g)].map(c => [c[1]!, c[2]!.replace(/<[^>]+>/g, '').replace(/[▸▾]/g, '')]))

/** Each thing that waits on a person: an open decision, a draft, a stale proof, an unchecked manual scenario and a
 * file no story claims. */
const busy = async () => {
  const root = pythonProject()
  status(root, another(root, 2, 'Greet a team'), 'draft')
  scenario(root, STORY, 'S-001.3', 'The greeting is friendly', ['WHEN a person reads it', 'THEN it is friendly'], 'manual')
  scenario(root, STORY, 'S-001.4', 'The greeting is easy to read', ['WHEN a person reads it', 'THEN it is easy to read'], 'manual')
  withDecisions(root, STORY, 'Token lifetime (open)')
  writeFileSync(join(root, 'app/farewell.py'), 'def farewell(name):\n    return f"Goodbye, {name}"\n')
  gitRepo(root)
  expect((await prove(root, 'S-001.3')).status).toBe(200)
  edit(root, `${STORY}/spec.md`, s => s.replace('THEN it is friendly', 'THEN it is warm'))
  return root
}
/** Three stories; the third has a scenario about French. */
const three = () => {
  const root = pythonProject()
  another(root, 2, 'Greet a team')
  const s3 = another(root, 3, 'Greet a guild')
  scenario(root, s3, 'S-003.3', 'Greets the guild in French', ['WHEN the guild is French', 'THEN the greeting is in French'])
  return root
}
const rowsDeep = (rows: GridRow[]): GridRow[] => rows.flatMap(r => [r, ...rowsDeep(Object.values(r.children ?? {}).flat())])

story(gen, {
  'S-023.1': async () => {
    const page = await pageOf(await busy())
    expect(page.definitions.map(d => d.title)).toEqual(['Needs you', 'People', 'Stories', 'Decisions', 'Records', 'Words', 'Code', 'Ports', 'Layers', 'By tests', 'By a run', 'By a person', 'Stale'])
    for (const d of page.definitions) {
      // Its columns, its row source, its tabs and its expansion, besides who it is, and nothing else.
      expect(Object.keys(d).sort(), d.id).toEqual(['columns', 'expand', 'id', 'question', 'source', 'tabs', 'title'])
      expect(d.columns.length, d.id).toBeGreaterThan(0)
      expect(d.tabs[0], d.id).toMatchObject({ key: 'all', label: 'All', kinds: [] })
      expect(page.grids[d.id], d.id).toBeDefined()
    }
    // The screens are the navigation's, one definition each.
    expect(page.definitions.map(d => d.id)).toEqual(['needs-you', ...page.nav.groups.flatMap(g => g.screens.map(s => s.key))])
    // The page's router draws every screen from them.
    const html = await (await served(await busy())).html()
    expect(html).toContain('Object.fromEntries(P().definitions.map((def) => [def.id, () => screenHtml(def)]))')
  },

  'S-023.2': async () => {
    // The page's own markup has no list of any kind: no table, row, list item or item card.
    const script = template.slice(template.indexOf('<script>'))
    for (const tag of ['<table', '<tr', '<td', '<th', '<ul', '<ol', '<li', 'class="list"', 'class="item', 'class="row"']) expect(script, tag).not.toContain(tag)
    // No screen has a function of its own: the router draws each from its definition, with the grid.
    expect(script).not.toMatch(/SCREEN = \{/)
    expect(script.match(/G\.html\(/g)).toHaveLength(1)
    // Every row of every screen is in the grid it draws.
    const page = await pageOf(await busy())
    for (const d of page.definitions) {
      const rows = page.grids[d.id].rows
      expect(cellsOf(draw(page, d.id)), d.id).toHaveLength(rows.length)
    }
  },

  'S-023.3': async () => {
    const page = await pageOf(three())
    // On Stories, a word in a scenario's title keeps its story, opened at the match.
    const r = shown(page, 'stories', { q: 'french' })
    expect(r.rows.map(s => [s.row.key, s.open, s.kids!.scenarios!.map(k => k.row.cells.scenario)])).toEqual([['S-003', true, ['Greets the guild in French']]])
    // The count updates.
    expect(r.count).toBe(1)
    expect(draw(page, 'stories', { q: 'french' })).toContain(`<span class="count">1 of ${page.grids.stories.rows.length}</span>`)
    // The same on every screen: each row that stays has the word in a column, or children that do.
    const rich = await pageOf(await busy())
    let tried = 0
    for (const d of rich.definitions) {
      const first = rich.grids[d.id].rows[0]
      if (!first) continue
      const word = String(Object.values(first.cells).find(Boolean)).split(/\s+/)[0]!.toLowerCase()
      const kept = shown(rich, d.id, { q: word }).rows
      expect(kept.length, d.id).toBeGreaterThan(0)
      for (const s of kept) expect(Object.values(s.row.cells).some(c => String(c).toLowerCase().includes(word)) || !!s.kids, `${d.id}: ${word}`).toBe(true)
      expect(draw(rich, d.id, { q: word }), d.id).toContain('<input id="q"')
      tried++
    }
    expect(tried).toBeGreaterThan(8)
  },

  'S-023.4': async () => {
    const root = three()
    // The three stories last changed on different days, newest first.
    const days = { 'stories/S-001-greet-a-person': '2026-10-03', 'stories/S-002-greet-a-team': '2026-10-01', 'stories/S-003-greet-a-guild': '2026-10-02' }
    for (const [dir, day] of Object.entries(days)) for (const f of ['story.md', 'spec.md']) utimesSync(join(root, dir, f), new Date(`${day}T12:00:00Z`), new Date(`${day}T12:00:00Z`))
    const page = await pageOf(root)
    expect(def(page, 'stories').columns.map(c => c.key)).toEqual(expect.arrayContaining(['state', 'since']))
    const order = (sort: string) => shown(page, 'stories', { sort }).rows.filter(s => s.row.kind !== 'finding').map(s => [s.row.key, s.row.cells.since])
    // Clicked once, ascending; clicked again, descending.
    expect(order('since')).toEqual([['S-002', '2026-10-01'], ['S-003', '2026-10-02'], ['S-001', '2026-10-03']])
    expect(order('-since')).toEqual([['S-001', '2026-10-03'], ['S-003', '2026-10-02'], ['S-002', '2026-10-01']])
    expect(draw(page, 'stories', { sort: '-since' })).toContain('<th class="c-since" aria-sort="descending"><button data-sort="since">Since<span class="arrow">↓</span>')
    const html = await (await served(root)).html()
    expect(html).toContain('if (d.sort) { go({ sort: state.route.sort === d.sort ? `-${d.sort}` : d.sort }, true); return; }')
    // The sort is kept in the URL hash.
    const hash = formatRoute({ project: 'greetings', screen: 'stories', open: [], q: '', sort: '-since' }, 'model')
    expect(hash).toBe('#/greetings/model/stories?sort=-since')
    expect(parseRoute(hash).sort).toBe('-since')
  },

  'S-023.5': async () => {
    const root = pythonProject()
    status(root, another(root, 2, 'Greet a team'), 'draft')
    for (const n of [3, 4, 5]) scenario(root, STORY, `S-001.${n}`, `Greets case ${n} by hand`, ['WHEN a person reads it', 'THEN it reads well'], 'manual')
    withDecisions(root, STORY, 'Token lifetime (open)', 'Greeting punctuation (open)')
    writeFileSync(join(root, 'app/farewell.py'), 'def farewell(name):\n    return f"Goodbye, {name}"\n')
    const page = await pageOf(root)
    const r = shown(page, 'needs-you')
    expect(r.tabs.map(x => `${x.label} ${x.count}`)).toEqual(['All 7', 'Decide 2', 'Approve 1', 'Check 3', 'Claim 1'])
    // Picking one shows only that kind.
    const kinds = (tab: string) => [...new Set(shown(page, 'needs-you', { tab }).rows.map(s => s.row.kind))]
    expect(kinds('decide')).toEqual(['decide'])
    expect(kinds('approve')).toEqual(['approve'])
    expect(kinds('check')).toEqual(['check'])
    expect(kinds('claim')).toEqual(['claim'])
    expect(cellsOf(draw(page, 'needs-you', { tab: 'check' })).map(c => c[0]![1])).toEqual(['Check', 'Check', 'Check'])
    // A tab of nothing is shown, disabled.
    edit(root, `${STORY}/spec.md`, s => s.replace(/- Token lifetime \(open\)\n- Greeting punctuation \(open\)\n/, ''))
    expect(draw(await pageOf(root), 'needs-you')).toContain('<button class="tab" data-tab="decide" aria-pressed="false" disabled>Decide <span class="n">0</span></button>')
  },

  'S-023.6': async () => {
    const page = await pageOf(await busy())
    expect(def(page, 'needs-you')).toMatchObject({ source: ['decide', 'approve', 'check-again', 'check', 'claim'] })
    expect(def(page, 'needs-you').columns.map(c => c.label)).toEqual(['Kind', 'What', 'Who', 'Since', 'Action'])
    const rows = cellsOf(draw(page, 'needs-you'))
    expect(rows).toHaveLength(5)
    // The same columns on every row.
    for (const r of rows) expect(r.map(c => c[0])).toEqual(['c-first', 'c-what', 'c-who', 'c-since', 'c-action'])
    expect(rows.map(r => [r[0]![1], r[4]![1]])).toEqual([['Decide', 'Answer'], ['Approve', 'Approve'], ['Check again', 'Check again'], ['Check', 'Check'], ['Claim', 'Claim']])
    for (const r of rows.slice(0, 4)) expect(r[3]![1]).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  },

  'S-023.7': async () => {
    const page = await pageOf(three())
    const closed = cellsOf(draw(page, 'stories')).map(r => r[0]![1])
    const html = draw(page, 'stories', { open: ['S-002'] })
    // The other rows keep their places; the opened one shows beneath itself.
    expect(cellsOf(html.replace(/<tr class="exp">.*?<\/table><\/section>/, '')).map(r => r[0]![1])).toEqual(closed)
    const opened = html.slice(html.indexOf('aria-label="Greet a team"'))
    const exp = opened.slice(opened.indexOf('<tr class="exp">'))
    expect(exp.indexOf('<tr class="exp">')).toBe(0)
    // Its requirement, then its scenarios as a nested grid: the same component, a level deeper.
    expect(exp).toContain('<div class="req"><b>WHEN</b> a person gives their name <br><b>THE SYSTEM SHALL</b> greet them by it.</div>')
    expect(exp).toContain('<h3>Scenarios <span class="n">2</span></h3>')
    expect(exp).toContain('<table class="grid" data-depth="1">')
    expect(exp.indexOf('<div class="req">')).toBeLessThan(exp.indexOf('<h3>Scenarios'))
    // The expansion is kept in the URL hash.
    expect(formatRoute({ project: 'greetings', screen: 'stories', open: ['S-002'] }, 'model')).toBe('#/greetings/model/stories?open=S-002')
  },

  'S-023.8': async () => {
    const root = pythonProject()
    personas(root, ['Player', 'Plays the game alone.'], ['Friend', 'Plays along now and then.'])
    // 13 stories for the player: 11 whose tests pass, 2 whose tests haven't run, and one open decision.
    front(root, STORY, 'persona: player')
    for (let n = 2; n <= 13; n++) front(root, another(root, n, `Play level ${n}`), 'persona: player')
    report(root, ...Array.from({ length: 11 }, (_, i) => [1, 2].map(k => pass(`test_S_${String(i + 1).padStart(3, '0')}_${k}_plays`))).flat())
    withDecisions(root, 'stories/S-012-play-level-12', 'The target frame rate (open: player)')
    const page = await pageOf(root)
    const player = page.grids.people.rows.find(r => r.key === 'player')!
    expect(player.cells.summary).toBe('11 can do today · 2 being built · 1 waiting')
    expect(cellsOf(draw(page, 'people'))[0]!.map(c => c[1])).toEqual(['Player', '11 can do today · 2 being built · 1 waiting', 'Start a story'])
    const html = draw(page, 'people', { open: ['player'] })
    const titles = [...html.matchAll(/<section class="sub"><div class="sub-head"><h3>([^<]+) <span class="n">(\d+)<\/span>/g)].map(m => [m[1], Number(m[2])])
    expect(titles).toEqual([['Waiting on them', 1], ['Can do today', 11], ['Being built', 2], ['Planned', 0]])
  },

  'S-023.9': async () => {
    const page = await pageOf(three())
    const row = page.grids.stories.rows.find(r => r.key === 'S-002')!
    expect(row.state!.word).toBe('being built')
    const sentence = row.state!.why.sentence
    expect(sentence).toBe('0 of 2 scenarios are checked. Still to go:')
    // On hover: the state cell names the why before anything opens.
    expect(draw(page, 'stories')).toContain(`<button class="state being-built" data-fold="S-002" aria-expanded="false" title="${sentence}">being built</button>`)
    // Opened (the state cell opens its row): the why, with what is still to go and what would change it.
    const open = draw(page, 'stories', { open: ['S-002'] })
    expect(open).toContain(`<div class="why"><p>${sentence}</p><table class="grid" data-depth="1">`)
    expect(open).toContain('Greets a stranger without a name')
  },

  'S-023.10': async () => {
    const root = await busy()
    personas(root, ['Player', 'Plays the game.'])
    front(root, STORY, 'persona: player')
    const page = await pageOf(root)
    const verbs = new Set<string>([...Object.values(VOCABULARY.actions), ...Object.values(VOCABULARY.findings).map(f => f.action)])
    let cells = 0
    for (const d of page.definitions) {
      // Every row open, so nested grids' rows are read too.
      const html = draw(page, d.id, { open: page.grids[d.id].rows.map(r => r.key) })
      for (const [, cell] of html.matchAll(/<td class="c-action">(.*?)<\/td>/g)) {
        cells++
        expect((cell!.match(/<button/g) ?? []).length, d.id).toBeLessThanOrEqual(1)
        const label = cell!.replace(/<[^>]+>/g, '')
        if (label) expect(verbs.has(label), `${d.id}: ${label}`).toBe(true)
      }
      for (const r of rowsDeep(page.grids[d.id].rows)) if (r.action) expect(verbs.has(r.action.label), r.action.label).toBe(true)
    }
    expect(cells).toBeGreaterThan(10)
    // People's primary action is in its header only.
    const people = draw(page, 'people', { open: ['player'] })
    const head = people.slice(0, people.indexOf('<div class="tools">'))
    expect(head).toContain('data-op="add-persona"')
    expect(people.slice(head.length)).not.toContain('add-persona')
  },

  'S-023.11': async () => {
    const root = pythonProject()
    personas(root, ['Player', 'Plays the game.'], ['Friend', 'Plays along.'])
    front(root, STORY, 'persona: player')
    const page = await pageOf(root)
    const friend = cellsOf(draw(page, 'people')).find(r => r[0]![1] === 'Friend')!
    expect(friend.map(c => c[1])).toEqual(['Friend', 'no stories yet', 'Start a story'])
    // Needs you, with nothing in it, says so.
    expect(page.grids['needs-you'].rows).toEqual([])
    expect(draw(page, 'needs-you')).toContain('<div class="empty">Nothing is waiting on you.</div>')
  },

  'S-023.12': async () => {
    // The cards are one row that never wraps, drawn between the home's heading and its grid.
    expect(template).toMatch(/\.home \{ display: flex; flex-wrap: nowrap;/)
    const html = await (await served(pythonProject())).html()
    expect(html).toContain("lead: def.id === 'needs-you' ? homeHtml() : ''")
    const page = await pageOf(await busy())
    const drawn = G.html(def(page, 'needs-you'), page.grids['needs-you'], { open: [], q: '' }, [], { lead: '<div class="home"></div>' })
    expect(drawn.indexOf('<h1>Needs you</h1>')).toBeLessThan(drawn.indexOf('<div class="home">'))
    expect(drawn.indexOf('<div class="home">')).toBeLessThan(drawn.indexOf('<table'))
    // Each row is one line, so the first rows sit under the cards.
    expect(template).toMatch(/table\.grid td \{[^}]*white-space: nowrap;/)
    // Only Needs you has the cards.
    expect(G.html(def(page, 'stories'), page.grids.stories, { open: [], q: '' })).not.toContain('class="home"')
  },

  'S-023.13': async () => {
    const saved = new Map<string, string>()
    const store = { getItem: (k: string) => saved.get(k) ?? null, setItem: (k: string, v: string) => { saved.set(k, v) } }
    expect(G.columns.toggle(store, 'stories', 'since')).toEqual(['since'])
    // Later, in the same browser: since is still hidden on Stories, and not on other screens.
    const later = gridComponent(VOCABULARY, say)
    expect(later.columns.hidden(store, 'stories')).toEqual(['since'])
    expect(later.columns.hidden(store, 'by-tests')).toEqual([])
    const page = await pageOf(three())
    expect(draw(page, 'stories', {}, later.columns.hidden(store, 'stories'))).not.toContain('class="c-since"')
    expect(draw(page, 'by-tests', {}, later.columns.hidden(store, 'by-tests'))).toContain('class="c-since"')
    // The page keeps the choice in the browser's local storage, per screen.
    const html = await (await served(pythonProject())).html()
    expect(html).toContain('let store = null; try { store = localStorage; } catch {}')
    expect(html).toContain('G.columns.hidden(store, def.id)')
    expect(html).toContain('G.columns.toggle(store, state.route.screen, e.target.dataset.col)')
  },

  'S-023.14': async () => {
    const root = await busy()
    const route = { project: 'greetings', screen: 'needs-you', open: ['S-002'], q: '', tab: 'approve', sort: '-since' }
    const hash = formatRoute(route)
    expect(hash).toBe('#/greetings/needs-you?open=S-002&tab=approve&sort=-since')
    const before = shown(await pageOf(root), 'needs-you', parseRoute(hash))
    // The files change, and the page reads them again with the URL as it was.
    edit(root, `${STORY}/spec.md`, s => s.replace('greet them by it', 'greet them by their name'))
    const after = shown(await pageOf(root), 'needs-you', parseRoute(hash))
    expect(parseRoute(hash)).toEqual(route)
    expect([after.tab, after.sort, after.rows.map(s => [s.row.key, s.open])]).toEqual([before.tab, before.sort, before.rows.map(s => [s.row.key, s.open])])
    expect(after.rows.map(s => [s.row.key, s.open])).toEqual([['S-002', true]])
    // A change from the files reloads in place: the route is not reset.
    const html = await (await served(root)).html()
    const onChange = html.slice(html.indexOf("stream.addEventListener('change'"), html.indexOf('async function load(quiet)'))
    expect(onChange).toContain('load(true)')
    expect(onChange).not.toContain('state.route =')
  },

  'S-023.15': {},
})
