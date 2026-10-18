import { expect } from 'vitest'
import { story } from 'storyspec/vitest'
import { gridComponent, type GridView } from '../../packages/storyspec/src/ui/grid.js'
import { formatRoute, parseRoute, say } from '../../packages/storyspec/src/ui/route.js'
import { VOCABULARY } from '../../packages/storyspec/src/ui/vocabulary.js'
import { edit, pass, pythonProject, report, STORY } from '../../test/python-project.js'
import { another, gitRepo, pageOf, prove, scenario, served } from '../../test/ui-project.js'
import { gen } from './scenarios.gen.js'

const G = gridComponent(VOCABULARY, say)
const lines = async (root: string) => (await pageOf(root)).screens.stories.lines
/** Stories as the page's grid shows them for a route (S-023): each story line, whether it is open, and the scenarios
 * it shows. */
const fold = async (root: string, route: GridView) => {
  const page = await pageOf(root)
  const shown = G.view(page.definitions.find(d => d.id === 'stories')!, page.grids.stories, route).rows.filter(s => s.row.kind !== 'finding')
  return shown.map(s => ({
    line: page.screens.stories.lines.find(l => l.id === s.row.key)!, open: s.open,
    scenarios: !s.open ? [] : (s.kids?.scenarios ?? s.row.children!.scenarios!.map(row => ({ row }))).map(k => k.row.cells.scenario!),
  }))
}
/** Adds scenarios `from`..`to` to a story, each with a step and a THEN. */
const more = (root: string, dir: string, id: string, from: number, to: number, proof?: string) => {
  for (let n = from; n <= to; n++) scenario(root, dir, `${id}.${n}`, `Case ${n} of ${id}`, ['WHEN it happens', 'THEN it is greeted'], proof)
}
const three = () => {
  const root = pythonProject()
  another(root, 2, 'Greet a team')
  const s3 = another(root, 3, 'Greet a guild')
  scenario(root, s3, 'S-003.3', 'Greets the guild in French', ['WHEN the guild is French', 'THEN the greeting is in French'])
  return root
}

story(gen, {
  'S-020.1': async () => {
    const root = pythonProject()
    // 14 stories, 150 scenarios: S-001 with 20, the other 13 with 10 each.
    for (let n = 2; n <= 14; n++) { const dir = another(root, n, `Greet group ${n}`); more(root, dir, `S-${String(n).padStart(3, '0')}`, 3, 10) }
    more(root, STORY, 'S-001', 3, 20)
    const all = await lines(root)
    expect(all).toHaveLength(14)
    expect(all.reduce((n, l) => n + l.scenarios.length, 0)).toBe(150)
    const shown = await fold(root, parseRoute('#/greetings/model/stories'))
    expect(shown).toHaveLength(14)
    expect(shown.every(s => !s.open && s.scenarios.length === 0)).toBe(true)
    // The page lists Stories through the same grid, with the route as its view.
    const html = await (await served(root)).html()
    expect(html).toContain(`const gridComponent = ${gridComponent.toString()};`)
    expect(html).toContain('G.html(def, P().grids[def.id], state.route,')
  },

  'S-020.2': async () => {
    const root = pythonProject()
    // 10 proven by tests, 2 by a person, 2 not yet checked by anyone.
    more(root, STORY, 'S-001', 3, 10)
    more(root, STORY, 'S-001', 11, 14, 'manual')
    report(root, ...Array.from({ length: 10 }, (_, i) => pass(`test_S_001_${i + 1}_case`)))
    gitRepo(root)
    for (const id of ['S-001.11', 'S-001.12']) expect((await prove(root, id)).status).toBe(200)
    expect((await lines(root))[0]!.summary).toBe('10 by tests · 2 by a person · 2 need a look')
  },

  'S-020.3': async () => {
    const root = three()
    const shown = await fold(root, { open: ['S-002'], q: '' })
    expect(shown.map(s => [s.line.id, s.open, s.scenarios.length])).toEqual([['S-001', false, 0], ['S-002', true, 2], ['S-003', false, 0]])
    const opened = shown[1]!
    expect(opened.line.requirement).toBe('WHEN a person gives their name THE SYSTEM SHALL greet them by it.')
    expect(opened.line.scenarios.map(x => [x.title, x.state.word])).toEqual([['Greets by name', 'needs a look'], ['Greets a stranger without a name', 'needs a look']])
    expect(opened.scenarios).toEqual(['Greets by name', 'Greets a stranger without a name'])
  },

  'S-020.4': async () => {
    const root = three()
    const shown = await fold(root, { open: [], q: 'french' })
    expect(shown.map(s => [s.line.id, s.open, s.scenarios])).toEqual([['S-003', true, ['Greets the guild in French']]])
  },

  'S-020.5': async () => {
    const root = three()
    const hash = formatRoute({ project: 'greetings', screen: 'stories', open: ['S-002'] }, 'model')
    expect(hash).toBe('#/greetings/model/stories?open=S-002')
    // The files change and the page reads the project again; the URL still says what is open.
    edit(root, `${STORY}/spec.md`, s => s.replace('greet them by it', 'greet them by name'))
    const shown = await fold(root, parseRoute(hash))
    expect(shown.filter(s => s.open).map(s => s.line.id)).toEqual(['S-002'])
    // A change from the files reloads in place: the route is kept, not reset.
    const html = await (await served(root)).html()
    const onChange = html.slice(html.indexOf("stream.addEventListener('change'"), html.indexOf('async function load(quiet)'))
    expect(onChange).toContain('load(true)')
    expect(onChange).not.toContain('state.route =')
  },
})
