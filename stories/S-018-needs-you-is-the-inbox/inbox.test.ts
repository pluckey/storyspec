import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect } from 'vitest'
import { story } from 'story-spec/vitest'
import { textHash } from '../../packages/story-spec/src/edit.js'
import { parseRoute } from '../../packages/story-spec/src/ui/route.js'
import { applyEdit } from '../../packages/story-spec/src/ui/server.js'
import { VOCABULARY } from '../../packages/story-spec/src/ui/vocabulary.js'
import { edit, pythonProject, STORY } from '../../test/python-project.js'
import { another, gitRepo, NOW, pageOf, personas, prove, read, scenario, served, status, withDecisions } from '../../test/ui-project.js'
import { gen } from './scenarios.gen.js'

/** One of each thing that waits on a person: an open decision, a draft story, a stale proof, a manual scenario no
 * one has checked, and a file no story claims. */
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

story(gen, {
  'S-018.1': async () => {
    const root = await busy()
    const items = (await pageOf(root)).inbox.items
    // Each kind with its action. A Decide item's button says Answer, the verb S-023.6 gives it; its kind says Decide.
    expect(items.map(i => [i.kind, i.title, i.action.label, i.action.op])).toEqual([
      ['decide', 'Token lifetime', 'Answer', 'decide'],
      ['approve', 'Greet a team', 'Approve', 'approve'],
      ['check-again', 'The greeting is friendly', 'Check again', 'check-again'],
      ['check', 'The greeting is easy to read', 'Check', 'check'],
      ['claim', 'app/farewell.py', 'Claim', 'claim'],
    ])
    // Claiming names the file in the story's implementedBy:, and leaves the code as it was.
    const code = read(root, 'app/farewell.py')
    const claimed = applyEdit(root, { op: 'claim', story: 'S-001', hash: textHash(read(root, `${STORY}/story.md`)), file: 'app/farewell.py' }, NOW)
    expect(claimed).toEqual({ status: 200, message: 'S-001 now claims app/farewell.py' })
    expect(read(root, `${STORY}/story.md`)).toMatch(/^implementedBy: app\/greet\.py, app\/farewell\.py$/m)
    expect(read(root, 'app/farewell.py')).toBe(code)
    expect((await pageOf(root)).inbox.items.map(i => i.kind)).not.toContain('claim')
  },

  'S-018.2': async () => {
    const inbox = (await pageOf(pythonProject())).inbox
    expect(inbox.items).toEqual([])
    expect(inbox.empty).toBe('Nothing is waiting on you.')
    expect(inbox.summaries).toEqual([
      { key: 'model', label: 'Model', caption: 'what should be', text: '1 story, 0 open decisions, 0 personas' },
      { key: 'implementation', label: 'Implementation', caption: 'what is', text: '1 file claimed by stories, 0 files unclaimed, 0 ports' },
      { key: 'proof', label: 'Proof', caption: 'how we know', text: '2 of 2 scenarios checked, 0 stale' },
    ])
  },

  'S-018.3': async () => {
    const root = pythonProject()
    scenario(root, STORY, 'S-001.3', 'Greets with a mark', ['WHEN a person is greeted', 'THEN it ends in the agreed mark'])
    scenario(root, STORY, 'S-001.4', 'Says goodbye with a mark', ['WHEN a person leaves', 'THEN it ends in the agreed mark'])
    withDecisions(root, STORY, 'Greeting punctuation (open); S-001.3, S-001.4')
    const words = (page: Awaited<ReturnType<typeof pageOf>>) => page.screens.stories.lines[0]!.scenarios.filter(x => x.id >= 'S-001.3').map(x => x.state.word)
    const before = await pageOf(root)
    expect(before.inbox.items.map(i => i.kind)).toEqual(['decide'])
    expect(words(before)).toEqual(['waiting on you', 'waiting on you'])
    const { post } = await served(root)
    const res = await post({ op: 'answer', story: 'S-001', hash: textHash(read(root, `${STORY}/spec.md`)), index: 0, answer: 'a full stop', kind: 'pinned' })
    expect(res.status).toBe(200)
    // The answer's own response carries the page as it now is: no refresh in between.
    const after = res.body.state.page
    expect(after.inbox.items).toEqual([])
    expect(words(after)).not.toContain('waiting on you')
  },

  'S-018.4': async () => {
    const root = pythonProject()
    personas(root, ['Player', 'Plays the game.'])
    withDecisions(root, STORY, 'The target frame rate on low-end machines (open: player)')
    const [item] = (await pageOf(root)).inbox.items
    expect(item).toMatchObject({ kind: 'decide', title: 'The target frame rate on low-end machines', owner: 'Player', sentence: 'Waits on Player.' })
  },

  'S-018.5': async () => {
    for (const root of [pythonProject(), await busy()]) {
      const page = await pageOf(root)
      expect(page.nav.inbox.count).toBe(page.inbox.items.length)
    }
  },

  'S-018.6': async () => {
    const screens = ['needs-you', ...VOCABULARY.nav.groups.flatMap(g => g.screens)]
    for (const hash of ['', '#', '#/deadlight', '#/deadlight/', '#/deadlight/nowhere']) expect(parseRoute(hash, screens).screen).toBe('needs-you')
    // The page reads the route from the URL, and an unknown screen falls back to Needs you.
    const html = await (await served(pythonProject())).html()
    expect(html).toContain("(SCREEN[state.route.screen] ?? SCREEN['needs-you'])()")
    expect(html).toContain('route: parseRoute(location.hash, SCREENS)')
  },
})
