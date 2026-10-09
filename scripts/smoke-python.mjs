// End-to-end for a project that isn't TypeScript: a Python app installs the packed storyspec, its tests run under pytest,
// and the trace reads pytest's JUnit report. Needs pytest on PATH.
import { cpSync, mkdtempSync, rmSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const repo = resolve(import.meta.dirname, '..')
const tmp = mkdtempSync(join(tmpdir(), 'storyspec-smoke-py-'))
const sh = (cmd, cwd = repo) => { console.log(`$ ${cmd}`); return execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' }) }
// Findings go to stderr, so a failing command's output is both streams.
const fails = (cmd, cwd) => {
  console.log(`$ ${cmd}`)
  try { execSync(cmd, { cwd, stdio: 'pipe', encoding: 'utf8' }) } catch (e) { return `${e.stdout}${e.stderr}` }
  throw new Error(`expected "${cmd}" to fail`)
}

try {
  sh('npm run build')
  const cli = sh(`npm pack -w storyspec --pack-destination ${tmp}`).trim().split('\n').pop()
  const app = join(tmp, 'app')
  cpSync(join(repo, 'packages/storyspec/test/fixtures/python'), app, { recursive: true, filter: src => !src.includes('.storyspec') })
  sh(`npm install --no-audit --no-fund ${tmp}/${cli}`, app)
  sh('npx storyspec sync', app)

  const ok = sh('npx storyspec check', app)
  console.log(ok)
  if (!/S-001 Greet a person \| done \(v1\) \| 1 \| app\/greet\.py/.test(ok)) throw new Error('S-001 should be done, implemented by app/greet.py')

  // A broken implementation fails the scenario that pytest names.
  sh(`sed -i.bak 's/Hello, {name}!/Hi, {name}!/' app/greet.py`, app)
  const broken = fails('npx storyspec check', app)
  if (!/S-001\.1: its test fails/.test(broken)) throw new Error(`expected S-001.1 to fail:\n${broken}`)
  console.log('\nSMOKE PYTHON OK')
} finally {
  if (!process.env.KEEP) rmSync(tmp, { recursive: true, force: true })
}
