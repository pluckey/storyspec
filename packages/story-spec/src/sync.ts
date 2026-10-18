// `story-spec sync`: brings a project's agent guidance up to the installed story-spec version. The guidance lives in
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
// The text storyspec 0.1's template copied into projects (agent/legacy): a file equal to it was never edited and is
// replaced whole; a file that starts with it had notes added, which are kept.
const legacyText = (file: string) => {
  const p = join(packageRoot, 'agent', 'legacy', '0.1', file)
  return existsSync(p) ? readFileSync(p, 'utf8') : undefined
}

const hash = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 16)

// Markers name the framework. Releases before the rename wrote `storyspec:`; those blocks are still found, and replaced
// with the new markers like any stale block.
const BEGIN = /<!-- (story-spec|storyspec):begin (\S+) sha=([0-9a-f]+) -->\n/
const end = (name: string) => `<!-- ${name}:end -->`
const END = end('story-spec')
const NOTE = '<!-- Managed by story-spec. `npx story-spec sync` rewrites this block from the installed version; put project notes outside it. -->\n'
const OWNED = /\n<!-- (story-spec|storyspec):managed (\S+) sha=([0-9a-f]+) -->\n?$/

const block = (content: string, version: string) => {
  const inner = NOTE + content.replace(/\n*$/, '\n')
  return `<!-- story-spec:begin ${version} sha=${hash(inner)} -->\n${inner}${END}`
}

// `from`: the version a block was stamped with, and the old name when its markers carry it.
const stamped = (name: string, version: string) => name === 'story-spec' ? version : `storyspec ${version}`

type Found = { version: string; from: string; edited: boolean; start: number; end: number } | undefined
const findBlock = (text: string): Found => {
  const m = BEGIN.exec(text)
  if (!m) return undefined
  const [, name, version, sha] = m as unknown as [string, string, string, string]
  const innerStart = m.index + m[0].length
  const endAt = text.indexOf(end(name), innerStart)
  const from = stamped(name, version)
  if (endAt < 0) return { version, from, edited: true, start: m.index, end: text.length }
  return { version, from, edited: hash(text.slice(innerStart, endAt)) !== sha, start: m.index, end: endAt + end(name).length }
}

export type SyncAction = 'created' | 'updated' | 'migrated' | 'unchanged' | 'edited'
export type SyncChange = { file: string; action: SyncAction; message?: string; next?: string }

// A file whose story-spec part is a block inside the project's own text.
const blockFile = (file: string, existing: string | undefined, content: string, version: string, force: boolean,
  layout: { fresh: (b: string) => string; withNotes: (b: string, notes: string) => string; adopt: (text: string, b: string) => string }): SyncChange => {
  const { fresh, withNotes, adopt } = layout
  const b = block(content, version)
  if (existing === undefined) return { file, action: 'created', next: fresh(b) }
  const legacy = legacyText(file)
  if (existing === legacy) return { file, action: 'migrated', next: fresh(b), message: 'was the unedited storyspec 0.1 copy; replaced with a managed block' }
  if (legacy !== undefined && existing.startsWith(legacy) && existing.length > legacy.length && !findBlock(existing))
    return { file, action: 'migrated', next: withNotes(b, existing.slice(legacy.length).trim()), message: 'was the storyspec 0.1 copy plus your notes; the copy became the managed block and your notes were kept after it' }
  const found = findBlock(existing)
  if (!found) return { file, action: 'updated', next: adopt(existing, b), message: 'added the story-spec block; check your own text beside it for anything it now duplicates' }
  const next = existing.slice(0, found.start) + b + existing.slice(found.end)
  if (found.edited) return force ? { file, action: 'updated', next, message: 'replaced the hand-edited block (--force)' }
    : { file, action: 'edited', message: `the story-spec block was edited by hand (it no longer matches its ${found.from} stamp). Move your notes outside the block, or run sync --force to replace it` }
  return next === existing ? { file, action: 'unchanged' } : { file, action: 'updated', next, message: `${found.from} → ${version}` }
}

// A file story-spec owns entirely, stamped on its last line.
const ownedFile = (file: string, existing: string | undefined, content: string, version: string, force: boolean): SyncChange => {
  const body = content.replace(/\n*$/, '\n')
  const next = `${body}\n<!-- story-spec:managed ${version} sha=${hash(body)} -->\n`
  if (existing === undefined) return { file, action: 'created', next }
  if (existing === legacyText(file)) return { file, action: 'migrated', next, message: 'was the unedited storyspec 0.1 copy' }
  const m = OWNED.exec(existing)
  // The stamp follows the content after one blank line; the hash covers the content alone.
  if (!m || hash(existing.slice(0, m.index)) !== m[3])
    return force ? { file, action: 'updated', next, message: 'replaced the hand-edited file (--force)' }
      : { file, action: 'edited', message: 'story-spec owns this file but it was edited by hand. Run sync --force to replace it' }
  return existing === next ? { file, action: 'unchanged' } : { file, action: 'updated', next, message: `${stamped(m[1]!, m[2]!)} → ${version}` }
}

// Claude Code hooks: typecheck after edits, run the trace when the agent stops. Hooks whose command runs story-spec are
// story-spec's; every other hook and setting is kept as it is.
const HOOKS = {
  PostToolUse: [{ matcher: 'Edit|Write|MultiEdit', hooks: [{ type: 'command', command: 'cd "$CLAUDE_PROJECT_DIR" && npx story-spec gen >/dev/null && npx tsc --noEmit 1>&2 || exit 2' }] }],
  Stop: [{ hooks: [{ type: 'command', command: 'cd "$CLAUDE_PROJECT_DIR" && npx story-spec trace 1>&2 || exit 2' }] }],
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
    // Hooks written before the rename ran `storyspec`; they are replaced too.
    const kept = groups.map(g => ({ ...g, hooks: g.hooks.filter(h => !/\bstory-?spec\b/.test(h.command)) })).filter(g => g.hooks.length)
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
  const changes = [blockFile('AGENTS.md', read('AGENTS.md'), guidance('AGENTS.md'), v, force, {
    fresh: b => `# Working in this repo\n\n${b}\n\n## This project\n\nNotes for agents about this repo go here, outside the story-spec block, so updates keep them.\n`,
    withNotes: (b, notes) => `# Working in this repo\n\n${b}\n\n${notes}\n`,
    adopt: (text, b) => {
      const h1 = /^# .*\n/.exec(text)
      return h1 ? `${h1[0]}\n${b}\n\n${text.slice(h1[0].length).replace(/^\n+/, '')}` : `${b}\n\n${text}`
    },
  })]
  const claude = opts.claude || existsSync(join(root, 'CLAUDE.md')) || existsSync(join(root, '.claude'))
  if (claude) changes.push(
    blockFile('CLAUDE.md', read('CLAUDE.md'), guidance('CLAUDE.md'), v, force, {
      fresh: b => `@AGENTS.md\n\n${b}\n`,
      withNotes: (b, notes) => `@AGENTS.md\n\n${b}\n\n${notes}\n`,
      adopt: (text, b) => `${/^@AGENTS\.md$/m.test(text) ? '' : '@AGENTS.md\n\n'}${text.replace(/\n*$/, '\n')}\n${b}\n`,
    }),
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
