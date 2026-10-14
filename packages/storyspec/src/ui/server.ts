// `storyspec ui`: a local web page for people who manage the spec without editing files. The files stay the only
// source of truth: the server reads the repo the way the trace does, and each write is one edit from edit.ts applied
// to one file, refused when the file changed since the page read it. Git is the history.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig } from '../config.js'
import { addScenario, answerDecision, bumpVersion, decisionQuestion, editScenario, requirementText, scenarioSteps, setStatus, storyText, textHash, type Edit } from '../edit.js'
import { writeGen } from '../gen.js'
import { trace } from '../index.js'
import { scan } from '../trace/scan.js'

export type UiOptions = { port?: number; host?: string; now?: () => Date }

const STATUSES = ['draft', 'ready', 'in-progress', 'superseded']

const page = () => {
  for (const rel of ['../ui/index.html', '../../ui/index.html']) {
    const p = fileURLToPath(new URL(rel, import.meta.url))
    if (existsSync(p)) return readFileSync(p, 'utf8')
  }
  return '<p>storyspec ui: the page is missing from this install.</p>'
}

/** Uncommitted changes under the stories folder, per file, as diff lines: what the UI shows before you commit. */
const changes = (root: string, storiesDir: string) => {
  const git = (...args: string[]) => { try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }) } catch { return '' } }
  const out: { file: string; lines: string[] }[] = []
  for (const chunk of git('diff', '--no-color', '--', storiesDir).split(/^diff --git /m).slice(1)) {
    const file = chunk.match(/^a\/(\S+)/)?.[1] ?? ''
    if (file.endsWith('TRACE.md') || file.endsWith('scenarios.gen.ts')) continue
    const lines = chunk.split('\n').filter(l => /^[ +-]/.test(l) && !/^(\+\+\+|---) /.test(l))
    out.push({ file, lines })
  }
  for (const file of git('ls-files', '--others', '--exclude-standard', '--', storiesDir).split('\n').filter(f => f && !f.endsWith('scenarios.gen.ts')))
    out.push({ file, lines: readFileSync(join(root, file), 'utf8').replace(/\n$/, '').split('\n').map(l => `+${l}`) })
  return out
}

/** Everything the page shows, read fresh from the repo. */
export const uiState = async (root: string) => {
  const config = loadConfig(root)
  const result = await trace(root, { write: false })
  const repo = scan(root, config)
  const rows = new Map(result.rows.map(r => [r.story, r]))
  const stories = repo.stories.map(s => {
    const storyMd = readFileSync(join(root, s.dir, 'story.md'), 'utf8')
    const steps = scenarioSteps(s.spec, config.idPrefix)
    const row = rows.get(s.id)
    return {
      id: s.id, dir: s.dir, title: s.front.title ?? '', epic: s.front.epic ?? '', status: row?.status ?? s.front.status ?? '',
      written: s.front.status ?? '', version: s.front.version ?? '', trigger: s.trigger[0] ?? '', emits: s.emits, after: s.after,
      text: storyText(storyMd), requirement: requirementText(s.spec, s.id),
      hashes: { story: textHash(storyMd), spec: textHash(s.spec) },
      decisions: s.decisions.map(d => ({ ...d, question: decisionQuestion(d.text) })),
      scenarios: (row?.scenarios ?? []).map(sc => ({ ...sc, steps: steps[sc.id] ?? [] })),
    }
  })
  return {
    project: basename(root), storiesDir: config.storiesDir, ok: result.ok, findings: result.findings, stories,
    model: repo.model ?? null, changes: changes(root, config.storiesDir),
  }
}

type Body = { op?: string; story?: string; hash?: string; index?: number; answer?: string; kind?: string; status?: string; id?: string; title?: string; steps?: string[] }

/** Applies one edit from the page. Returns the HTTP status and a message. */
export const applyEdit = (root: string, body: Body, now: Date = new Date()): { status: number; message: string } => {
  const config = loadConfig(root)
  const story = scan(root, config).stories.find(s => s.id === body.story)
  if (!story) return { status: 404, message: `${body.story ?? 'that story'} isn't a story` }
  const storyFile = join(root, story.dir, 'story.md'), specFile = join(root, story.dir, 'spec.md')
  const storyMd = readFileSync(storyFile, 'utf8'), spec = readFileSync(specFile, 'utf8')
  const stale = (text: string) => body.hash !== textHash(text)
  const date = now.toISOString().slice(0, 10)
  const approved = story.front.status !== 'draft'
  // A behaviour change to an approved story is a revision: bump its version and say why.
  const writeSpec = (edit: Edit, why: string, done: string) => {
    if (!edit.ok) return { status: 400, message: edit.reason }
    if (approved) {
      const bump = bumpVersion(storyMd, why, date)
      if (!bump.ok) return { status: 400, message: bump.reason }
      writeFileSync(storyFile, bump.text)
    }
    writeFileSync(specFile, edit.text)
    writeGen(root, scan(root, config).stories)
    return { status: 200, message: approved ? `${done}; ${story.id} is now v${Number(story.front.version) + 1}` : done }
  }

  if (body.op === 'answer') {
    if (stale(spec)) return { status: 409, message: `${story.dir}/spec.md changed since the page read it; reload and try again` }
    const d = story.decisions[body.index ?? -1]
    const kind = body.kind === 'pinned' ? 'pinned' : 'free'
    return writeSpec(answerDecision(spec, body.index ?? -1, body.answer ?? '', kind, config.idPrefix), `answered "${d ? decisionQuestion(d.text) : ''}"`, `Answered "${d ? decisionQuestion(d.text) : ''}"`)
  }
  if (body.op === 'status') {
    if (stale(storyMd)) return { status: 409, message: `${story.dir}/story.md changed since the page read it; reload and try again` }
    if (!STATUSES.includes(body.status ?? '')) return { status: 400, message: `status must be one of ${STATUSES.join(', ')}; done is worked out from proof` }
    const edit = setStatus(storyMd, body.status!)
    if (!edit.ok) return { status: 400, message: edit.reason }
    writeFileSync(storyFile, edit.text)
    return { status: 200, message: `${story.id} is ${body.status}` }
  }
  if (body.op === 'scenario') {
    if (stale(spec)) return { status: 409, message: `${story.dir}/spec.md changed since the page read it; reload and try again` }
    const steps = (body.steps ?? []).map(s => String(s).trim()).filter(Boolean)
    if (body.id) return writeSpec(editScenario(spec, body.id, body.title ?? '', steps), `changed ${body.id}`, `Saved ${body.id}`)
    const added = addScenario(spec, story.id, body.title ?? '', steps)
    return writeSpec(added, `added ${added.ok ? added.id : 'a scenario'}`, `Added ${added.ok ? added.id : 'a scenario'}`)
  }
  return { status: 400, message: `unknown edit "${body.op ?? ''}"` }
}

const send = (res: ServerResponse, status: number, body: unknown, type = 'application/json') => {
  res.writeHead(status, { 'content-type': `${type}; charset=utf-8`, 'cache-control': 'no-store' })
  res.end(typeof body === 'string' ? body : JSON.stringify(body))
}

const readBody = (req: IncomingMessage) => new Promise<string>((resolve, reject) => {
  let data = ''
  req.on('data', c => { data += c; if (data.length > 1_000_000) req.destroy() })
  req.on('end', () => resolve(data))
  req.on('error', reject)
})

/** Starts the server on localhost. Resolves once it is listening. */
export const serveUi = (root: string, opts: UiOptions = {}) => new Promise<Server>((resolve, reject) => {
  const host = opts.host ?? '127.0.0.1'
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost')
      if (req.method === 'GET' && url.pathname === '/') return send(res, 200, page(), 'text/html')
      if (req.method === 'GET' && url.pathname === '/api/state') return send(res, 200, await uiState(root))
      if (req.method === 'POST' && url.pathname === '/api/edit') {
        // Only this page may write: a page on another site can't post to it from a visitor's browser.
        const origin = req.headers.origin
        if (origin && new URL(origin).host !== req.headers.host) return send(res, 403, { message: 'edits come only from the storyspec ui page' })
        const result = applyEdit(root, JSON.parse((await readBody(req)) || '{}') as Body, opts.now?.())
        return send(res, result.status, { message: result.message, ...(result.status === 200 && { state: await uiState(root) }) })
      }
      send(res, 404, { message: 'not found' })
    } catch (e) {
      send(res, 500, { message: (e as Error).message })
    }
  })
  server.once('error', reject)
  server.listen(opts.port ?? 4400, host, () => resolve(server))
})
