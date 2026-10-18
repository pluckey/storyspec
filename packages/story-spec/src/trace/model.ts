// The records a product moves through states, from stories/MODEL.md, and the events that go with them.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { slugify } from '../new-story.js'

export type ModelRecord = { name: string; slug: string; states: { name: string; slug: string }[]; transitions: [string, string][] }

export const MODEL_FILE = 'MODEL.md'

/** Each `## Name` heading is a record; its bullets of state names joined by → (or ->) are its transitions, in order.
 * Other lines are notes. Undefined when there is no MODEL.md. */
export const readModel = (storiesRoot: string): ModelRecord[] | undefined => {
  const p = join(storiesRoot, MODEL_FILE)
  if (!existsSync(p)) return undefined
  const records: ModelRecord[] = []
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const heading = line.match(/^##\s+(.+?)\s*$/)
    if (heading) { records.push({ name: heading[1]!, slug: slugify(heading[1]!), states: [], transitions: [] }); continue }
    const record = records.at(-1)
    const bullet = line.match(/^\s*[-*]\s+(.+)$/)
    if (!record || !bullet || !/→|->/.test(bullet[1]!)) continue
    const names = bullet[1]!.split(/\s*(?:→|->)\s*/).map(n => n.trim()).filter(Boolean)
    for (const n of names) if (!record.states.some(s => s.name === n)) record.states.push({ name: n, slug: slugify(n) })
    for (let i = 1; i < names.length; i++) record.transitions.push([names[i - 1]!, names[i]!])
  }
  return records
}

/** Events every record has besides entering a state. */
export const RECORD_EVENTS = ['created', 'changed']

/** Where records start: states no transition leads to. */
export const startStates = (r: ModelRecord) => r.states.filter(s => !r.transitions.some(([, to]) => to === s.name))

/** The record an event belongs to (`vendor.review` → Vendor), and the rest of its name. */
export const recordOf = (model: ModelRecord[], event: string) => {
  const at = event.indexOf('.')
  if (at < 0) return undefined
  const record = model.find(r => r.slug === event.slice(0, at))
  return record && { record, rest: event.slice(at + 1) }
}
