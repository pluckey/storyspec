// End-to-end: a consumer takes a storyspec update the way they would from npm. Apps are scaffolded with the previous
// release (built from git) and changed as a team would; then this build is installed. The trace must warn that the
// agent guidance is stale, `storyspec sync` must update it, the team's own text must survive, and the check must pass.
// Then a simulated next release (this build with changed guidance) checks an ordinary block update the same way.
// FROM=<git ref> picks the previous release; by default it's the commit before the current version was set.
import { execSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const repo = resolve(import.meta.dirname, '..')
const tmp = mkdtempSync(join(tmpdir(), 'storyspec-upgrade-'))
const sh = (cmd, cwd = repo) => { console.log(`$ ${cmd}`); return execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' }) }
const pack = (workspaceRoot, name) => sh(`npm pack -w ${name} --pack-destination ${tmp}`, workspaceRoot).trim().split('\n').pop()
const fail = (msg) => { throw new Error(msg) }
const expectIn = (text, needle, what) => { if (!text.includes(needle)) fail(`${what}: expected to find ${JSON.stringify(needle)}`) }
const expectNotIn = (text, needle, what) => { if (text.includes(needle)) fail(`${what}: expected not to find ${JSON.stringify(needle)}`) }
const versionAt = (ref) => JSON.parse(execSync(`git show ${ref}:packages/storyspec/package.json`, { cwd: repo, encoding: 'utf8' })).version

// The last commit before the current version was set.
const previousRelease = () => {
  const current = JSON.parse(readFileSync(join(repo, 'packages/storyspec/package.json'), 'utf8')).version
  const commits = execSync('git log --format=%H -- packages/storyspec/package.json', { cwd: repo, encoding: 'utf8' }).trim().split('\n')
  const bump = [...commits].reverse().find(c => versionAt(c) === current) ?? fail(`no commit sets version ${current}`)
  return `${bump}^`
}

try {
  // This build.
  sh('npm run build')
  const current = JSON.parse(readFileSync(join(repo, 'packages/storyspec/package.json'), 'utf8')).version
  const cur = pack(repo, 'storyspec')

  // The previous release, built from git as it was.
  const from = process.env.FROM ?? previousRelease()
  const prevVersion = versionAt(from)
  sh(`git worktree add --detach ${tmp}/prev ${from}`)
  const prev = join(tmp, 'prev')
  sh('npm ci --silent', prev)
  sh('npm run build', prev)
  const prevCli = pack(prev, 'storyspec'), prevCreate = pack(prev, 'create-storyspec')
  sh(`npm install --silent --prefix ${tmp}/creator ${tmp}/${prevCreate}`)
  const creator = join(tmp, 'creator/node_modules/create-storyspec/index.js')
  console.log(`\nUpgrading apps made with storyspec ${prevVersion} (${from}) to ${current}\n`)

  const OUR_NOTES = '## Our conventions\n\nDeploy with `make deploy`. Payments are faked in tests.\n'
  const apps = {
    // The example app, never touched: its stories were written as done before done was derived.
    plain: () => {},
    // The team wrote its own notes into AGENTS.md.
    edited: (app) => writeFileSync(join(app, 'AGENTS.md'), readFileSync(join(app, 'AGENTS.md'), 'utf8') + '\n' + OUR_NOTES),
  }
  for (const [name, change] of Object.entries(apps)) {
    const app = join(tmp, name)
    sh(`STORYSPEC_SPEC=file:${tmp}/${prevCli} node ${creator} ${app}${name === 'plain' ? '' : ' --no-example'}`, tmp)
    sh('npm run -s check', app)
    change(app)

    sh(`npm install --silent -D ${tmp}/${cur}`, app)
    const before = sh('npm run -s check', app)
    expectIn(before, 'framework-sync', `${name}: the check after installing ${current}`)
    console.log(sh('npx storyspec sync', app))
    sh('npx storyspec sync --check', app)
    console.log(sh('npx storyspec migrate', app))
    const after = sh('npm run -s check', app)
    expectNotIn(after, 'framework-sync', `${name}: the check after sync`)
    expectNotIn(after, 'derived-status', `${name}: the check after migrate`)
    if (name === 'plain') {
      // Before 0.3 the example's stories were written as done; from 0.3 done is derived, from the tests that pass.
      const wroteDone = Number(prevVersion.split('.')[0]) === 0 && Number(prevVersion.split('.')[1]) < 3
      if (wroteDone && !before.includes('derived-status')) fail('plain: installing a version that derives done should warn about status: done')
      if (!wroteDone) expectNotIn(before, 'derived-status', `plain: an app made with ${prevVersion} has no written done`)
      expectIn(after, 'S-001 Member saves a note | done (v1)', 'plain: S-001 after upgrading')
    }
    const agents = readFileSync(join(app, 'AGENTS.md'), 'utf8')
    expectIn(agents, `<!-- storyspec:begin ${current} `, `${name}: AGENTS.md`)
    if (name === 'edited') expectIn(agents, OUR_NOTES, 'edited: the team\'s notes')
    if (agents.split('## Story tests').length !== 2) fail(`${name}: the guidance appears more than once in AGENTS.md`)
  }

  // A next release that changes the guidance: the block is updated, the notes outside it are kept.
  const next = join(tmp, 'next')
  cpSync(join(repo, 'packages/storyspec'), next, { recursive: true, filter: p => !p.includes('node_modules') })
  const nextPkg = JSON.parse(readFileSync(join(next, 'package.json'), 'utf8'))
  nextPkg.version = `${current.split('.').slice(0, 2).join('.')}.${Number(current.split('.')[2]) + 1}`
  writeFileSync(join(next, 'package.json'), JSON.stringify(nextPkg, null, 2) + '\n')
  const NEW_GUIDANCE = '- A line only the next release has.\n'
  writeFileSync(join(next, 'agent/AGENTS.md'), readFileSync(join(next, 'agent/AGENTS.md'), 'utf8') + NEW_GUIDANCE)
  const nextTgz = sh(`npm pack --pack-destination ${tmp}`, next).trim().split('\n').pop()

  const app = join(tmp, 'edited')
  sh(`npm install --silent -D ${tmp}/${nextTgz}`, app)
  expectIn(sh('npm run -s check', app), 'framework-sync', `the check after installing ${nextPkg.version}`)
  const synced = sh('npx storyspec sync', app)
  expectIn(synced, `AGENTS.md: updated (${current} → ${nextPkg.version})`, 'sync to the next release')
  const agents = readFileSync(join(app, 'AGENTS.md'), 'utf8')
  expectIn(agents, NEW_GUIDANCE, 'the next release\'s guidance')
  expectIn(agents, OUR_NOTES, 'the team\'s notes after the next update')
  expectNotIn(sh('npm run -s check', app), 'framework-sync', 'the check after the next sync')

  console.log('\nUPGRADE SMOKE OK')
} finally {
  execSync(`git worktree remove --force ${tmp}/prev`, { cwd: repo, stdio: 'ignore' }) // may not exist yet
  if (!process.env.KEEP) rmSync(tmp, { recursive: true, force: true })
}
