// End-to-end: pack both packages, scaffold apps from the tarballs, and run them like a user would.
import { execSync, spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const repo = resolve(import.meta.dirname, '..')
const tmp = mkdtempSync(join(tmpdir(), 'storyspec-smoke-'))
const sh = (cmd, cwd = repo) => { console.log(`$ ${cmd}`); return execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' }) }

try {
  sh('npm run build')
  const cli = sh(`npm pack -w storyspec --pack-destination ${tmp}`).trim().split('\n').pop()
  const create = sh(`npm pack -w create-storyspec --pack-destination ${tmp}`).trim().split('\n').pop()
  sh(`npm install --prefix ${tmp}/creator ${tmp}/${create}`)
  const creator = join(tmp, 'creator/node_modules/create-storyspec/index.js')
  const env = `STORYSPEC_SPEC=file:${tmp}/${cli}`

  // Full example app.
  sh(`${env} node ${creator} ${tmp}/app`, tmp)
  const app = join(tmp, 'app')
  console.log(sh('npm run -s check', app))
  sh('npm run -s story -- "Member deletes a note" --epic "E-1 Notes"', app)
  const afterStory = sh('npm run -s check', app)
  if (!afterStory.includes('S-003 Member deletes a note | draft')) throw new Error('new draft story missing from trace')

  const server = spawn('npx', ['tsx', 'src/entry/http.ts'], { cwd: app, env: { ...process.env, PORT: '3975' }, stdio: 'ignore' })
  await new Promise(r => setTimeout(r, 2500))
  try {
    const post = await fetch('http://localhost:3975/notes', { method: 'POST', headers: { 'x-member-id': 'ana' }, body: JSON.stringify({ title: ' Groceries ' }) })
    const list = await (await fetch('http://localhost:3975/notes', { headers: { 'x-member-id': 'ana' } })).json()
    if (post.status !== 201 || list.notes?.[0]?.title !== 'Groceries') throw new Error(`HTTP smoke failed: ${post.status} ${JSON.stringify(list)}`)
    console.log('http ok')
  } finally { server.kill() }

  // Bare structure.
  sh(`${env} node ${creator} ${tmp}/bare --no-example`, tmp)
  console.log(sh('npm run -s check', join(tmp, 'bare')))
  console.log('\nSMOKE OK')
} finally {
  if (!process.env.KEEP) rmSync(tmp, { recursive: true, force: true })
}
