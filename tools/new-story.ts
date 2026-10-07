// npm run story -- "<title>" [--epic "E-1 Notes"]
// Creates stories/S-NNN-slug/ from templates/story with the next free ID.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const cfg = JSON.parse(readFileSync(join(root, 'storyspec.config.json'), 'utf8')) as { idPrefix: string; storiesDir: string }
const args = process.argv.slice(2)
const epicAt = args.indexOf('--epic')
const epic = epicAt >= 0 ? args.splice(epicAt, 2)[1] ?? '' : ''
const title = args.join(' ').trim()
if (!title) { console.error('usage: npm run story -- "<title>" [--epic "<epic>"]'); process.exit(1) }

const used = readdirSync(join(root, cfg.storiesDir)).map(n => Number(n.match(new RegExp(`^${cfg.idPrefix}-(\\d+)-`))?.[1] ?? 0))
const id = `${cfg.idPrefix}-${String(Math.max(0, ...used) + 1).padStart(3, '0')}`
const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50)
const dir = join(root, cfg.storiesDir, `${id}-${slug}`)
const today = new Date().toISOString().slice(0, 10)

mkdirSync(dir)
for (const f of readdirSync(join(root, 'templates/story'))) {
  const text = readFileSync(join(root, 'templates/story', f), 'utf8')
    .replaceAll('{{id}}', id).replaceAll('{{title}}', title).replaceAll('{{epic}}', epic).replaceAll('{{date}}', today)
  writeFileSync(join(dir, f), text)
}
console.log(`${id}  ${cfg.storiesDir}/${id}-${slug}/`)
