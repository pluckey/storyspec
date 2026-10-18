import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect } from 'vitest'
import { story } from 'story-spec/vitest'
import { textHash } from '../../packages/story-spec/src/edit.js'
import { serveUi } from '../../packages/story-spec/src/ui/server.js'
import { edit, pythonProject, STORY } from '../../test/python-project.js'
import { gen } from './scenarios.gen.js'

const cleanup: (() => void)[] = []
afterEach(() => { for (const c of cleanup.splice(0)) c() })

/** A folder with three projects (alpha with one open decision, beta with two, team/gamma nested with none), a plain
 * folder, and a project inside node_modules that must not be listed. */
const folder = () => {
  const base = mkdtempSync(join(tmpdir(), 'story-spec-projects-'))
  cleanup.push(() => rmSync(base, { recursive: true, force: true }))
  const project = (at: string, ...decisions: string[]) => {
    const root = pythonProject()
    edit(root, `${STORY}/spec.md`, s => `${s.replace(/\s*$/, '')}\n\n### Decisions\n\n${decisions.map(d => `- ${d}`).join('\n')}\n`)
    cpSync(root, join(base, at), { recursive: true })
  }
  project('alpha', 'Greeting punctuation (open); S-001.1')
  project('beta', 'Token lifetime (open)', 'Retention (open)')
  project('team/gamma', 'Token lifetime: 7 days (free)')
  project('alpha-tools/node_modules/vendored', 'Ignored (open)')
  mkdirSync(join(base, 'notes'))
  return base
}
const serve = async (start: string, base?: string) => {
  const server = await serveUi(start, { port: 0, ...(base && { base }) })
  cleanup.push(() => server.close())
  const address = server.address()
  const url = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`
  return { get: async (path: string) => { const r = await fetch(url + path); return { status: r.status, body: await r.json() } }, url }
}

story(gen, {
  'S-013.1': async () => {
    const { get } = await serve(folder())
    const { body } = await get('/api/projects')
    expect(body.projects.map((p: { id: string; stories: number; open: number }) => [p.id, p.stories, p.open]))
      .toEqual([['alpha', 1, 1], ['beta', 1, 2], ['team/gamma', 1, 0]])
  },

  'S-013.2': async () => {
    const base = folder()
    const { get } = await serve(join(base, 'beta'))
    expect((await get('/api/projects')).body.first).toBe('beta')
    expect((await get('/api/state')).body.stories[0].decisions.map((d: { question: string }) => d.question)).toEqual(['Token lifetime', 'Retention'])
  },

  'S-013.3': async () => {
    const { get } = await serve(folder())
    const { body } = await get('/api/projects')
    expect(body.projects).toHaveLength(3)
    expect(body.first).toBe('alpha')
  },

  'S-013.4': async () => {
    const base = folder()
    const { get, url } = await serve(base)
    const alphaBefore = readFileSync(join(base, 'alpha', STORY, 'spec.md'), 'utf8')
    const betaSpec = join(base, 'beta', STORY, 'spec.md')
    const res = await fetch(`${url}/api/edit`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project: 'beta', op: 'answer', story: 'S-001', hash: textHash(readFileSync(betaSpec, 'utf8')), index: 0, answer: '7 days', kind: 'free' }),
    })
    expect(res.status).toBe(200)
    expect(readFileSync(betaSpec, 'utf8')).toContain('- Token lifetime: 7 days (free)')
    expect(readFileSync(join(base, 'alpha', STORY, 'spec.md'), 'utf8')).toBe(alphaBefore)
    const state = (await get('/api/state?project=beta')).body
    expect(state.stories[0].decisions[0]).toMatchObject({ open: false, free: true })
  },

  'S-013.5': async () => {
    const { get } = await serve(folder())
    const res = await get('/api/state?project=..%2F..%2Fetc')
    expect(res.status).toBe(404)
  },
})
