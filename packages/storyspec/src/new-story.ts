// Creates <storiesDir>/<ID>-<slug>/ from the repo's story templates, or the built-in ones.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Config } from './config.js'

const builtinTemplates = fileURLToPath(new URL('../templates/story', import.meta.url))

export const slugify = (title: string) =>
  title.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'story'

export const nextId = (root: string, config: Config) => {
  const dir = join(root, config.storiesDir)
  const used = existsSync(dir)
    ? readdirSync(dir).map(n => Number(n.match(new RegExp(`^${config.idPrefix}-(\\d+)-`))?.[1] ?? 0))
    : []
  return `${config.idPrefix}-${String(Math.max(0, ...used) + 1).padStart(3, '0')}`
}

export const newStory = (root: string, config: Config, title: string, epic = '', today = new Date()) => {
  const id = nextId(root, config)
  const folder = `${config.storiesDir}/${id}-${slugify(title)}`
  const dir = join(root, folder)
  mkdirSync(dir, { recursive: true })
  const custom = join(root, config.storyTemplateDir)
  const templates = existsSync(custom) ? custom : builtinTemplates
  for (const f of readdirSync(templates)) {
    const text = readFileSync(join(templates, f), 'utf8')
      .replaceAll('{{id}}', id)
      .replaceAll('{{title}}', title)
      .replaceAll('{{epic}}', epic)
      .replaceAll('{{date}}', today.toISOString().slice(0, 10))
    writeFileSync(join(dir, f), text)
  }
  return { id, folder }
}
