// A copy of a project made with storyspec 0.8, before the rename (packages/story-spec/test/fixtures/v0.8 is the template
// as 0.8 shipped it): storyspec.config.json, a .storyspec/ state folder, a story test importing storyspec/vitest and the
// scenarios.gen.ts 0.8 wrote, and AGENTS.md, CLAUDE.md, the /story command and its hooks in 0.8's managed blocks. Each
// test gets its own copy.
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { afterEach } from 'vitest'

const roots: string[] = []
afterEach(() => { for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true }) })

export const OLD_STORY = 'stories/S-001-member-saves-a-note'

export const oldProject = () => {
  const root = mkdtempSync(join(tmpdir(), 'story-spec-old-'))
  cpSync(join(import.meta.dirname, '../packages/story-spec/test/fixtures/v0.8'), root, { recursive: true })
  // Written here, not kept in the fixture: git would read a .gitignore there, and the state folder is a run's output.
  writeFileSync(join(root, '.gitignore'), 'node_modules/\n.storyspec/\n')
  mkdirSync(join(root, '.storyspec'))
  writeFileSync(join(root, '.storyspec/vitest.json'), '{ "testResults": [] }\n')
  roots.push(root)
  return root
}

/** Every file under `root`, repo-relative, with its text: a snapshot to compare before and after. */
export const files = (root: string): Record<string, string> => {
  const out: Record<string, string> = {}
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else out[relative(root, p).split('\\').join('/')] = readFileSync(p, 'utf8')
    }
  }
  walk(root)
  return out
}
