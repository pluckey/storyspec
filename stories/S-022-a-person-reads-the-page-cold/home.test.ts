import { cpSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect } from 'vitest'
import { story } from 'story-spec/vitest'
import { gridComponent } from '../../packages/story-spec/src/ui/grid.js'
import { say } from '../../packages/story-spec/src/ui/route.js'
import { VOCABULARY } from '../../packages/story-spec/src/ui/vocabulary.js'
import { edit, pass, pythonProject, report, STORY } from '../../test/python-project.js'
import { another, front, pageOf, personas, served, status, withDecisions } from '../../test/ui-project.js'
import { gen } from './scenarios.gen.js'

const cleanup: (() => void)[] = []
afterEach(() => { for (const c of cleanup.splice(0)) c() })

/** A game with two personas: the player can do one thing today and has one being built, the developer has one
 * planned, and a decision waits on the player. */
const game = () => {
  const root = pythonProject()
  personas(root, ['Player', 'Plays the game alone, a few evenings a week.'], ['Developer', 'Builds levels and ships the game.'])
  const s2 = another(root, 2, 'Join a match'), s3 = another(root, 3, 'Build a level')
  front(root, STORY, 'persona: player'); front(root, s2, 'persona: player'); front(root, s3, 'persona: developer')
  status(root, s3, 'draft')
  report(root, pass('test_S_001_1_greets'), pass('test_S_001_2_greets'), pass('test_S_002_1_joins'))
  withDecisions(root, s2, 'The target frame rate on low-end machines (open: player); S-002.2')
  return root
}

story(gen, {
  'S-022.1': async () => {
    // Every project in the folder, including one with personas and decisions and one inside a team folder.
    const base = mkdtempSync(join(tmpdir(), 'story-spec-cold-'))
    cleanup.push(() => rmSync(base, { recursive: true, force: true }))
    cpSync(pythonProject(), join(base, 'plain'), { recursive: true })
    cpSync(game(), join(base, 'game'), { recursive: true })
    mkdirSync(join(base, 'team'))
    const empty = pythonProject()
    edit(empty, `${STORY}/spec.md`, () => '')
    cpSync(empty, join(base, 'team/empty'), { recursive: true })
    const { get } = await served(base)
    const { body } = await get('/api/projects')
    expect(body.projects.map((p: { id: string }) => p.id)).toEqual(['game', 'plain', 'team/empty'])
    for (const p of body.projects as { id: string; stories: number }[]) {
      const res = await get(`/api/state?project=${encodeURIComponent(p.id)}`)
      expect(res.status, p.id).toBe(200)
      expect(res.body.page.inbox.home.stories, p.id).toBe(`${p.stories} ${p.stories === 1 ? 'story' : 'stories'}`)
    }
  },

  'S-022.2': async () => {
    const page = await pageOf(game())
    const home = page.inbox.home
    expect(home.personas).toEqual(['Player: 1 can do today, 1 being built', 'Developer: 0 can do today, 0 being built'])
    expect(home.beingBuilt).toBe('1 story being built')
    // The decision is the first thing on the list, saying whom it waits on.
    expect(page.inbox.items[0]).toMatchObject({ kind: 'decide', title: 'The target frame rate on low-end machines', sentence: 'Waits on Player. It holds up 1 scenario.' })
    // Needs you draws the home cards above its grid (S-023.12), so all three answers sit at the top of the screen.
    const html = await (await served(game())).html()
    const home$ = html.slice(html.indexOf('function homeHtml()'), html.indexOf('const screenHtml'))
    expect(home$).toContain('h.personas')
    expect(html).toContain("lead: def.id === 'needs-you' ? homeHtml() : ''")
    const drawn = gridComponent(VOCABULARY, say).html(page.definitions[0]!, page.grids['needs-you'], { open: [], q: '' }, [], { lead: '<div class="home"></div>' })
    expect(drawn.indexOf('<div class="home">')).toBeGreaterThan(-1)
    expect(drawn.indexOf('<div class="home">')).toBeLessThan(drawn.indexOf('<table'))
    // One card for the counts and one per persona, before the first item.
    expect(home.personas.length + 1).toBeLessThanOrEqual(4)
  },

  'S-022.3': {},
})
