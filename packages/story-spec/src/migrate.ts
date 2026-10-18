// `story-spec migrate`: brings a project up to this version. From the old name (storyspec, before 0.9): the config
// file, the state folder, imports of the old package, package.json, .gitignore, the generated files and the agent
// guidance. From 0.2: a story written as done goes back to in-progress, since done is worked out from proof. Each step
// writes a file only when it has something to change, so a second run finds nothing to do.
import { existsSync, lstatSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { CONFIG_FILE, loadConfig, OLD_CONFIG_FILE } from './config.js'
import { genStatus, renderGen } from './gen.js'
import { installedVersion, plan } from './sync.js'
import { scan } from './trace/scan.js'

export const STATE_DIR = '.story-spec'
export const OLD_STATE_DIR = '.storyspec'

/** One line of the report: a file (or folder) and what happened to it. `problem` changed nothing and needs a person. */
export type Migration = { file: string; change: string; problem?: true }

const isLink = (p: string) => { try { return lstatSync(p).isSymbolicLink() } catch { return false } }
const read = (root: string, f: string) => readFileSync(join(root, f), 'utf8')

// The config file and the state folder. A link left by a checker run for the old name (see scripts/self-check.mjs in
// the story-spec repo) points at the new one and is only removed.
const moveNames = (root: string, out: Migration[]) => {
  const oldConfig = join(root, OLD_CONFIG_FILE), newConfig = join(root, CONFIG_FILE)
  if (isLink(oldConfig)) { rmSync(oldConfig); out.push({ file: OLD_CONFIG_FILE, change: 'removed (a link to the new name)' }) }
  else if (existsSync(oldConfig)) {
    if (existsSync(newConfig)) out.push({ file: OLD_CONFIG_FILE, change: `not moved: ${CONFIG_FILE} exists too and is the one read; merge them and delete this one`, problem: true })
    else { renameSync(oldConfig, newConfig); out.push({ file: OLD_CONFIG_FILE, change: `renamed to ${CONFIG_FILE}` }) }
  }
  const oldState = join(root, OLD_STATE_DIR), newState = join(root, STATE_DIR)
  if (isLink(oldState)) { rmSync(oldState); out.push({ file: OLD_STATE_DIR, change: 'removed (a link to the new name)' }) }
  else if (existsSync(oldState)) {
    if (!existsSync(newState)) renameSync(oldState, newState)
    else {
      // The new trace already wrote here; what it wrote is newer than the old folder's copy.
      for (const f of readdirSync(oldState)) if (!existsSync(join(newState, f))) renameSync(join(oldState, f), join(newState, f))
      rmSync(oldState, { recursive: true, force: true })
    }
    out.push({ file: `${OLD_STATE_DIR}/`, change: `renamed to ${STATE_DIR}/` })
  }
}

// `.storyspec` as a path, or as a whole entry when the new name isn't listed beside it (a list may hold both on purpose).
const renameStatePaths = (text: string, quote: string) => {
  let next = text.replaceAll(`${OLD_STATE_DIR}/`, `${STATE_DIR}/`)
  const whole = `${quote}${OLD_STATE_DIR}${quote}`
  if (!next.includes(`${quote}${STATE_DIR}${quote}`)) next = next.replaceAll(whole, `${quote}${STATE_DIR}${quote}`)
  return next
}

const configText = (root: string, out: Migration[]) => {
  if (!existsSync(join(root, CONFIG_FILE))) return
  const text = read(root, CONFIG_FILE)
  const schema = text.replace('node_modules/storyspec/schema/storyspec.config.schema.json', 'node_modules/story-spec/schema/story-spec.config.schema.json')
  const next = renameStatePaths(schema, '"')
  if (next === text) return
  writeFileSync(join(root, CONFIG_FILE), next)
  const what = [...schema !== text ? ['the schema path'] : [], ...next !== schema ? [`${OLD_STATE_DIR} → ${STATE_DIR}`] : []]
  out.push({ file: CONFIG_FILE, change: what.join(' and ') })
}

const gitignore = (root: string, out: Migration[]) => {
  if (!existsSync(join(root, '.gitignore'))) return
  const text = read(root, '.gitignore')
  const lines = text.split('\n')
  if (lines.some(l => l === STATE_DIR || l === `${STATE_DIR}/`)) return
  const next = lines.map(l => l === OLD_STATE_DIR || l === `${OLD_STATE_DIR}/` ? l.replace(OLD_STATE_DIR, STATE_DIR) : l).join('\n')
  if (next === text) return
  writeFileSync(join(root, '.gitignore'), next)
  out.push({ file: '.gitignore', change: `${OLD_STATE_DIR}/ → ${STATE_DIR}/` })
}

// The command in a script, not a path or another package's name (`create-storyspec`, `packages/storyspec`).
const OLD_COMMAND = /(^|[\s;&|(])storyspec(?=$|[\s;&|)])/g
const DEPENDENCIES = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const

const packageJson = (root: string, out: Migration[]) => {
  if (!existsSync(join(root, 'package.json'))) return
  const text = read(root, 'package.json')
  const pkg = JSON.parse(text) as Record<string, unknown>
  const what: string[] = []
  for (const key of DEPENDENCIES) {
    const deps = pkg[key] as Record<string, string> | undefined
    if (!deps || !('storyspec' in deps)) continue
    const old = deps.storyspec!
    // A range of the old package names versions the new one doesn't have; a wildcard or a path still means the same.
    const range = /^(\*|file:|link:|workspace:)/.test(old) ? old : `^${installedVersion()}`
    pkg[key] = Object.fromEntries(Object.entries(deps).flatMap(([k, v]) =>
      k !== 'storyspec' ? [[k, v]] : 'story-spec' in deps ? [] : [['story-spec', range]]))
    what.push(key)
  }
  const scripts = pkg.scripts as Record<string, string> | undefined
  if (scripts && Object.values(scripts).some(s => s.replace(OLD_COMMAND, '$1story-spec') !== s)) {
    pkg.scripts = Object.fromEntries(Object.entries(scripts).map(([k, v]) => [k, v.replace(OLD_COMMAND, '$1story-spec')]))
    what.push('scripts')
  }
  if (!what.length) return
  const indent = /^\{\n([ \t]+)"/.exec(text)?.[1] ?? 2
  writeFileSync(join(root, 'package.json'), JSON.stringify(pkg, null, indent) + (text.endsWith('\n') ? '\n' : ''))
  out.push({ file: 'package.json', change: `storyspec → story-spec in ${what.join(', ')}${what.some(w => w !== 'scripts') ? '; run npm install' : ''}` })
}

// Imports of the old package ('storyspec', 'storyspec/vitest') in the project's JavaScript and TypeScript.
const OLD_IMPORT = /(\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)(['"])storyspec((?:\/[\w.-]+)*)\2/g
const SCRIPT = /\.(c|m)?[jt]sx?$/

const imports = (root: string, ignore: string[], out: Migration[]) => {
  const ignored = (rel: string) => ignore.some(i => rel === i || rel.startsWith(i + '/'))
  const walk = (dir: string): string[] => readdirSync(dir).flatMap(name => {
    const p = join(dir, name), rel = relative(root, p).split('\\').join('/')
    if (name === 'node_modules' || name === '.git' || ignored(rel)) return []
    let st; try { st = statSync(p) } catch { return [] }
    return st.isDirectory() ? walk(p) : SCRIPT.test(name) ? [rel] : []
  })
  for (const f of walk(root)) {
    const text = read(root, f)
    const next = text.replace(OLD_IMPORT, '$1$2story-spec$3$2')
    if (next === text) continue
    writeFileSync(join(root, f), next)
    out.push({ file: f, change: 'imports story-spec' })
  }
}

// Agent guidance written by the old name (its markers, or hooks that run it), rewritten by sync. Files sync would
// create, and guidance already under the new name, are left to `story-spec sync`.
const OLD_GUIDANCE = /<!-- storyspec:(begin|managed) |\bnpx storyspec\b/

const guidance = (root: string, out: Migration[]) => {
  for (const c of plan(root)) {
    const path = join(root, c.file)
    if (!existsSync(path) || !OLD_GUIDANCE.test(readFileSync(path, 'utf8'))) continue
    if (c.action === 'edited') { out.push({ file: c.file, change: `not changed: ${c.message}`, problem: true }); continue }
    if (c.next === undefined) continue
    writeFileSync(path, c.next)
    out.push({ file: c.file, change: `rewritten by sync${c.message ? ` (${c.message})` : ''}` })
  }
}

export const migrate = (root: string): Migration[] => {
  const out: Migration[] = []
  moveNames(root, out)
  configText(root, out)
  const config = loadConfig(root)
  gitignore(root, out)
  packageJson(root, out)
  imports(root, config.ignore, out)
  const repo = scan(root, config)
  // 0.3: done is derived from proof, so a story written as done goes back to in-progress.
  for (const s of repo.stories) {
    if (s.front.status !== 'done') continue
    const file = join(s.dir, 'story.md')
    writeFileSync(join(root, file), read(root, file).replace(/^status:[ \t]*done[ \t]*$/m, 'status: in-progress'))
    out.push({ file, change: 'status: done → in-progress; the trace shows it as done when its scenarios are proven' })
  }
  // Generated files with the old header, or stale; a missing one is `story-spec gen`'s to write.
  for (const g of genStatus(root, repo.stories).filter(g => g.state === 'stale' || g.oldName)) {
    writeFileSync(join(root, g.file), renderGen(repo.stories.find(s => s.id === g.story)!))
    out.push({ file: g.file, change: 'regenerated' })
  }
  guidance(root, out)
  return out
}
