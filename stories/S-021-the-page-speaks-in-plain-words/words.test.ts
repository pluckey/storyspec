import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect } from 'vitest'
import { story } from 'storyspec/vitest'
import { loadConfig, readProof, scan, trace } from '../../packages/storyspec/src/index.js'
import type { Finding } from '../../packages/storyspec/src/trace/rules.js'
import { pageHtml, uiState } from '../../packages/storyspec/src/ui/server.js'
import { buildPage } from '../../packages/storyspec/src/ui/view.js'
import { VOCABULARY, type Vocabulary } from '../../packages/storyspec/src/ui/vocabulary.js'
import { edit, fail, pass, pythonProject, report, STORY } from '../../test/python-project.js'
import { another, gitRepo, pageOf, prove, scenario, status, withDecisions } from '../../test/ui-project.js'
import { gen } from './scenarios.gen.js'

const repoRoot = join(import.meta.dirname, '../..')
const STATE_WORDS = ['can do today', 'being built', 'planned', 'needs a look', 'waiting on you', 'checked', 'failed a check']
/** The page as JSON without its details lines: what a person reads before opening one. */
const visible = (x: unknown) => JSON.stringify(x, (k, v) => k === 'details' ? undefined : v)

/** Stories and scenarios in every state, decisions that name IDs, and a stale proof on a story at v2. */
const rich = async () => {
  const root = pythonProject()
  const s2 = another(root, 2, 'Greet a team'), s3 = another(root, 3, 'Greet a guild')
  status(root, s3, 'draft')
  scenario(root, s2, 'S-002.3', 'Greets by hand', ['WHEN a person looks', 'THEN it reads well'], 'manual')
  scenario(root, s2, 'S-002.4', 'Greets twice', ['WHEN a person looks', 'THEN it reads well twice'], 'manual')
  scenario(root, s2, 'S-002.5', 'Greets with a mark', ['WHEN a person is greeted', 'THEN it ends well'])
  withDecisions(root, s2, 'Greeting punctuation (open); S-002.5', 'Names come from S-001, as S-001.1 says (free)')
  edit(root, `${s2}/story.md`, s => s.replace(/^version: 1$/m, 'version: 2'))
  gitRepo(root)
  expect((await prove(root, 'S-002.4', 'fail', 'too quiet')).status).toBe(200)
  expect((await prove(root, 'S-002.3')).status).toBe(200)
  edit(root, `${s2}/spec.md`, s => s.replace('THEN it reads well\n', 'THEN it reads very well\n'))
  report(root, pass('test_S_001_1_greets'), pass('test_S_001_2_greets'), pass('test_S_002_1_greets'), fail('test_S_002_2_greets', 'wrong name'))
  return root
}
const stateWords = (page: Awaited<ReturnType<typeof pageOf>>) => {
  const words: string[] = []
  JSON.stringify(page, (k, v) => { if (v && typeof v === 'object' && 'word' in v && 'why' in v) words.push(v.word); return v })
  return words
}

/** One finding of each rule as the trace writes it, and the thing the page's sentence must name. */
const SAMPLES: Record<string, [Partial<Finding>, string]> = {
  'story-files': [{ message: 'S-001: missing spec.md', file: STORY }, '“Greet a person”'],
  'requirement-tag': [{ message: 'S-001: spec.md has no requirement tagged {#S-001}' }, '“Greet a person”'],
  'requirement-shape': [{ message: 'S-001: the requirement has 2 SHALL statements.' }, '“Greet a person”'],
  scenarios: [{ message: 'S-001: spec.md has no scenarios' }, '“Greet a person”'],
  'scenario-ownership': [{ message: 'S-001: S-001.1 is tagged more than once' }, '“Greet a person”'],
  decisions: [{ message: 'S-001: the decision "Token lifetime" is neither pinned by a scenario, marked free, nor marked open' }, '“Token lifetime”'],
  model: [{ message: 'S-001: emits match.won, but Match has no state won; its events are match.open', file: `${STORY}/story.md`, severity: 'error' }, '“Greet a person”'],
  'unknown-persona': [{ message: 'S-001: serves friend, which stories/PERSONAS.md doesn\'t describe' }, '“Greet a person”'],
  'persona-without-stories': [{ message: 'friend: no story serves this persona; write one with persona: friend' }, 'Friend'],
  'persona-prose-mismatch': [{ message: 'S-001: persona: developer, but its text says it is for player' }, '“Greet a person”'],
  implementation: [{ message: 'S-001: no file says @implements S-001' }, '“Greet a person”'],
  'untested-scenario': [{ message: 'S-001.1: no test' }, '“Greets by name”'],
  'orphan-test': [{ message: 'S-001: a test is named S-001.9, which isn\'t a scenario in spec.md' }, '“Greet a person”'],
  'failing-test': [{ message: 'S-001.1: its test fails' }, '“Greets by name”'],
  'must-pass': [{ message: 'S-001.1: story is done but its test fails' }, '“Greets by name”'],
  proof: [{ message: 'S-001.2: failed in the deployed tier on 2026-10-18' }, '“Greets a stranger without a name”'],
  'derived-status': [{ message: 'S-001: "done" is worked out from proof now, not written' }, '“Greet a person”'],
  unproven: [{ message: 'S-001: not done; still to prove: S-001.2 manual (awaiting)' }, '“Greet a person”'],
  'adapter-untested': [{ message: 'src/adapters/memory/greeter.ts (Greeter) isn\'t exercised by any test in any tier', file: 'src/adapters/memory/greeter.ts' }, 'src/adapters/memory/greeter.ts'],
  'gen-fresh': [{ message: 'S-001: stories/S-001-greet-a-person/scenarios.gen.ts is stale; run storyspec gen', file: `${STORY}/scenarios.gen.ts` }, '“Greet a person”'],
  'story-imports': [{ message: 'imports app/db; stories may import only their own folder', file: `${STORY}/greet.ts` }, '“Greet a person”'],
  'ids-outside-stories': [{ message: 'mentions S-001; story logic belongs in stories/', file: 'app/greet.py' }, 'app/greet.py'],
  wiring: [{ message: 'imports stories/S-001-greet-a-person/greet; only src/entry/composition.ts may import stories', file: 'app/main.py' }, 'app/main.py'],
  layers: [{ message: 'imports app/adapters/db; app/domain may import app/domain', file: 'app/domain/model.py' }, 'app/domain/model.py'],
  'contract-tests': [{ message: 'Greeter has an adapter (src/adapters/memory/greeter.ts) but no test outside stories/ that ran exercises it', file: 'src/ports/greeter.ts' }, 'Greeter'],
  trigger: [{ message: 'S-001: trigger: person isn\'t a kind of trigger' }, '“Greet a person”'],
  after: [{ message: 'S-001: after: names itself' }, '“Greet a person”'],
  'unclaimed-code': [{ message: 'no story claims it', file: 'app/farewell.py' }, 'app/farewell.py'],
  slug: [{ message: 'S-001: folder doesn\'t match the title "Greet a person"', file: STORY }, '“Greet a person”'],
  'port-adapter': [{ message: 'Greeter has no adapter yet', file: 'src/ports/greeter.ts' }, 'Greeter'],
  'framework-sync': [{ message: 'AGENTS.md is missing the storyspec guidance; run storyspec sync', file: 'AGENTS.md' }, 'AGENTS.md'],
  tests: [{ message: '"pytest" did not write .storyspec/junit.xml' }, 'this project'],
}

story(gen, {
  'S-021.1': async () => {
    expect(Object.values(VOCABULARY.states).map(s => s.word).sort()).toEqual([...STATE_WORDS].sort())
    // Each trace status is stood for by exactly one word.
    const statuses = Object.values(VOCABULARY.states).flatMap(s => s.trace as string[])
    expect(new Set(statuses).size).toBe(statuses.length)
    expect([...statuses].sort()).toEqual(['awaiting-person', 'awaiting-run', 'blocked', 'done', 'draft', 'failed', 'in-progress', 'no-test', 'not-run', 'proven', 'ready', 'stale'])
    // Every state word on the page is one of the seven, and the fixture uses all seven.
    const seen = stateWords(await pageOf(await rich()))
    expect(seen.length).toBeGreaterThan(20)
    expect([...new Set(seen)].sort()).toEqual([...STATE_WORDS].sort())
  },

  'S-021.2': async () => {
    const page = await pageOf(await rich())
    const id = /\bS-\d+(\.\d+)?\b/
    const headings = [
      ...page.nav.groups.flatMap(g => [g.label, g.caption, ...g.screens.map(s => s.label)]),
      page.inbox.heading, ...page.inbox.items.map(i => i.title),
      ...Object.values(page.screens).map(s => s.heading),
      ...page.screens.stories.lines.flatMap(l => [l.title, ...l.scenarios.map(x => x.title)]),
      ...page.screens.decisions.items.map(d => d.title),
    ]
    expect(headings.length).toBeGreaterThan(30)
    for (const h of headings) expect(h).not.toMatch(id)
    // The decision that names IDs reads them as titles; the IDs are on its details line.
    const named = page.screens.decisions.items.find(d => d.title.startsWith('Names come from'))!
    expect(named.title).toBe('Names come from “Greet a person”, as “Greets by name” says')
    expect(named.details).toBe('S-002 · S-001.1')
    // Every story line and scenario carries its ID on its details line.
    for (const l of page.screens.stories.lines) {
      expect(l.details.startsWith(`${l.id} · `)).toBe(true)
      for (const x of l.scenarios) expect(x.details.startsWith(`${x.id} · `)).toBe(true)
    }
  },

  'S-021.3': async () => {
    const rules = [...readFileSync(join(repoRoot, 'docs/rules.md'), 'utf8').matchAll(/^\| `([a-z-]+)` \|/gm)].map(m => m[1]!)
    expect(rules.length).toBeGreaterThan(30)
    expect(Object.keys(SAMPLES).sort()).toEqual([...rules].sort())
    const root = pythonProject()
    const config = loadConfig(root), repo = scan(root, config), result = await trace(root, { write: false })
    const findings = rules.map(rule => ({ rule, severity: 'warning' as const, ...SAMPLES[rule]![0] } as Finding))
    const page = buildPage({ root, config, repo, rows: result.rows, findings, ports: result.ports, proof: readProof(repo) })
    const shown = [
      ...Object.values(page.screens).flatMap(s => 'findings' in s ? s.findings : []),
      ...page.inbox.items.map(i => ({ sentence: `${i.title}: ${i.sentence}`, action: i.action, details: i.details })),
    ]
    for (const rule of rules) {
      const f = shown.filter(x => x.details.split(' · ').includes(rule))
      expect(f, rule).toHaveLength(1)
      const { sentence, action, details } = f[0]!
      expect(sentence, rule).toContain(SAMPLES[rule]![1])
      // A sentence: it starts with a capital or a quote and ends with a full stop; the fix is a second sentence.
      if (rule !== 'unclaimed-code') expect(sentence, rule).toMatch(/^[A-Z“"a-z].*\. .+\.$/)
      if (rule.includes('-')) expect(sentence, rule).not.toContain(rule)
      expect(sentence, rule).not.toMatch(/\bS-\d+/)
      expect(action.label, rule).toBeTruthy()
      expect(details, rule).toContain(rule)
    }
  },

  'S-021.4': async () => {
    const page = await pageOf(await rich())
    const l = page.screens.stories.lines.find(x => x.id === 'S-002')!
    const stale = l.scenarios.find(x => x.title === 'Greets by hand')!
    expect(stale.state.word).toBe('needs a look')
    const [then, now] = stale.details.split(' · ').at(-1)!.split(' → ')
    expect(then).toMatch(/^[0-9a-f]{12}$/)
    expect(now).toMatch(/^[0-9a-f]{12}$/)
    // Only the details lines say v2 or either hash.
    expect(l.details).toContain('v2')
    for (const hidden of ['v2', then!, now!]) expect(visible(l)).not.toContain(hidden)
    // On the page a details line starts closed.
    expect(await pageHtml()).toContain('`<details class="dl"><summary>${esc(V.details)}</summary>')
  },

  'S-021.5': async () => {
    const root = await rich()
    const words: Vocabulary = JSON.parse(JSON.stringify(VOCABULARY))
    words.states['being-built'].word = 'under way'
    words.nav.groups[0]!.caption = 'what we mean'
    words.findings['failing-test'].sentence = '{thing} is broken. Mend it.'
    const page = (await uiState(root, words)).page
    expect(page.screens.stories.lines.find(l => l.id === 'S-002')!.state.word).toBe('under way')
    expect(page.nav.groups[0]!.caption).toBe('what we mean')
    expect(page.screens['by-tests'].findings.map(f => f.sentence)).toContain('“Greets a stranger without a name” is broken. Mend it.')
    expect(JSON.stringify(page)).not.toContain('being built')
    // The page itself holds no copy of the words: they reach it only from the table.
    const html = pageHtml(words)
    expect(html).toContain('"word":"under way"')
    expect(html).not.toContain('being built')
    // Phrases that can only be page text appear in the page exactly as often as in the table. ("planned" and
    // "checked" are left out: they are also the states' keys, which name CSS classes, and an HTML attribute.)
    const phrases = [...STATE_WORDS.filter(w => w.includes(' ') && w !== 'being built'), 'what we mean', 'what is', 'how we know', 'Needs you']
    const table = JSON.stringify(words)
    for (const w of phrases) expect(html.split(w).length, w).toBe(table.split(w).length)
    const template = readFileSync(join(repoRoot, 'packages/storyspec/ui/index.html'), 'utf8')
    for (const w of [...phrases, 'being built', 'what should be']) expect(template, w).not.toContain(w)
  },
})
