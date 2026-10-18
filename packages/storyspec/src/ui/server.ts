// `storyspec ui`: a local web page for people who manage the spec without editing files. The files stay the only
// source of truth: the server reads the repo the way the trace does, and each write is one edit from edit.ts applied
// to one file, refused when the file changed since the page read it (or, to start a story, the folder `storyspec story`
// writes). Git is the history.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig } from '../config.js'
import { addImplementedBy, addPersona, addScenario, answerDecision, bumpVersion, decisionQuestion, editScenario, requirementText, scenarioSteps, setStatus, storyText, textHash, type Edit } from '../edit.js'
import { writeGen } from '../gen.js'
import { trace } from '../index.js'
import { newStory } from '../new-story.js'
import { gitUser, readProof, recordManual } from '../proof.js'
import { PERSONAS_FILE, personaKey } from '../trace/personas.js'
import { scan } from '../trace/scan.js'
import { findProjects, projectsBase } from './projects.js'
import { gridComponent } from './grid.js'
import { formatRoute, parseRoute, say } from './route.js'
import { buildPage } from './view.js'
import { VOCABULARY, type Vocabulary } from './vocabulary.js'
import { followProject } from './watch.js'

export type UiOptions = { port?: number; host?: string; now?: () => Date; base?: string }

const STATUSES = ['draft', 'ready', 'in-progress', 'superseded']

/** The page, with the vocabulary, the route functions and the grid it shares with the server written into its script. */
export const pageHtml = (words: Vocabulary = VOCABULARY) => {
  for (const rel of ['../ui/index.html', '../../ui/index.html']) {
    const p = fileURLToPath(new URL(rel, import.meta.url))
    if (!existsSync(p)) continue
    const shared = [
      `const VOCABULARY = ${JSON.stringify(words).replace(/</g, '\\u003c')};`,
      ...Object.entries({ say, parseRoute, formatRoute, gridComponent }).map(([name, f]) => `const ${name} = ${f.toString()};`),
    ].join('\n')
    return readFileSync(p, 'utf8').replace('/* storyspec:shared */', () => shared)
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

/** Everything the page shows, read fresh from the repo: the stories as the edits need them, and `page`, the screens in
 * the vocabulary's words (view.ts). */
export const uiState = async (root: string, words: Vocabulary = VOCABULARY) => {
  const config = loadConfig(root)
  const result = await trace(root, { write: false })
  const repo = scan(root, config)
  const rows = new Map(result.rows.map(r => [r.story, r]))
  // Each persona with the open decisions it answers and the stories it is served by (superseded ones serve no one).
  const live = repo.stories.filter(s => !config.exemptStatuses.includes(s.front.status ?? ''))
  const personas = repo.personas?.map(p => ({
    ...p,
    stories: live.filter(s => s.personas.includes(p.key)).map(s => s.id),
    decisions: repo.stories.flatMap(s => s.decisions.map((d, index) => ({ story: s.id, index, question: decisionQuestion(d.text), pinnedBy: d.pinnedBy, open: d.open, owner: d.owner })))
      .filter(d => d.open && d.owner === p.key),
  })) ?? null
  const personasFile = join(root, config.storiesDir, PERSONAS_FILE)
  const stories = repo.stories.map(s => {
    const storyMd = readFileSync(join(root, s.dir, 'story.md'), 'utf8')
    const steps = scenarioSteps(s.spec, config.idPrefix)
    const row = rows.get(s.id)
    return {
      id: s.id, dir: s.dir, title: s.front.title ?? '', epic: s.front.epic ?? '', status: row?.status ?? s.front.status ?? '',
      written: s.front.status ?? '', version: s.front.version ?? '', trigger: s.trigger[0] ?? '', emits: s.emits, after: s.after, personas: s.personas, implementedBy: s.implementedBy,
      text: storyText(storyMd), requirement: requirementText(s.spec, s.id),
      hashes: { story: textHash(storyMd), spec: textHash(s.spec) },
      decisions: s.decisions.map(d => ({ ...d, question: decisionQuestion(d.text) })),
      scenarios: (row?.scenarios ?? []).map(sc => ({ ...sc, steps: steps[sc.id] ?? [], hash: s.scenarios.find(x => x.id === sc.id)?.hash ?? '' })),
    }
  })
  const page = buildPage({ root, config, repo, rows: result.rows, findings: result.findings, ports: result.ports, proof: readProof(repo), ...(personas && { personas }) }, words)
  return {
    project: basename(root), storiesDir: config.storiesDir, ok: result.ok, findings: result.findings, stories,
    model: repo.model ?? null, personas, personasHash: textHash(existsSync(personasFile) ? readFileSync(personasFile, 'utf8') : ''),
    changes: changes(root, config.storiesDir), you: gitUser(root) ?? null, page,
  }
}

type Body = {
  op?: string; story?: string; hash?: string; index?: number; answer?: string; kind?: string; status?: string; id?: string; title?: string; steps?: string[]
  name?: string; prose?: string; epic?: string; persona?: string; outcome?: string; note?: string; file?: string
}

/** Applies one edit from the page. Returns the HTTP status and a message. */
export const applyEdit = (root: string, body: Body, now: Date = new Date()): { status: number; message: string } => {
  const config = loadConfig(root)
  // Edits that aren't to one story: PERSONAS.md, and a new story for a persona.
  if (body.op === 'persona') {
    const file = join(root, config.storiesDir, PERSONAS_FILE)
    const text = existsSync(file) ? readFileSync(file, 'utf8') : ''
    if (body.hash !== textHash(text)) return { status: 409, message: `${config.storiesDir}/${PERSONAS_FILE} changed since the page read it; reload and try again` }
    const edit = addPersona(text, body.name ?? '', body.prose ?? '')
    if (!edit.ok) return { status: 400, message: edit.reason }
    writeFileSync(file, edit.text)
    return { status: 200, message: `Added ${body.name!.trim()} to ${PERSONAS_FILE}` }
  }
  if (body.op === 'story') {
    const title = (body.title ?? '').trim().replace(/\s+/g, ' ')
    if (!title) return { status: 400, message: 'give the story a title' }
    const persona = body.persona?.trim() ? personaKey(body.persona) : undefined
    const { id } = newStory(root, config, title, (body.epic ?? '').trim(), now, persona)
    writeGen(root, scan(root, config).stories)
    return { status: 200, message: `Started ${id}${persona ? ` for ${persona}` : ''}, a draft: write its scenarios next` }
  }
  if (body.op === 'prove') {
    // A check by hand, recorded by the same function as `storyspec prove`, naming whom git names, as it does. The hash
    // is the scenario's text as the page showed it: a check of other wording would prove the wrong thing.
    const repo = scan(root, config)
    const sc = repo.stories.flatMap(s => s.scenarios).find(x => x.id === body.id)
    if (!sc) return { status: 404, message: `${body.id ?? 'that'} isn't a scenario` }
    if (body.hash !== sc.hash) return { status: 409, message: `${sc.id} changed since the page read it; reload and read it again` }
    const failed = body.outcome === 'fail', note = body.note?.trim(), by = gitUser(root)
    try {
      recordManual(repo, sc.id, 'manual', { outcome: failed ? 'fail' : 'pass', at: now.toISOString(), ...(by && { by }), ...(note && { note }) })
    } catch (e) { return { status: 400, message: (e as Error).message } }
    return { status: 200, message: `Recorded ${failed ? 'a failure' : 'proof'} in the manual tier for ${sc.id}${by ? ` (by ${by})` : ''}` }
  }
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
  if (body.op === 'claim') {
    // Claiming names the file in story.md's implementedBy:; the code itself isn't touched.
    if (stale(storyMd)) return { status: 409, message: `${story.dir}/story.md changed since the page read it; reload and try again` }
    const file = (body.file ?? '').trim()
    if (!scan(root, config).codeFiles.includes(file)) return { status: 400, message: `${file || 'that'} isn't a code file in this project` }
    const edit = addImplementedBy(storyMd, file)
    if (!edit.ok) return { status: 400, message: edit.reason }
    writeFileSync(storyFile, edit.text)
    return { status: 200, message: `${story.id} now claims ${file}` }
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

/** Starts the server on localhost for the projects in `start`'s folder (see projects.ts). Resolves once it is listening. */
export const serveUi = (start: string, opts: UiOptions = {}) => new Promise<Server>((resolve, reject) => {
  const host = opts.host ?? '127.0.0.1'
  const base = opts.base ?? projectsBase(start)
  // A request names its project by id; only a listed project is reachable, so nothing outside the folder is.
  const projects = () => {
    const all = findProjects(base)
    const first = all.find(p => p.root === start) ?? all[0]
    return { all, first }
  }
  const rootFor = (id: string | null | undefined) => {
    const { all, first } = projects()
    return id ? all.find(p => p.id === id)?.root : first?.root
  }
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost')
      if (req.method === 'GET' && url.pathname === '/') return send(res, 200, pageHtml(), 'text/html')
      if (req.method === 'GET' && url.pathname === '/api/projects') {
        const { all, first } = projects()
        return send(res, 200, { folder: base, first: first?.id ?? null, projects: all.map(({ root: _, ...p }) => p) })
      }
      if (req.method === 'GET' && url.pathname === '/api/state') {
        const root = rootFor(url.searchParams.get('project'))
        return root ? send(res, 200, await uiState(root)) : send(res, 404, { message: `no storyspec project "${url.searchParams.get('project') ?? ''}" in ${base}` })
      }
      if (req.method === 'GET' && url.pathname === '/api/events') {
        // Server-sent events: one `change` per batch of changed files, so the page reads the project again.
        const root = rootFor(url.searchParams.get('project'))
        if (!root) return send(res, 404, { message: `no storyspec project "${url.searchParams.get('project') ?? ''}" in ${base}` })
        res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', connection: 'keep-alive' })
        res.write('retry: 2000\n\n')
        const stop = followProject(root, files => res.write(`event: change\ndata: ${JSON.stringify({ files })}\n\n`))
        const beat = setInterval(() => res.write(': still here\n\n'), 25_000)
        req.on('close', () => { stop(); clearInterval(beat) })
        return
      }
      if (req.method === 'POST' && url.pathname === '/api/edit') {
        // Only this page may write: a page on another site can't post to it from a visitor's browser.
        const origin = req.headers.origin
        if (origin && new URL(origin).host !== req.headers.host) return send(res, 403, { message: 'edits come only from the storyspec ui page' })
        const body = JSON.parse((await readBody(req)) || '{}') as Body & { project?: string }
        const root = rootFor(body.project)
        if (!root) return send(res, 404, { message: `no storyspec project "${body.project ?? ''}" in ${base}` })
        const result = applyEdit(root, body, opts.now?.())
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
