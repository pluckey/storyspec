#!/usr/bin/env node
// npm create storyspec@latest <dir> [--no-example] [--no-install]
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const flags = new Set(args.filter(a => a.startsWith('--')))
const dirArg = args.find(a => !a.startsWith('--'))

if (!dirArg || flags.has('--help')) {
  console.log('Usage: npm create storyspec@latest <dir> [-- --no-example] [-- --no-install]')
  process.exit(dirArg ? 0 : 1)
}

const target = resolve(dirArg)
if (existsSync(target) && readdirSync(target).length > 0) {
  console.error(`${target} exists and isn't empty.`)
  process.exit(1)
}

const here = fileURLToPath(new URL('.', import.meta.url))
const own = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8'))
const template = join(here, 'template')
if (!existsSync(template)) {
  console.error('This create-storyspec build has no bundled template. Run `npm run build` in packages/create-storyspec.')
  process.exit(1)
}

cpSync(template, target, { recursive: true })
if (existsSync(join(target, 'gitignore'))) renameSync(join(target, 'gitignore'), join(target, '.gitignore'))

const pkgPath = join(target, 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
pkg.name = basename(target).toLowerCase().replace(/[^a-z0-9-_.]/g, '-')
// Run from a storyspec checkout, the app links that checkout's package; installed from npm, it takes the release.
const checkout = join(here, '..', 'storyspec')
pkg.devDependencies.storyspec = process.env.STORYSPEC_SPEC ?? (existsSync(join(checkout, 'package.json')) ? `file:${checkout}` : `^${own.version}`)

if (flags.has('--no-example')) stripExample(target, pkg)
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

if (!flags.has('--no-install')) {
  console.log('Installing dependencies…')
  const r = spawnSync('npm', ['install'], { cwd: target, stdio: 'inherit', shell: process.platform === 'win32' })
  if (r.status !== 0) process.exit(r.status ?? 1)
  // The bundled guidance matches this release; sync brings it up to the storyspec that was actually installed.
  const s = spawnSync('npx', ['storyspec', 'sync'], { cwd: target, stdio: 'inherit', shell: process.platform === 'win32' })
  if (s.status !== 0) process.exit(s.status ?? 1)
}

const rel = dirArg
console.log(`
Created ${rel}.

  cd ${rel}${flags.has('--no-install') ? '\n  npm install && npx storyspec sync' : ''}
  npm run check                       # typecheck + tests + trace
  npm run story -- "Your first story"  # or /story "…" in Claude Code
${flags.has('--no-example') ? '' : '  npm run dev                         # example notes API on :3000\n'}
Read AGENTS.md for the rules, and README.md for how it fits together.
To take a newer storyspec later: npm i -D storyspec@latest && npx storyspec sync
`)

// Leaves the structure, tooling and docs, with no stories: start with `npm run story`.
function stripExample(root, pkg) {
  const remove = [
    'stories', 'src/domain/note.ts', 'src/ports', 'src/adapters', 'src/presenters', 'src/entry/http.ts',
    'test/fakes', 'test/contracts',
  ]
  for (const p of remove) rmSync(join(root, p), { recursive: true, force: true })
  for (const d of ['src/ports', 'src/adapters', 'src/presenters', 'test/fakes', 'test/contracts']) {
    mkdirSync(join(root, d), { recursive: true })
    writeFileSync(join(root, d, '.gitkeep'), '')
  }
  writeFileSync(join(root, 'src/entry/composition.ts'), [
    '// The only place that wires adapters into stories.',
    'export const compose = () => ({})',
    '',
    'export type App = ReturnType<typeof compose>',
    '',
  ].join('\n'))
  delete pkg.scripts.dev

  mkdirSync(join(root, 'stories'), { recursive: true })
  writeFileSync(join(root, 'stories/.gitkeep'), '')

  // The README's quick start runs the example API; drop those lines.
  const readme = join(root, 'README.md')
  writeFileSync(readme, readFileSync(readme, 'utf8').split('\n').filter(l => !/npm run dev|curl .*localhost/.test(l)).join('\n'))
}
