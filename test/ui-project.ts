// Moves on a copy of the python fixture (python-project.ts) that the story-spec ui stories share: more stories, manual
// scenarios, personas, decisions, a git history, and the page the server builds from them.
import { execFileSync } from 'node:child_process'
import { cpSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach } from 'vitest'
import { applyEdit, serveUi, uiState } from '../packages/story-spec/src/ui/server.js'
import { edit, STORY } from './python-project.js'

export const NOW = new Date('2026-10-18T12:00:00Z')
export const read = (root: string, f: string) => readFileSync(join(root, f), 'utf8')

/** Adds front-matter lines after `version:`. */
export const front = (root: string, dir: string, lines: string) =>
  edit(root, `${dir}/story.md`, s => s.replace(/^version: (\d+)$/m, `version: $1\n${lines}`))

/** Sets a story's written status. */
export const status = (root: string, dir: string, to: string) => edit(root, `${dir}/story.md`, s => s.replace(/^status: .*$/m, `status: ${to}`))

/** Another story, a copy of the fixture's renumbered: stories/S-00n-<slug>. */
export const another = (root: string, n: number, title: string, epic = 'E-1 Greetings') => {
  const id = `S-${String(n).padStart(3, '0')}`
  const dir = `stories/${id}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  cpSync(join(root, STORY), join(root, dir), { recursive: true })
  edit(root, `${dir}/story.md`, s => s.replace('id: S-001', `id: ${id}`).replace('title: Greet a person', `title: ${title}`).replace('epic: E-1 Greetings', `epic: ${epic}`))
  edit(root, `${dir}/spec.md`, s => s.replaceAll('S-001', id))
  return dir
}

/** Adds `### Decisions` with these bullets to a story's spec.md. */
export const withDecisions = (root: string, dir: string, ...lines: string[]) =>
  edit(root, `${dir}/spec.md`, s => `${s.replace(/\s*$/, '')}\n\n### Decisions\n\n${lines.map(l => `- ${l}`).join('\n')}\n`)

/** Adds a scenario before the Decisions section (or at the end), with its steps and optional proof tiers. */
export const scenario = (root: string, dir: string, id: string, title: string, steps: string[], proof?: string) =>
  edit(root, `${dir}/spec.md`, s => {
    const block = `#### Scenario: ${title} {#${id}${proof ? ` proof=${proof}` : ''}}\n\n${steps.map(x => `- ${x}`).join('\n')}\n\n`
    const at = s.search(/^### Decisions/m)
    return at < 0 ? `${s.replace(/\s*$/, '')}\n\n${block}` : `${s.slice(0, at)}${block}${s.slice(at)}`
  })

/** PERSONAS.md with each `[name, prose]` as a `## name` heading and its line. */
export const personas = (root: string, ...entries: [string, string][]) =>
  writeFileSync(join(root, 'stories/PERSONAS.md'), `# Personas\n\n${entries.map(([n, p]) => `## ${n}\n\n${p}\n`).join('\n')}`)

/** Makes the project a git repository whose user is `name`, with everything committed. */
export const gitRepo = (root: string, name = 'Ada Lovelace') => {
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, stdio: 'ignore' })
  git('init', '-q'); git('config', 'user.name', name); git('config', 'user.email', 'ada@example.com'); git('config', 'commit.gpgsign', 'false')
  git('add', '.'); git('commit', '-qm', 'start')
  return { commit: (message = 'change') => { git('add', '.'); git('commit', '-qm', message) } }
}

/** Records a person's check from the page, as the page sends it. */
export const prove = async (root: string, id: string, outcome: 'pass' | 'fail' = 'pass', note?: string) => {
  const sc = (await uiState(root)).stories.flatMap(s => s.scenarios).find(x => x.id === id)!
  return applyEdit(root, { op: 'prove', id, hash: sc.hash, outcome, ...(note && { note }) }, NOW)
}

/** The page model the server builds for the project. */
export const pageOf = async (root: string) => (await uiState(root)).page

const servers: { close: () => void }[] = []
afterEach(() => { for (const s of servers.splice(0)) s.close() })

/** Serves the project as story-spec ui does; `html` is the page as the browser gets it. */
export const served = async (root: string) => {
  const server = await serveUi(root, { port: 0, now: () => NOW })
  servers.push(server)
  const address = server.address()
  const url = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`
  return {
    url,
    html: async () => (await fetch(`${url}/`)).text(),
    get: async (path: string) => { const r = await fetch(url + path); return { status: r.status, body: await r.json() } },
    post: async (body: unknown) => {
      const r = await fetch(`${url}/api/edit`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      return { status: r.status, body: await r.json() }
    },
  }
}
