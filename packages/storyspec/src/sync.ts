// `storyspec sync`: brings a project's agent guidance up to the installed storyspec version. The guidance lives in
// this package (agent/); a project holds a copy inside marked blocks, each stamped with the version it came from and a
// hash of its text. That stamp is how sync knows a block is stale (another version) or was edited by hand (the hash no
// longer matches), so it can update the first and refuse to overwrite the second. Text outside the blocks is the
// project's own and is never touched.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))
export const installedVersion = (): string => (JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as { version: string }).version
const guidance = (name: string) => readFileSync(join(packageRoot, 'agent', name), 'utf8')

const hash = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 16)

// What storyspec 0.1's template copied into projects, unedited. A file still exactly like this is replaced whole.
const UNEDITED_0_1: Record<string, string> = {
  'AGENTS.md': '1d37d31ae60d3ed7',
  'CLAUDE.md': '95bb15378cab5a9b',
  '.claude/commands/story.md': 'bad59880ffb90653',
}

const BEGIN = /<!-- storyspec:begin (\S+) sha=([0-9a-f]+) -->\n/
const END = '<!-- storyspec:end -->'
const NOTE = '<!-- Managed by storyspec. `npx storyspec sync` rewrites this block from the installed version; put project notes outside it. -->\n'
const OWNED = /\n<!-- storyspec:managed (\S+) sha=([0-9a-f]+) -->\n?$/

const block = (content: string, version: string) => {
  const inner = NOTE + content.replace(/\n*$/, '\n')
  return `<!-- storyspec:begin ${version} sha=${hash(inner)} -->\n${inner}${END}`
}

type Found = { version: string; edited: boolean; start: number; end: number } | undefined
const findBlock = (text: string): Found => {
  const m = BEGIN.exec(text)
  if (!m) return undefined
  const innerStart = m.index + m[0].length
  const endAt = text.indexOf(END, innerStart)
  if (endAt < 0) return { version: m[1]!, edited: true, start: m.index, end: text.length }
  return { version: m[1]!, edited: hash(text.slice(innerStart, endAt)) !== m[2], start: m.index, end: endAt + END.length }
}

export type SyncAction = 'created' | 'updated' | 'migrated' | 'unchanged' | 'edited'
export type SyncChange = { file: string; action: SyncAction; message?: string; next?: string }

// A file whose storyspec part is a block inside the project's own text.
const blockFile = (file: string, existing: string | undefined, content: string, version: string, force: boolean, fresh: (b: string) => string,
  adopt: (text: string, b: string) => string): SyncChange => {
  const b = block(content, version)
  if (existing === undefined) return { file, action: 'created', next: fresh(b) }
  if (hash(existing) === UNEDITED_0_1[file]) return { file, action: 'migrated', next: fresh(b), message: 'was the unedited storyspec 0.1 copy; replaced with a managed block' }
  const found = findBlock(existing)
  if (!found) return { file, action: 'updated', next: adopt(existing, b), message: 'added the storyspec block; check your own text beside it for anything it now duplicates' }
  const next = existing.slice(0, found.start) + b + existing.slice(found.end)
  if (found.edited) return force ? { file, action: 'updated', next, message: 'replaced the hand-edited block (--force)' }
    : { file, action: 'edited', message: `the storyspec block was edited by hand (it no longer matches its ${found.version} stamp). Move your notes outside the block, or run sync --force to replace it` }
  return next === existing ? { file, action: 'unchanged' } : { file, action: 'updated', next, message: `${found.version} → ${version}` }
}

// A file storyspec owns entirely, stamped on its last line.
const ownedFile = (file: string, existing: string | undefined, content: string, version: string, force: boolean): SyncChange => {
  const body = content.replace(/\n*$/, '\n')
  const next = `${body}\n<!-- storyspec:managed ${version} sha=${hash(body)} -->\n`
  if (existing === undefined) return { file, action: 'created', next }
  if (hash(existing) === UNEDITED_0_1[file]) return { file, action: 'migrated', next, message: 'was the unedited storyspec 0.1 copy' }
  const m = OWNED.exec(existing)
  // The stamp follows the content after one blank line; the hash covers the content alone.
  if (!m || hash(existing.slice(0, m.index)) !== m[2])
    return force ? { file, action: 'updated', next, message: 'replaced the hand-edited file (--force)' }
      : { file, action: 'edited', message: 'storyspec owns this file but it was edited by hand. Run sync --force to replace it' }
  return existing === next ? { file, action: 'unchanged' } : { file, action: 'updated', next, message: `${m[1]} → ${version}` }
}

// Claude Code hooks: typecheck after edits, run the trace when the agent stops. Hooks whose command runs storyspec are
// storyspec's; every other hook and setting is kept as it is.
const HOOKS = {
  PostToolUse: [{ matcher: 'Edit|Write|MultiEdit', hooks: [{ type: 'command', command: 'cd "$CLAUDE_PROJECT_DIR" && npx storyspec gen >/dev/null && npx tsc --noEmit 1>&2 || exit 2' }] }],
  Stop: [{ hooks: [{ type: 'command', command: 'cd "$CLAUDE_PROJECT_DIR" && npx storyspec trace 1>&2 || exit 2' }] }],
}
type HookGroup = { matcher?: string; hooks: { type: string; command: string }[] }
const settingsFile = (existing: string | undefined): SyncChange => {
  const file = '.claude/settings.json'
  let settings: { hooks?: Record<string, HookGroup[]> } & Record<string, unknown> = {}
  if (existing !== undefined) {
    try { settings = JSON.parse(existing) } catch { return { file, action: 'edited', message: 'is not valid JSON; fix it, then run sync again' } }
  }
  const hooks: Record<string, HookGroup[]> = { ...settings.hooks }
  for (const [event, groups] of Object.entries(hooks)) {
    const kept = groups.map(g => ({ ...g, hooks: g.hooks.filter(h => !/\bstoryspec\b/.test(h.command)) })).filter(g => g.hooks.length)
    if (kept.length) hooks[event] = kept
    else delete hooks[event]
  }
  for (const [event, groups] of Object.entries(HOOKS)) hooks[event] = [...hooks[event] ?? [], ...groups]
  const next = JSON.stringify({ ...settings, hooks }, null, 2) + '\n'
  if (existing === undefined) return { file, action: 'created', next }
  return JSON.stringify(JSON.parse(existing)) === JSON.stringify(JSON.parse(next)) ? { file, action: 'unchanged' } : { file, action: 'updated', next }
}

/** What sync would do in `root`. Claude Code files are included when the project uses Claude Code (CLAUDE.md or .claude/ exists) or `claude` is set. */
export const plan = (root: string, opts: { claude?: boolean; force?: boolean } = {}): SyncChange[] => {
  const v = installedVersion(), force = !!opts.force
  const read = (f: string) => existsSync(join(root, f)) ? readFileSync(join(root, f), 'utf8') : undefined
  const changes = [blockFile('AGENTS.md', read('AGENTS.md'), guidance('AGENTS.md'), v, force,
    b => `# Working in this repo\n\n${b}\n\n## This project\n\nNotes for agents about this repo go here, outside the storyspec block, so updates keep them.\n`,
    (text, b) => {
      const h1 = /^# .*\n/.exec(text)
      return h1 ? `${h1[0]}\n${b}\n\n${text.slice(h1[0].length).replace(/^\n+/, '')}` : `${b}\n\n${text}`
    })]
  const claude = opts.claude || existsSync(join(root, 'CLAUDE.md')) || existsSync(join(root, '.claude'))
  if (claude) changes.push(
    blockFile('CLAUDE.md', read('CLAUDE.md'), guidance('CLAUDE.md'), v, force, b => `@AGENTS.md\n\n${b}\n`,
      (text, b) => `${/^@AGENTS\.md$/m.test(text) ? '' : '@AGENTS.md\n\n'}${text.replace(/\n*$/, '\n')}\n${b}\n`),
    ownedFile('.claude/commands/story.md', read('.claude/commands/story.md'), guidance('commands/story.md'), v, force),
    settingsFile(read('.claude/settings.json')),
  )
  return changes
}

/** Writes what `plan` found. Files edited by hand are left alone unless `force`. */
export const sync = (root: string, opts: { claude?: boolean; force?: boolean } = {}): SyncChange[] => {
  const changes = plan(root, opts)
  for (const c of changes) if (c.next !== undefined) {
    mkdirSync(dirname(join(root, c.file)), { recursive: true })
    writeFileSync(join(root, c.file), c.next)
  }
  return changes
}
