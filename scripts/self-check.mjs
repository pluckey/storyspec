// storyspec checks its own stories (stories/) with a frozen earlier build, not with this one: a regression in the trace
// can't then vouch for itself. The checker is promoted on purpose (npm run checker:promote) into .storyspec/checker,
// separate from the workspace, so `storyspec` in the template still runs this build.
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const repo = resolve(import.meta.dirname, '..')
const dir = join(repo, '.storyspec/checker')
const cli = join(dir, 'node_modules/storyspec/dist/cli.js')
const sh = (cmd, cwd = repo) => execSync(cmd, { cwd, stdio: 'inherit' })

if (!existsSync(cli)) {
  console.error('No checker yet. Run: npm run checker:promote (it freezes the current build as the checker)')
  process.exit(1)
}
const version = JSON.parse(readFileSync(join(dir, 'node_modules/storyspec/package.json'), 'utf8')).version
const from = existsSync(join(dir, 'CHECKER')) ? readFileSync(join(dir, 'CHECKER'), 'utf8').trim() : 'unknown commit'
console.log(`Checking storyspec's own stories with the checker: storyspec ${version}, built from ${from}`)
sh('npx tsc -p .')
sh(`node ${cli} check`)
