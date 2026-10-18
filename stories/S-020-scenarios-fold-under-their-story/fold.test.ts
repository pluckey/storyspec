import { expect } from 'vitest'
import { story } from 'storyspec/vitest'
import { foldStories, formatRoute, parseRoute } from '../../packages/storyspec/src/ui/route.js'
import { edit, pass, pythonProject, report, STORY } from '../../test/python-project.js'
import { another, gitRepo, pageOf, prove, scenario, served } from '../../test/ui-project.js'
import { gen } from './scenarios.gen.js'

const lines = async (root: string) => (await pageOf(root)).screens.stories.lines
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
    const shown = foldStories(all, parseRoute('#/greetings/model/stories'))
    expect(shown).toHaveLength(14)
    expect(shown.every(s => !s.open && s.scenarios.length === 0)).toBe(true)
    // The page lists Stories through the same fold.
    expect(await (await served(root)).html()).toContain('foldStories(P().screens.stories.lines, state.route)')
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
    const shown = foldStories(await lines(root), { open: ['S-002'], q: '' })
    expect(shown.map(s => [s.line.id, s.open, s.scenarios.length])).toEqual([['S-001', false, 0], ['S-002', true, 2], ['S-003', false, 0]])
    const opened = shown[1]!
    expect(opened.line.requirement).toBe('WHEN a person gives their name THE SYSTEM SHALL greet them by it.')
    expect(opened.scenarios.map(x => [x.title, x.state.word])).toEqual([['Greets by name', 'needs a look'], ['Greets a stranger without a name', 'needs a look']])
  },

  'S-020.4': async () => {
    const root = three()
    const shown = foldStories(await lines(root), { open: [], q: 'french' })
    expect(shown.map(s => [s.line.id, s.open, s.scenarios.map(x => x.title)])).toEqual([['S-003', true, ['Greets the guild in French']]])
  },

  'S-020.5': async () => {
    const root = three()
    const hash = formatRoute({ project: 'greetings', screen: 'stories', open: ['S-002'] }, 'model')
    expect(hash).toBe('#/greetings/model/stories?open=S-002')
    // The files change and the page reads the project again; the URL still says what is open.
    edit(root, `${STORY}/spec.md`, s => s.replace('greet them by it', 'greet them by name'))
    const shown = foldStories(await lines(root), parseRoute(hash))
    expect(shown.filter(s => s.open).map(s => s.line.id)).toEqual(['S-002'])
    // A change from the files reloads in place: the route is kept, not reset.
    const html = await (await served(root)).html()
    const onChange = html.slice(html.indexOf("stream.addEventListener('change'"), html.indexOf('async function load(quiet)'))
    expect(onChange).toContain('load(true)')
    expect(onChange).not.toContain('state.route =')
  },
})
