import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect } from 'vitest'
import { story } from 'story-spec/vitest'
import { loadConfig, scan, trace } from '../../packages/story-spec/src/index.js'
import { textHash } from '../../packages/story-spec/src/edit.js'
import { readPersonas } from '../../packages/story-spec/src/trace/personas.js'
import { applyEdit, serveUi, uiState } from '../../packages/story-spec/src/ui/server.js'
import { edit, pythonProject, STORY } from '../../test/python-project.js'
import { gen } from './scenarios.gen.js'

const NOW = new Date('2026-10-18T12:00:00Z')
const PERSONAS = 'stories/PERSONAS.md'
const RULES = ['unknown-persona', 'persona-without-stories', 'persona-prose-mismatch']
const read = (root: string, f: string) => readFileSync(join(root, f), 'utf8')

const cleanup: (() => void)[] = []
afterEach(() => { for (const c of cleanup.splice(0)) c() })

/** PERSONAS.md with each `[name, prose]` as a `## name` heading and its line. */
const personas = (root: string, ...entries: [string, string][]) =>
  writeFileSync(join(root, PERSONAS), `# Personas\n\n${entries.map(([n, p]) => `## ${n}\n\n${p}\n`).join('\n')}`)
const PLAYER: [string, string] = ['Player', 'Plays the game alone, a few evenings a week.']
const DEVELOPER: [string, string] = ['Developer', 'Builds levels and ships the game.']
const FRIEND: [string, string] = ['Friend', 'Joins a player\'s game for an evening.']

/** Adds front-matter lines after `version:`. */
const front = (root: string, dir: string, lines: string) =>
  edit(root, `${dir}/story.md`, s => s.replace(/^version: (\d+)$/m, `version: $1\n${lines}`))
/** Replaces the fixture's "As a visitor, I want…" line. */
const prose = (root: string, dir: string, text: string) =>
  edit(root, `${dir}/story.md`, s => s.replace(/^As a visitor.*$/m, text))
/** Another story, a copy of the fixture's renumbered: stories/S-00n-<slug>. */
const another = (root: string, n: number, title: string, epic = 'E-1 Greetings') => {
  const dir = `stories/S-00${n}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  cpSync(join(root, STORY), join(root, dir), { recursive: true })
  edit(root, `${dir}/story.md`, s => s.replace('id: S-001', `id: S-00${n}`).replace('title: Greet a person', `title: ${title}`).replace('epic: E-1 Greetings', `epic: ${epic}`))
  edit(root, `${dir}/spec.md`, s => s.replaceAll('S-001', `S-00${n}`))
  return dir
}
const scanned = (root: string) => scan(root, loadConfig(root))
const personaFindings = async (root: string) =>
  (await trace(root, { write: false })).findings.filter(f => RULES.includes(f.rule)).map(f => [f.rule, f.severity, f.message])
const traceMd = async (root: string, by?: 'persona') => { await trace(root, { by }); return read(root, 'stories/TRACE.md') }
const withDecisions = (root: string, dir: string, ...lines: string[]) =>
  edit(root, `${dir}/spec.md`, s => `${s.replace(/\s*$/, '')}\n\n### Decisions\n\n${lines.map(l => `- ${l}`).join('\n')}\n`)
const page = async (root: string) => {
  const server = await serveUi(root, { port: 0 })
  cleanup.push(() => server.close())
  const address = server.address()
  return (await fetch(`http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/`)).text()
}

story(gen, {
  'S-015.1': () => {
    const root = pythonProject()
    personas(root, PLAYER, DEVELOPER)
    expect(scanned(root).personas).toEqual([
      { name: 'Player', key: 'player', prose: PLAYER[1] },
      { name: 'Developer', key: 'developer', prose: DEVELOPER[1] },
    ])
  },

  'S-015.2': () => {
    const root = pythonProject()
    front(root, STORY, 'persona: player')
    expect(scanned(root).stories[0]!.personas).toEqual(['player'])
  },

  'S-015.3': () => {
    const root = pythonProject()
    front(root, STORY, 'persona: player, developer')
    expect(scanned(root).stories[0]!.personas).toEqual(['player', 'developer'])
  },

  'S-015.4': () => {
    const root = pythonProject()
    prose(root, STORY, 'As a player, I want to be greeted by name.')
    expect(scanned(root).stories[0]!.personas).toEqual(['player'])
  },

  'S-015.5': async () => {
    const root = pythonProject()
    personas(root, PLAYER)
    front(root, STORY, 'persona: friend')
    prose(root, STORY, 'As a friend, I want to be greeted by name.')
    const result = await trace(root, { write: false })
    const unknown = result.findings.filter(f => f.rule === 'unknown-persona')
    expect(unknown).toHaveLength(1)
    expect(unknown[0]).toMatchObject({ severity: 'warning', file: `${STORY}/story.md` })
    expect(unknown[0]!.message).toMatch(/^S-001: serves friend,/)
    expect(result.ok).toBe(true)
  },

  'S-015.6': async () => {
    const root = pythonProject()
    personas(root, PLAYER, FRIEND)
    prose(root, STORY, 'As a player, I want to be greeted by name.')
    expect(await personaFindings(root)).toEqual([
      ['persona-without-stories', 'warning', `friend: no story serves this persona; write one with persona: friend, or remove it from PERSONAS.md`],
    ])
  },

  'S-015.7': async () => {
    const root = pythonProject()
    personas(root, PLAYER, DEVELOPER)
    front(root, STORY, 'persona: developer')
    prose(root, STORY, 'As a player, I want to be greeted by name.')
    const mismatch = (await personaFindings(root)).filter(([rule]) => rule === 'persona-prose-mismatch')
    expect(mismatch).toEqual([['persona-prose-mismatch', 'warning',
      'S-001: persona: developer, but its text says it is for player ("As a…"); make them agree']])
  },

  'S-015.8': async () => {
    const root = pythonProject()
    const before = await traceMd(root)
    front(root, STORY, 'persona: friend')
    expect(await personaFindings(root)).toEqual([])
    expect(await traceMd(root)).toBe(before)
    expect(before).not.toContain('## Personas')
  },

  'S-015.9': async () => {
    const root = pythonProject()
    personas(root, PLAYER, DEVELOPER)
    front(root, another(root, 2, 'Greet a team'), 'persona: developer')
    front(root, another(root, 3, 'Greet a guild'), 'persona: player, developer')
    front(root, STORY, 'persona: player')
    const md = await traceMd(root, 'persona')
    const stories = md.slice(md.indexOf('## Stories'), md.indexOf('\n## ', md.indexOf('## Stories') + 1))
    const [, player, developer] = stories.split(/^### /m)
    expect(player!.split('\n')[0]).toBe('Player')
    expect(developer!.split('\n')[0]).toBe('Developer')
    const ids = (section: string) => [...section.matchAll(/^\| [^|]* \| (S-\d+) /gm)].map(m => m[1])
    expect(ids(player!)).toEqual(['S-001', 'S-003'])
    expect(ids(developer!)).toEqual(['S-002', 'S-003'])
    for (const section of [player!, developer!]) expect(section).toContain('| Epic | Story | Status | v | Implementation | Scenario | Test |')
    expect(stories).not.toContain('### No persona')
  },

  'S-015.10': async () => {
    const root = pythonProject()
    personas(root, PLAYER, FRIEND)
    prose(root, another(root, 2, 'Greet a team', 'E-2 Teams'), 'Teams get one greeting.')
    front(root, STORY, 'persona: player')
    const md = await traceMd(root)
    expect(md.trimEnd().split('\n').slice(-4)).toEqual([
      '| Epic | Player | Friend |',
      '|---|---|---|',
      '| E-1 Greetings | 1 / 0 / 0 | · |',
      '| E-2 Teams | · | · |',
    ])
  },

  'S-015.11': () => {
    const root = pythonProject()
    withDecisions(root, STORY, 'The target frame rate on low-end machines (open: player), waited on by S-010.14')
    expect(scanned(root).stories[0]!.decisions[0]).toMatchObject({ open: true, owner: 'player', pinnedBy: ['S-010.14'] })
  },

  'S-015.12': async () => {
    const root = pythonProject()
    personas(root, PLAYER, DEVELOPER)
    front(root, another(root, 2, 'Greet a team'), 'persona: developer')
    front(root, another(root, 3, 'Greet a guild'), 'persona: player')
    front(root, STORY, 'persona: player')
    withDecisions(root, STORY, 'Greeting punctuation (open: player); S-001.1', 'Token lifetime (open)')
    const state = await uiState(root)
    const player = state.personas!.find(p => p.key === 'player')!
    expect(player).toMatchObject({ name: 'Player', prose: PLAYER[1], stories: ['S-001', 'S-003'] })
    expect(player.decisions).toEqual([{ story: 'S-001', index: 0, question: 'Greeting punctuation', pinnedBy: ['S-001.1'], open: true, owner: 'player' }])
    const s3 = state.stories.find(s => s.id === 'S-003')!
    expect(s3.status).toBe('in-progress')
    expect(s3.scenarios.map(sc => [sc.id, sc.tiers.map(t => t.state)])).toEqual([['S-003.1', ['awaiting']], ['S-003.2', ['awaiting']]])
    const html = await page(root)
    // The Personas tab is People, under Model in the navigation (S-016).
    expect(html).toContain('"people":"People"')
    // A persona's row opens (S-023.8) to its prose, then the decisions waiting on it, then its stories in ID order,
    // each opening to its scenarios with their state and proof.
    const people = state.page.definitions.find(d => d.id === 'people')!
    expect(people.expand.map(p => p.part === 'grid' ? p.source : p.part)).toEqual(['text', 'waiting', 'can-do-today', 'being-built', 'planned'])
    const row = state.page.grids.people.rows.find(r => r.key === 'player')!
    expect(row.text).toBe(PLAYER[1])
    expect(row.children!.waiting!.map(r => r.cells.decision)).toEqual(['Greeting punctuation'])
    const stories = ['can-do-today', 'being-built', 'planned'].flatMap(k => row.children![k]!)
    expect(stories.map(r => [r.key, r.cells.state])).toEqual([['S-001', 'can do today'], ['S-003', 'being built']])
    expect(stories[1]!.children!.scenarios!.map(r => [r.key, r.cells.state])).toEqual([['S-003.1', 'needs a look'], ['S-003.2', 'needs a look']])
  },

  'S-015.13': async () => {
    const root = pythonProject()
    personas(root, PLAYER, FRIEND)
    front(root, STORY, 'persona: player')
    expect((await uiState(root)).personas!.find(p => p.key === 'friend')!.stories).toEqual([])
    expect(await page(root)).toContain('no stories yet')
    const result = applyEdit(root, { op: 'story', title: 'Friend joins a game', persona: 'friend' }, NOW)
    expect(result.status).toBe(200)
    expect(read(root, 'stories/S-002-friend-joins-a-game/story.md')).toMatch(/^persona: friend$/m)
    expect((await uiState(root)).personas!.find(p => p.key === 'friend')!.stories).toEqual(['S-002'])
  },

  'S-015.14': async () => {
    const root = pythonProject()
    personas(root, PLAYER)
    const git = (...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], { cwd: root, stdio: 'ignore' })
    git('init', '-q'); git('add', '.'); git('commit', '-qm', 'start')
    const before = read(root, PERSONAS)
    const result = applyEdit(root, { op: 'persona', name: 'Friend', prose: FRIEND[1], hash: textHash(before) }, NOW)
    expect(result.status).toBe(200)
    expect(read(root, PERSONAS)).toBe(`${before.replace(/\s*$/, '')}\n\n## Friend\n\n${FRIEND[1]}\n`)
    const diff = (await uiState(root)).changes.find(c => c.file === PERSONAS)!
    expect(diff.lines.filter(l => l.startsWith('+'))).toEqual(['+', '+## Friend', '+', `+${FRIEND[1]}`])
    // Like every other edit, it is refused when the file changed since the page read it.
    expect(applyEdit(root, { op: 'persona', name: 'Rival', prose: 'Plays against the player.', hash: textHash(before) }, NOW).status).toBe(409)
  },

  'S-015.15': () => {
    const app = join(mkdtempSync(join(tmpdir(), 'story-spec-create-')), 'app')
    cleanup.push(() => rmSync(join(app, '..'), { recursive: true, force: true }))
    execFileSync('node', [join(import.meta.dirname, '../../packages/create-story-spec/index.js'), app, '--no-install'], { stdio: 'ignore' })
    expect(existsSync(join(app, PERSONAS))).toBe(true)
    expect(readPersonas(join(app, 'stories'))!.map(p => p.name)).toEqual(['Member'])
    expect(read(app, 'stories/S-001-member-saves-a-note/story.md')).toMatch(/^persona: member$/m)
  },

  'S-015.16': {},
})
