// Freezes this build as the checker for storyspec's own stories (see self-check.mjs). Run it when the current build is
// one you trust: everything after is checked by it, so a regression in a later build can't vouch for itself.
// storyspec isn't published, so the checker is a packed tarball of a local build, installed into .storyspec/checker.
import { execSync } from 'node:child_process'
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const repo = resolve(import.meta.dirname, '..')
const dir = join(repo, '.storyspec/checker')
const sh = (cmd, cwd = repo) => execSync(cmd, { cwd, stdio: 'inherit' })
const out = (cmd) => execSync(cmd, { cwd: repo, encoding: 'utf8' }).trim()

const dirty = out('git status --porcelain -- packages/storyspec')
if (dirty && !process.argv.includes('--dirty')) {
  console.error('packages/storyspec has uncommitted changes; commit them first (or pass --dirty to promote them anyway)')
  process.exit(1)
}
sh('npm run build -w storyspec')
rmSync(dir, { recursive: true, force: true })
mkdirSync(dir, { recursive: true })
sh(`npm pack -w storyspec --silent --pack-destination ${dir}`)
const tarball = readdirSync(dir).find(f => f.endsWith('.tgz'))
sh(`npm install --silent --no-audit --no-fund --prefix ${dir} ./${tarball} vitest`, dir)
const commit = out('git rev-parse --short HEAD')
writeFileSync(join(dir, 'CHECKER'), `${commit}${dirty ? ' + uncommitted changes' : ''}\n`)
console.log(`The checker is now this build (${commit}${dirty ? ' + uncommitted changes' : ''}).`)
