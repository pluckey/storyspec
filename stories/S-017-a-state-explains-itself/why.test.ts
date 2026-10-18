import { expect } from 'vitest'
import { story } from 'storyspec/vitest'
import { trace } from '../../packages/storyspec/src/index.js'
import { VOCABULARY } from '../../packages/storyspec/src/ui/vocabulary.js'
import { edit, pass, fail, pythonProject, report, STORY } from '../../test/python-project.js'
import { another, gitRepo, pageOf, personas, prove, scenario, status, withDecisions } from '../../test/ui-project.js'
import { gen } from './scenarios.gen.js'

const line = async (root: string, id = 'S-001') => (await pageOf(root)).screens.stories.lines.find(l => l.id === id)!
const item = async (root: string, id: string) => (await pageOf(root)).screens.stories.lines.flatMap(l => l.scenarios).find(x => x.id === id)!
const manual = (root: string, n: number, title: string) =>
  scenario(root, STORY, `S-001.${n}`, title, ['WHEN a person looks at the greeting', `THEN ${title.toLowerCase()}`], 'manual')

story(gen, {
  'S-017.1': async () => {
    const root = pythonProject()
    manual(root, 3, 'The greeting is friendly')
    expect((await prove(root, 'S-001.3')).status).toBe(200)
    const l = await line(root)
    expect(l.state.word).toBe('can do today')
    expect(l.state.why.sentence).toBe('All 3 scenarios are checked, by tests and by a person.')
  },

  'S-017.2': async () => {
    const root = pythonProject()
    // 12 scenarios with passing tests, and 2 that a person checks.
    for (let n = 3; n <= 12; n++) scenario(root, STORY, `S-001.${n}`, `Greets case ${n}`, ['WHEN a case happens', 'THEN it is greeted'])
    report(root, ...Array.from({ length: 12 }, (_, i) => pass(`test_S_001_${i + 1}_case`)))
    manual(root, 13, 'The greeting is friendly')
    manual(root, 14, 'The greeting is easy to read')
    const l = await line(root)
    expect(l.state.word).toBe('being built')
    expect(l.state.why.sentence).toBe('12 of 14 scenarios are checked. Still to go:')
    expect(l.state.why.items).toEqual([
      { title: 'The greeting is friendly', word: 'waiting on you', action: { label: 'Check', op: 'check', target: 'S-001.13' } },
      { title: 'The greeting is easy to read', word: 'waiting on you', action: { label: 'Check', op: 'check', target: 'S-001.14' } },
    ])
  },

  'S-017.3': async () => {
    const root = pythonProject()
    manual(root, 3, 'The greeting is friendly')
    gitRepo(root, 'Ada Lovelace')
    expect((await prove(root, 'S-001.3')).status).toBe(200)
    edit(root, `${STORY}/spec.md`, s => s.replace('THEN the greeting is friendly', 'THEN the greeting is warm and friendly'))
    const sc = await item(root, 'S-001.3')
    expect(sc.state.word).toBe('needs a look')
    expect(sc.state.why).toMatchObject({
      sentence: 'Ada Lovelace checked it on 2026-10-18, but its text has changed since, so the check no longer counts.',
      then: 'The greeting is friendly\nWHEN a person looks at the greeting\nTHEN the greeting is friendly',
      now: 'The greeting is friendly\nWHEN a person looks at the greeting\nTHEN the greeting is warm and friendly',
      action: { label: 'Check again', op: 'check-again', target: 'S-001.3' },
    })
  },

  'S-017.4': async () => {
    const root = pythonProject()
    personas(root, ['Player', 'Plays the game.'])
    scenario(root, STORY, 'S-001.3', 'Greets with punctuation', ['WHEN a person is greeted', 'THEN the greeting ends in the agreed mark'])
    withDecisions(root, STORY, 'Greeting punctuation (open: player); S-001.3')
    const sc = await item(root, 'S-001.3')
    expect(sc.state.word).toBe('waiting on you')
    expect(sc.state.why.sentence).toBe('It waits on the decision "Greeting punctuation", which Player answers.')
    expect(sc.state.why.action).toEqual({ label: 'Answer', op: 'decide', target: 'S-001#0' })
  },

  'S-017.5': async () => {
    // Stories and scenarios in every state: done, being built (failing, stale, waiting on a person, blocked, untested),
    // planned (draft and ready).
    const root = pythonProject()
    const s2 = another(root, 2, 'Greet a team'), s3 = another(root, 3, 'Greet a guild'), s4 = another(root, 4, 'Greet a crowd')
    status(root, s3, 'draft'); status(root, s4, 'ready')
    scenario(root, s2, 'S-002.3', 'Greets by hand', ['WHEN a person looks', 'THEN it reads well'], 'manual')
    scenario(root, s2, 'S-002.4', 'Greets twice', ['WHEN a person looks', 'THEN it reads well twice'], 'manual')
    scenario(root, s2, 'S-002.5', 'Greets with a mark', ['WHEN a person is greeted', 'THEN it ends well'])
    withDecisions(root, s2, 'Greeting punctuation (open); S-002.5')
    gitRepo(root)
    expect((await prove(root, 'S-002.4', 'fail', 'too quiet')).status).toBe(200)
    expect((await prove(root, 'S-002.3')).status).toBe(200)
    edit(root, `${s2}/spec.md`, s => s.replace('THEN it reads well\n', 'THEN it reads very well\n'))
    report(root, pass('test_S_001_1_greets'), pass('test_S_001_2_greets'), pass('test_S_002_1_greets'), fail('test_S_002_2_greets', 'wrong name'))

    const json = JSON.parse(JSON.stringify(await trace(root, { write: false }))) as Awaited<ReturnType<typeof trace>>
    const page = await pageOf(root)
    const words = Object.values(VOCABULARY.states)
    const standsFor = (word: string) => words.find(w => w.word === word)!.trace as string[]
    // The scenario's status as TRACE.md marks it, read from the trace's JSON.
    const traced = (sc: (typeof json.rows)[number]['scenarios'][number]) =>
      sc.blocked && !sc.tested ? 'blocked'
      : !sc.tested && sc.tiers.some(t => t.tier !== 'manual') ? 'no-test'
      : sc.tiers.some(t => t.state === 'failed') ? 'failed'
      : sc.tiers.some(t => t.state === 'stale') ? 'stale'
      : sc.tiers.every(t => t.state === 'proven') ? 'proven'
      : sc.tiers.some(t => t.state === 'awaiting' && t.tier === 'local') ? 'not-run'
      : sc.tiers.some(t => t.state === 'awaiting' && t.tier === 'manual') ? 'awaiting-person' : 'awaiting-run'
    for (const r of json.rows) {
      const l = page.screens.stories.lines.find(x => x.id === r.story)!
      expect(standsFor(l.state.word), r.story).toContain(r.status)
      // Every place the page shows the scenario says the same.
      const shown = Object.values(page.screens).flatMap(s => [
        ...('lines' in s ? s.lines.flatMap(x => x.scenarios) : []),
        ...('items' in s && Array.isArray(s.items) ? (s.items as { id?: string; state?: { word: string } }[]) : []),
        ...('pendingItems' in s ? [...s.pendingItems, ...s.doneItems] : []),
      ])
      for (const sc of r.scenarios) {
        const all = shown.filter(x => x.id === sc.id)
        expect(all.length, sc.id).toBeGreaterThan(0)
        for (const x of all) expect(standsFor(x.state!.word), sc.id).toContain(traced(sc))
      }
    }
    // The fixture really covers every state word.
    const seen = new Set(page.screens.stories.lines.flatMap(l => [l.state.word, ...l.scenarios.map(x => x.state.word)]))
    expect([...seen].sort()).toEqual(words.map(w => w.word).sort())
  },

  'S-017.6': {},
})
