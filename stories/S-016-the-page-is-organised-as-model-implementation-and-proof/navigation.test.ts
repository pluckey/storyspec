import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { expect } from 'vitest'
import { story } from 'storyspec/vitest'
import { formatRoute, parseRoute } from '../../packages/storyspec/src/ui/route.js'
import { edit, pythonProject, STORY } from '../../test/python-project.js'
import { gitRepo, pageOf, personas, prove, scenario, served } from '../../test/ui-project.js'
import { gen } from './scenarios.gen.js'

const files = (root: string, all: Record<string, string>) => {
  for (const [path, text] of Object.entries(all)) { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text) }
}
const nav = async (root: string) => (await pageOf(root)).nav
/** The header of the page as served: what the top of the page holds. */
const header = (html: string) => html.slice(html.indexOf('<header class="top">'), html.indexOf('</header>'))

story(gen, {
  'S-016.1': async () => {
    const page = await pageOf(pythonProject())
    expect(page.nav.inbox.label).toBe('Needs you')
    expect(page.nav.groups.map(g => [g.label, g.screens.map(s => s.label)])).toEqual([
      ['Model', ['People', 'Stories', 'Decisions', 'Records', 'Words']],
      ['Implementation', ['Code', 'Ports', 'Layers']],
      ['Proof', ['By tests', 'By a run', 'By a person', 'Stale']],
    ])
    const keys = page.nav.groups.flatMap(g => g.screens.map(s => s.key))
    expect(new Set(keys).size).toBe(keys.length)
    // Every screen in the navigation has its content, and nothing else does.
    expect(Object.keys(page.screens).sort()).toEqual([...keys].sort())
    // Each of today's tabs lives under exactly one of the three: scenarios under their story (S-020) and in Proof by
    // tier, findings on the screen of the thing they name (S-016.4).
    const home = { Decisions: 'decisions', Stories: 'stories', Model: 'records', Personas: 'people' } as const
    for (const [, key] of Object.entries(home)) expect(page.nav.groups.filter(g => g.screens.some(s => s.key === key))).toHaveLength(1)
    expect(page.screens.stories.lines[0]!.scenarios.map(s => s.id)).toEqual(['S-001.1', 'S-001.2'])
    expect(page.screens['by-tests'].items.map(s => s.id)).toEqual(['S-001.1', 'S-001.2'])
  },

  'S-016.2': async () => {
    const html = await (await served(pythonProject())).html()
    const top = header(html)
    expect(top).toContain('<select id="project">')
    expect(top).toContain('id="live"')
    // Nothing else: no tabs, no buttons, no links.
    expect(top.replace(/<label[^>]*>|<\/label>|<select id="project"><\/select>|<span class="live" id="live"><\/span>|<header class="top">|\s/g, '')).toBe('')
    expect(html).not.toContain('role="tablist"')
    expect(html).not.toContain('role="tab"')
    expect(html).not.toMatch(/TABS\s*=/)
    // The screens are in the navigation instead, read from the vocabulary.
    expect(html).toContain('<nav class="side" id="nav"')
  },

  'S-016.3': async () => {
    expect((await nav(pythonProject())).groups.map(g => [g.label, g.caption]))
      .toEqual([['Model', 'what should be'], ['Implementation', 'what is'], ['Proof', 'how we know']])
  },

  'S-016.4': async () => {
    const root = pythonProject()
    // A requirement with two SHALLs, a domain file that uses the app, and a check whose text changed since.
    edit(root, `${STORY}/spec.md`, s => s.replace('greet them by it.', 'greet them by it. THE SYSTEM SHALL wave.'))
    edit(root, 'storyspec.config.json', s => JSON.stringify({ ...JSON.parse(s), layers: { 'app/domain': ['app/domain'] } }))
    files(root, { 'app/__init__.py': '', 'app/domain/__init__.py': '', 'app/domain/rules.py': 'from app.greet import greet\n' })
    edit(root, `${STORY}/story.md`, s => s.replace('implementedBy: app/greet.py', 'implementedBy: app/greet.py, app/domain/rules.py'))
    scenario(root, STORY, 'S-001.3', 'Greets in a large font', ['WHEN a person reads the greeting', 'THEN it is easy to read'], 'manual')
    gitRepo(root)
    expect((await prove(root, 'S-001.3')).status).toBe(200)
    edit(root, `${STORY}/spec.md`, s => s.replace('it is easy to read', 'it is easy to read from a metre away'))

    const page = await pageOf(root)
    const where = (rule: string) => Object.values(page.screens).flatMap(s => 'findings' in s ? s.findings : []).filter(f => f.details.includes(rule))
    expect(where('requirement-shape').map(f => [f.module, f.screen])).toEqual([['model', 'stories']])
    expect(where('layers').map(f => [f.module, f.screen])).toEqual([['implementation', 'layers']])
    expect(page.screens.stale.items.map(x => x.title)).toEqual(['Greets in a large font'])
    const counts = Object.fromEntries(page.nav.groups.map(g => [g.key, Object.fromEntries(g.screens.map(s => [s.key, s.count]))]))
    expect(counts.model!.stories).toBe(1)
    expect(counts.implementation!.layers).toBe(1)
    expect(counts.proof!.stale).toBe(1)
    // Each group's count is the sum of its screens'.
    for (const g of page.nav.groups) expect(g.count).toBe(g.screens.reduce((n, s) => n + s.count, 0))
    // No Findings screen anywhere.
    expect(page.nav.groups.flatMap(g => g.screens.map(s => s.label))).not.toContain('Findings')
    expect(Object.keys(page.screens)).not.toContain('findings')
  },

  'S-016.5': async () => {
    const root = pythonProject()
    expect((await pageOf(root)).screens.words).toMatchObject({ files: [], empty: 'This project has no shared vocabulary yet.' })
    personas(root, ['Player', 'Plays the game.'])
    writeFileSync(join(root, 'stories/MODEL.md'), '# Model\n\n## Match\n\n- Open → Closed\n')
    writeFileSync(join(root, 'stories/GAME.md'), '# The game\n\nA **run** is one attempt, from the lobby to the end screen.\n\n- *Lobby*: where a run starts\n- *Horde*: what you fight\n')
    const words = (await pageOf(root)).screens.words
    expect(words.empty).toBeUndefined()
    expect(words.files.map(f => f.name)).toEqual(['GAME.md'])
    expect(words.files[0]!.html).toBe('<h1>The game</h1>\n<p>A <strong>run</strong> is one attempt, from the lobby to the end screen.</p>\n<ul><li><em>Lobby</em>: where a run starts</li><li><em>Horde</em>: what you fight</li></ul>')
  },

  'S-016.6': async () => {
    const hash = formatRoute({ project: 'deadlight', screen: 'by-a-person' }, 'proof')
    expect(hash).toBe('#/deadlight/proof/by-a-person')
    // Opened fresh, the same URL lands on the same project and screen.
    expect(parseRoute(hash)).toEqual({ project: 'deadlight', screen: 'by-a-person', open: [], q: '' })
    // A project inside a folder keeps its slash.
    expect(parseRoute(formatRoute({ project: 'team/gamma', screen: 'stale' }, 'proof')).project).toBe('team/gamma')
    // The page reads the route from the URL when it opens, with these very functions.
    const html = await (await served(pythonProject())).html()
    expect(html).toContain(`const parseRoute = ${parseRoute.toString()};`)
    expect(html).toContain(`const formatRoute = ${formatRoute.toString()};`)
    expect(html).toContain('route: parseRoute(location.hash, SCREENS)')
  },

  'S-016.7': async () => {
    const page = await pageOf(pythonProject())
    expect(page.nav.groups.map(g => g.key)).toEqual(['model', 'implementation', 'proof'])
    expect(page.screens.people).toMatchObject({ empty: 'This project has no personas yet.', action: { label: 'Add a persona', op: 'add-persona' }, personas: [] })
  },
})
