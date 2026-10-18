// The people a product serves, from stories/PERSONAS.md, and which of them each story is for.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { slugify } from '../new-story.js'

/** `key`: the heading lower-cased and slugged (`## Game Master` → `game-master`), as stories name it. */
export type Persona = { name: string; key: string; prose: string }

export const PERSONAS_FILE = 'PERSONAS.md'

/** Each `## Name` heading is a persona; the text under it, up to the next heading, is its prose. Undefined when there
 * is no PERSONAS.md. */
export const readPersonas = (storiesRoot: string): Persona[] | undefined => {
  const p = join(storiesRoot, PERSONAS_FILE)
  if (!existsSync(p)) return undefined
  const personas: { name: string; key: string; lines: string[] }[] = []
  let current: (typeof personas)[number] | undefined
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const heading = line.match(/^##\s+(.+?)\s*$/)
    if (heading) { personas.push(current = { name: heading[1]!, key: personaKey(heading[1]!), lines: [] }); continue }
    if (/^#{1,6}\s/.test(line)) { current = undefined; continue }
    current?.lines.push(line)
  }
  return personas.map(({ lines, ...p }) => ({ ...p, prose: lines.join('\n').replace(/\s+/g, ' ').trim() }))
}

export const personaKey = (name: string) => slugify(name.trim())

/** The persona story.md's text names: "As a player, I want…" → `player`. The words after the article, up to a comma or
 * "I want"; undefined when the text doesn't begin that way or still holds the template's `<role>`. */
export const prosePersona = (storyMd: string) => {
  const body = storyMd.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
  const m = body.match(/^\s*As an?\s+(.+?)(?:,|\s+I\s+want\b|\n|$)/i)
  if (!m || /[<>]/.test(m[1]!)) return undefined
  return personaKey(m[1]!)
}

/** A story's personas: `persona:` in story.md, comma-separated, in order; without it, the one its text names. */
export const storyPersonas = (field: string[], prose: string | undefined) => field.length ? field : prose ? [prose] : []
