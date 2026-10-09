// storyspec checks its own stories (stories/) with the last published release, not with this build: a regression in
// the trace can't then vouch for itself. The release is installed once into .storyspec/released (npm's cache makes it
// quick), separate from the workspace, so `storyspec` in the template still runs this build.
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const repo = resolve(import.meta.dirname, '..')
const dir = join(repo, '.storyspec/released')
const sh = (cmd, cwd = repo) => execSync(cmd, { cwd, stdio: 'inherit' })
const version = process.env.STORYSPEC_CHECKER ?? 'latest'

const installed = () => { try { return JSON.parse(readFileSync(join(dir, 'node_modules/storyspec/package.json'), 'utf8')).version } catch { return undefined } }
const wanted = execSync(`npm view storyspec@${version} version`, { encoding: 'utf8' }).trim()
if (installed() !== wanted) sh(`npm install --silent --no-audit --no-fund --prefix ${dir} storyspec@${wanted} vitest`)
if (!existsSync(join(dir, 'node_modules/storyspec/dist/cli.js'))) throw new Error('storyspec did not install')
console.log(`Checking storyspec's own stories with storyspec ${wanted} (published)`)
sh('npx tsc -p .')
sh(`node ${join(dir, 'node_modules/storyspec/dist/cli.js')} check`)
