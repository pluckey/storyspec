// sync brings a project's agent guidance up to the installed version without touching the project's own text.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { installedVersion, plan, sync } from '../src/sync.js'

const roots: string[] = []
afterEach(() => { for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true }) })
const project = (from?: string) => {
  const root = mkdtempSync(join(tmpdir(), 'storyspec-sync-'))
  if (from) cpSync(from, root, { recursive: true })
  roots.push(root)
  return root
}
const read = (root: string, f: string) => readFileSync(join(root, f), 'utf8')
const actions = (root: string, opts = {}) => Object.fromEntries(sync(root, opts).map(c => [c.file, c.action]))
const v = installedVersion()
const NOTES = '## This project\n\nDeploy with `make deploy`. The billing API is mocked in tests.\n'

describe('sync', () => {
  test('a project without guidance gets AGENTS.md, and nothing for Claude Code unless it uses it', () => {
    const root = project()
    expect(actions(root)).toEqual({ 'AGENTS.md': 'created' })
    const agents = read(root, 'AGENTS.md')
    expect(agents).toMatch(new RegExp(`^# Working in this repo\\n\\n<!-- storyspec:begin ${v.replace(/\./g, '\\.')} sha=[0-9a-f]{16} -->`))
    expect(agents).toContain('## Updating storyspec')
    expect(agents).toContain('## This project')
    expect(existsSync(join(root, 'CLAUDE.md'))).toBe(false)
    // Running it again changes nothing.
    expect(plan(root).map(c => c.action)).toEqual(['unchanged'])
  })

  test('--claude adds CLAUDE.md, the /story command and the hooks', () => {
    const root = project()
    expect(actions(root, { claude: true })).toEqual({ 'AGENTS.md': 'created', 'CLAUDE.md': 'created', '.claude/commands/story.md': 'created', '.claude/settings.json': 'created' })
    expect(read(root, 'CLAUDE.md')).toMatch(/^@AGENTS\.md\n\n<!-- storyspec:begin /)
    expect(read(root, '.claude/commands/story.md')).toMatch(/^---\ndescription: [\s\S]*\n<!-- storyspec:managed \S+ sha=[0-9a-f]{16} -->\n$/)
    const hooks = JSON.parse(read(root, '.claude/settings.json')).hooks
    expect(Object.keys(hooks)).toEqual(['PostToolUse', 'Stop'])
    expect(plan(root).every(c => c.action === 'unchanged')).toBe(true)
  })

  test('an unedited 0.1 project is migrated whole', () => {
    const root = project(join(import.meta.dirname, 'fixtures/v0.1'))
    expect(actions(root)).toEqual({ 'AGENTS.md': 'migrated', 'CLAUDE.md': 'migrated', '.claude/commands/story.md': 'migrated', '.claude/settings.json': 'unchanged' })
    expect(read(root, 'AGENTS.md')).toContain(`<!-- storyspec:begin ${v} `)
    expect(plan(root).every(c => c.action === 'unchanged')).toBe(true)
  })

  test('a 0.1 copy the project added notes to keeps the notes and doesn\'t duplicate the guidance', () => {
    const root = project(join(import.meta.dirname, 'fixtures/v0.1'))
    writeFileSync(join(root, 'AGENTS.md'), read(root, 'AGENTS.md') + '\n' + NOTES)
    const change = sync(root).find(c => c.file === 'AGENTS.md')
    expect(change).toMatchObject({ action: 'migrated' })
    expect(change!.message).toMatch(/notes were kept/)
    const agents = read(root, 'AGENTS.md')
    expect(agents.match(/## Story tests/g)).toHaveLength(1)
    expect(agents.endsWith(`<!-- storyspec:end -->\n\n${NOTES}`)).toBe(true)
  })

  test('an update rewrites only the block: the project\'s notes are kept', () => {
    const root = project()
    sync(root)
    // As if synced by an older version, with notes the project added since.
    writeFileSync(join(root, 'AGENTS.md'), read(root, 'AGENTS.md').replace(/storyspec:begin \S+/, 'storyspec:begin 0.1.9').replace(/## This project[\s\S]*$/, NOTES))
    const [change] = sync(root)
    expect(change).toMatchObject({ file: 'AGENTS.md', action: 'updated', message: `0.1.9 → ${v}` })
    expect(read(root, 'AGENTS.md')).toContain(`storyspec:begin ${v} `)
    expect(read(root, 'AGENTS.md').endsWith(NOTES)).toBe(true)
  })

  test('a block edited by hand is left alone unless forced', () => {
    const root = project()
    sync(root)
    const edited = read(root, 'AGENTS.md').replace('## Story tests', '## Story tests (we use Jest)').replace(/## This project[\s\S]*$/, NOTES)
    writeFileSync(join(root, 'AGENTS.md'), edited)
    const [change] = sync(root)
    expect(change).toMatchObject({ action: 'edited' })
    expect(change!.message).toMatch(/edited by hand/)
    expect(read(root, 'AGENTS.md')).toBe(edited)
    expect(actions(root, { force: true })).toEqual({ 'AGENTS.md': 'updated' })
    expect(read(root, 'AGENTS.md')).not.toContain('we use Jest')
    expect(read(root, 'AGENTS.md').endsWith(NOTES)).toBe(true)
  })

  test('an AGENTS.md of the project\'s own gets the block under its title, with its text kept', () => {
    const root = project()
    writeFileSync(join(root, 'AGENTS.md'), '# Billing service\n\nRun `make test` before pushing.\n')
    expect(actions(root)).toEqual({ 'AGENTS.md': 'updated' })
    expect(read(root, 'AGENTS.md')).toMatch(/^# Billing service\n\n<!-- storyspec:begin [\s\S]*<!-- storyspec:end -->\n\nRun `make test` before pushing\.\n$/)
  })

  test('hooks: storyspec\'s are replaced, everything else in settings is kept', () => {
    const root = project()
    mkdirSync(join(root, '.claude'))
    const lint = { matcher: 'Edit', hooks: [{ type: 'command', command: 'npx eslint --fix' }] }
    writeFileSync(join(root, '.claude/settings.json'), JSON.stringify({
      permissions: { allow: ['Bash(npm test)'] },
      hooks: { PostToolUse: [lint, { matcher: 'Edit', hooks: [{ type: 'command', command: 'npx storyspec gen' }] }], Stop: [{ hooks: [{ type: 'command', command: 'old storyspec trace' }] }] },
    }))
    sync(root)
    const settings = JSON.parse(read(root, '.claude/settings.json'))
    expect(settings.permissions).toEqual({ allow: ['Bash(npm test)'] })
    expect(settings.hooks.PostToolUse[0]).toEqual(lint)
    expect(settings.hooks.PostToolUse).toHaveLength(2)
    expect(settings.hooks.Stop).toHaveLength(1)
    expect(settings.hooks.Stop[0].hooks[0].command).toContain('npx storyspec trace')
    expect(plan(root).find(c => c.file === '.claude/settings.json')?.action).toBe('unchanged')
  })

  test('the /story command is storyspec\'s: an edited one is refused unless forced', () => {
    const root = project()
    sync(root, { claude: true })
    writeFileSync(join(root, '.claude/commands/story.md'), read(root, '.claude/commands/story.md').replace('Work on the story', 'Work carefully on the story'))
    expect(plan(root).find(c => c.file === '.claude/commands/story.md')?.action).toBe('edited')
    expect(actions(root, { force: true })['.claude/commands/story.md']).toBe('updated')
    expect(read(root, '.claude/commands/story.md')).not.toContain('carefully')
  })
})
