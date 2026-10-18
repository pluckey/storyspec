import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect } from 'vitest'
import { story } from 'story-spec/vitest'
import { defaults, loadConfig, renderGen, scan, sync, syncPlan, trace } from '../../packages/story-spec/src/index.js'
import { edit, pythonProject } from '../../test/python-project.js'
import { files, OLD_STORY, oldProject } from '../../test/old-project.js'
import { gen } from './scenarios.gen.js'

const repo = join(import.meta.dirname, '../..')
const pkg = join(repo, 'packages/story-spec')
const read = (root: string, f: string) => readFileSync(join(root, f), 'utf8')
const json = (root: string, f: string) => JSON.parse(read(root, f))
const cli = join(pkg, json(pkg, 'package.json').bin['story-spec'])
const run = (root: string, ...args: string[]) => {
  const r = spawnSync('node', [cli, ...args, '--root', root], { encoding: 'utf8' })
  return { code: r.status, out: r.stdout, err: r.stderr }
}
const cleanup: (() => void)[] = []
afterEach(() => { for (const c of cleanup.splice(0)) c() })

/** The files a sentence may come from (S-024.10), and in README.md the migration note, the one place the old name is said. */
const NOTE = /^## Moving from storyspec$/m
const outsideNote = (text: string) => {
  const at = text.search(NOTE)
  if (at < 0) return text
  const rest = text.slice(at).replace(NOTE, '')
  const next = rest.search(/^## /m)
  return text.slice(0, at) + (next < 0 ? '' : rest.slice(next))
}
const oldNamed = (text: string) => text.split('\n').filter(l => /storyspec/i.test(l))

story(gen, {
  'S-024.1': () => {
    const { code, out } = run(repo, '--help')
    expect(code).toBe(0)
    expect(out).toContain('Usage:')
    const commands = out.split('\n').filter(l => /^ {2}\S/.test(l) && !l.startsWith('  --'))
    expect(commands.length).toBeGreaterThan(5)
    for (const l of commands) expect(l).toMatch(/^ {2}story-spec [a-z]+/)
    expect(oldNamed(out)).toEqual([])
  },

  'S-024.2': async () => {
    const root = pythonProject()
    expect(existsSync(join(root, 'story-spec.config.json'))).toBe(true)
    edit(root, 'story-spec.config.json', s => JSON.stringify({ ...JSON.parse(s), storiesDir: 'elsewhere' }))
    expect((await trace(root, { write: false })).rows).toEqual([])
    mkdirSync(join(root, 'elsewhere'))
    const { out, err } = run(root, 'trace', '--no-run', '--json')
    expect(JSON.parse(out).rows).toEqual([])
    expect(err).not.toMatch(/storyspec/)
    // The schema is served as story-spec/config.schema.json, and a new project's editor finds it there.
    const exported = json(pkg, 'package.json').exports['./config.schema.json']
    expect(exported).toBe('./schema/story-spec.config.schema.json')
    expect(json(pkg, exported).title).toBe('story-spec config')
    expect(json(join(repo, 'template'), 'story-spec.config.json').$schema).toBe('./node_modules/story-spec/schema/story-spec.config.schema.json')
  },

  'S-024.3': async () => {
    const root = pythonProject()
    renameSync(join(root, 'story-spec.config.json'), join(root, 'storyspec.config.json'))
    edit(root, 'storyspec.config.json', s => JSON.stringify({ ...JSON.parse(s), storiesDir: 'elsewhere' }))
    // The setting is read: no stories where it points. The findings of a project with none don't matter here.
    mkdirSync(join(root, 'elsewhere'))
    const { out, err } = run(root, 'trace', '--no-run', '--json')
    expect(JSON.parse(out).rows).toEqual([])
    const warnings = err.split('\n').filter(l => l.includes('storyspec.config.json'))
    expect(warnings).toEqual(['storyspec.config.json is the old name of story-spec.config.json; rename it, and the rest of the project, with: npx story-spec migrate'])
    // The library reads it too, and warns once per project however often it loads.
    expect(loadConfig(root).storiesDir).toBe('elsewhere')
    // A whole 0.8 project keeps passing its check until it migrates: the generated files 0.8 wrote are still fresh.
    const old = oldProject()
    expect(run(old, 'gen', '--check')).toMatchObject({ code: 0 })
  },

  'S-024.4': async () => {
    expect(defaults.testCommand).toContain('--outputFile=.story-spec/vitest.json')
    expect(defaults.testReport).toBe('.story-spec/vitest.json')
    expect(defaults.ignore).toContain('.story-spec')
    // A file in the state folder is never read as the project's code, with the default ignore list.
    const root = pythonProject()
    edit(root, 'story-spec.config.json', s => { const { ignore: _, ...c } = JSON.parse(s); return JSON.stringify(c) })
    writeFileSync(join(root, 'app/extra.py'), 'x = 1\n')
    writeFileSync(join(root, '.story-spec/stray.py'), 'y = 2\n')
    const unclaimed = (await trace(root, { write: false })).findings.filter(f => f.rule === 'unclaimed-code').map(f => f.file)
    expect(unclaimed).toEqual(['app/extra.py'])
    // A new project ignores it in git, and this repo's checker is installed there.
    expect(read(join(repo, 'template'), '.gitignore').split('\n')).toContain('.story-spec/')
    const plan = JSON.parse(execFileSync('node', [join(repo, 'scripts/self-check.mjs'), '--plan'], { encoding: 'utf8', env: { ...process.env, STORY_SPEC_CHECKER: '', STORY_SPEC_PUBLISHED: 'storyspec' } }))
    expect(plan.dir).toBe('.story-spec/released')
  },

  'S-024.5': () => {
    // This file imports story from story-spec/vitest, and its cases are running.
    expect(read(import.meta.dirname, 'rename.test.ts')).toContain(`import { story } from 'story-spec/vitest'`)
    expect(json(pkg, 'package.json').exports['./vitest']).toEqual({ types: './dist/vitest.d.ts', import: './dist/vitest.js' })
    const s = scan(repo, loadConfig(repo)).stories.find(x => x.id === 'S-024')!
    const generated = renderGen(s)
    expect(generated.split('\n')[0]).toBe('// Generated by `story-spec gen` from spec.md. Do not edit.')
    expect(read(import.meta.dirname, 'scenarios.gen.ts')).toBe(generated)
    // The template's tests, which every new project starts from, import it too.
    const template = join(repo, 'template/stories')
    const tests = readdirSync(template, { recursive: true }).map(String).filter(f => f.endsWith('.test.ts'))
    expect(tests.length).toBeGreaterThan(0)
    for (const t of tests) expect(read(template, t)).toContain(`from 'story-spec/vitest'`)
  },

  'S-024.6': () => {
    const root = oldProject()
    const { code, out } = run(root, 'migrate')
    expect(code).toBe(0)
    expect(existsSync(join(root, 'storyspec.config.json'))).toBe(false)
    expect(json(root, 'story-spec.config.json').$schema).toBe('./node_modules/story-spec/schema/story-spec.config.schema.json')
    expect(existsSync(join(root, '.storyspec'))).toBe(false)
    expect(existsSync(join(root, '.story-spec/vitest.json'))).toBe(true)
    expect(read(root, `${OLD_STORY}/save-note.test.ts`)).toContain(`import { story } from 'story-spec/vitest'`)
    expect(read(root, `${OLD_STORY}/scenarios.gen.ts`)).toMatch(/^\/\/ Generated by `story-spec gen`/)
    for (const f of ['AGENTS.md', 'CLAUDE.md']) {
      expect(read(root, f)).toMatch(/<!-- story-spec:begin \S+ sha=[0-9a-f]{16} -->[\s\S]*<!-- story-spec:end -->/)
      expect(read(root, f)).not.toContain('storyspec:')
    }
    expect(read(root, '.claude/commands/story.md')).toMatch(/<!-- story-spec:managed \S+ sha=[0-9a-f]{16} -->\n$/)
    expect(read(root, '.claude/settings.json')).not.toContain('storyspec')
    expect(syncPlan(root).every(c => c.action === 'unchanged')).toBe(true)
    // The project's own text outside the blocks is kept.
    expect(read(root, 'AGENTS.md')).toContain('## This project')
    // package.json and .gitignore name the new package and folder.
    expect(json(root, 'package.json').devDependencies).toMatchObject({ 'story-spec': '*' })
    expect(json(root, 'package.json').devDependencies).not.toHaveProperty('storyspec')
    expect(json(root, 'package.json').scripts.check).toBe('story-spec gen --check && tsc --noEmit && story-spec trace')
    expect(read(root, '.gitignore')).toBe('node_modules/\n.story-spec/\n')
    // The report lists each file changed.
    const reported = out.split('\n').filter(l => /^\S+: /.test(l)).map(l => l.slice(0, l.indexOf(': ')))
    expect(reported.sort()).toEqual([
      '.claude/commands/story.md', '.claude/settings.json', '.gitignore', '.storyspec/', 'AGENTS.md', 'CLAUDE.md',
      'package.json', 'story-spec.config.json', 'storyspec.config.json',
      `${OLD_STORY}/save-note.test.ts`, `${OLD_STORY}/scenarios.gen.ts`,
    ].sort())
  },

  'S-024.7': () => {
    const root = oldProject()
    expect(run(root, 'migrate').code).toBe(0)
    const before = files(root)
    const again = run(root, 'migrate')
    expect(again.code).toBe(0)
    expect(again.out.trim()).toBe('Nothing to migrate.')
    expect(files(root)).toEqual(before)
  },

  'S-024.8': () => {
    const app = join(mkdtempSync(join(tmpdir(), 'story-spec-create-')), 'my-app')
    cleanup.push(() => rmSync(join(app, '..'), { recursive: true, force: true }))
    const creator = join(repo, 'packages/create-story-spec')
    expect(json(creator, 'package.json')).toMatchObject({ name: 'create-story-spec', bin: { 'create-story-spec': 'index.js' } })
    execFileSync('node', [join(creator, 'index.js'), app, '--no-install'], { stdio: 'ignore' })
    const app_ = json(app, 'package.json')
    expect(app_.devDependencies['story-spec']).toBe(`file:${pkg}`)
    expect(app_.devDependencies).not.toHaveProperty('storyspec')
    expect(app_.scripts.check).toBe('story-spec gen --check && tsc --noEmit && story-spec trace')
    expect(existsSync(join(app, 'story-spec.config.json'))).toBe(true)
    expect(existsSync(join(app, 'storyspec.config.json'))).toBe(false)
    const tests = readdirSync(join(app, 'stories'), { recursive: true }).map(String).filter(f => f.endsWith('.test.ts'))
    expect(tests.length).toBeGreaterThan(0)
    for (const t of tests) expect(read(join(app, 'stories'), t)).toContain(`from 'story-spec/vitest'`)
    // `npm run check` in it needs an install; npm test runs it on template/, the app's source (as CI's smoke test does on
    // an app made from the packed packages). Here: what the check reads is the template's own, renamed.
    expect(read(app, 'AGENTS.md')).toContain('<!-- story-spec:begin ')
    expect(read(app, '.gitignore').split('\n')).toContain('.story-spec/')
  },

  'S-024.9': () => {
    const agent = join(pkg, 'agent')
    const bundled = readdirSync(agent, { recursive: true }).map(String)
      .filter(f => !f.startsWith('legacy') && f.endsWith('.md'))
    expect(bundled.sort()).toEqual(['AGENTS.md', 'CLAUDE.md', 'commands/story.md'])
    for (const f of bundled) expect(oldNamed(read(agent, f))).toEqual([])
    // What sync writes: the blocks, the /story command and its hooks.
    const fresh = mkdtempSync(join(tmpdir(), 'story-spec-guidance-'))
    cleanup.push(() => rmSync(fresh, { recursive: true, force: true }))
    sync(fresh, { claude: true })
    for (const f of ['AGENTS.md', 'CLAUDE.md', '.claude/commands/story.md', '.claude/settings.json']) expect(oldNamed(read(fresh, f))).toEqual([])
    expect(read(fresh, 'AGENTS.md')).toMatch(/<!-- story-spec:begin \S+ sha=[0-9a-f]{16} -->\n[\s\S]*\n<!-- story-spec:end -->/)
    // A block with the old markers is recognised: replaced when it is as 0.8 wrote it, refused when edited by hand.
    const root = oldProject()
    expect(syncPlan(root).find(c => c.file === 'AGENTS.md')).toMatchObject({ action: 'updated', message: expect.stringMatching(/^storyspec 0\.8\.0 → /) })
    sync(root)
    expect(read(root, 'AGENTS.md').match(/story-spec:begin/g)).toHaveLength(1)
    expect(read(root, 'AGENTS.md')).not.toContain('storyspec:')
    const edited = oldProject()
    edit(edited, 'AGENTS.md', s => s.replace('## Story tests', '## Story tests (ours)'))
    expect(syncPlan(edited).find(c => c.file === 'AGENTS.md')).toMatchObject({ action: 'edited', message: expect.stringContaining('storyspec 0.8.0 stamp') })
  },

  'S-024.10': () => {
    const docs = readdirSync(join(repo, 'docs')).filter(f => f.endsWith('.md')).map(f => `docs/${f}`)
    const workflows = readdirSync(join(repo, '.github/workflows')).map(f => `.github/workflows/${f}`)
    const read_ = ['README.md', 'CONTRIBUTING.md', ...docs, ...workflows, 'package.json',
      'packages/story-spec/package.json', 'packages/create-story-spec/package.json', 'packages/story-spec/README.md', 'packages/create-story-spec/README.md']
    expect(docs.length).toBeGreaterThan(0)
    expect(workflows).toEqual(expect.arrayContaining(['.github/workflows/ci.yml', '.github/workflows/release.yml']))
    const mentions = read_.flatMap(f => oldNamed(f.endsWith('README.md') ? outsideNote(read(repo, f)) : read(repo, f)).map(l => `${f}: ${l}`))
    expect(mentions).toEqual([])
    // The migration note is there, and says how to move.
    expect(read(repo, 'README.md')).toMatch(NOTE)
    expect(read(repo, 'README.md')).toContain('npx story-spec migrate')
    for (const p of ['packages/story-spec', 'packages/create-story-spec']) {
      const m = json(repo, `${p}/package.json`)
      expect(m.repository).toEqual({ type: 'git', url: 'git+https://github.com/pluckey/story-spec.git', directory: p })
      expect(m.homepage).toBe('https://github.com/pluckey/story-spec#readme')
    }
    expect(json(pkg, 'package.json')).toMatchObject({ name: 'story-spec', bin: { 'story-spec': 'dist/cli.js' } })
    const scripts = Object.values(json(repo, 'package.json').scripts as Record<string, string>)
    expect(scripts.join('\n')).toContain('-w story-spec')
  },

  'S-024.11': () => {
    const plan = (published: string) => JSON.parse(execFileSync('node', [join(repo, 'scripts/self-check.mjs'), '--plan'],
      { encoding: 'utf8', env: { ...process.env, STORY_SPEC_CHECKER: '', STORY_SPEC_PUBLISHED: published } }))
    // While only the old name is published, the old checker reads the renamed repo through links and its own header.
    expect(plan('storyspec')).toEqual({ checker: 'storyspec', dir: '.story-spec/released', links: ['storyspec.config.json', '.storyspec'], header: true })
    // Once story-spec is published, it is preferred and needs nothing.
    expect(plan('story-spec,storyspec')).toEqual({ checker: 'story-spec', dir: '.story-spec/released', links: [], header: false })
    // The links name what the old checker reads, and the repo's config lists the old state folder for it to skip.
    expect(json(repo, 'story-spec.config.json').ignore).toEqual(expect.arrayContaining(['.story-spec', '.storyspec']))
  },

  'S-024.12': {},
})
