// Edits a person makes to a spec through the UI, as pure functions from a file's text to its new text. Each returns
// the new text or a reason it can't be made, so the server only reads, calls one of these, and writes.
import { createHash } from 'node:crypto'
import { isOpen } from './trace/scan.js'

export type Edit = { ok: true; text: string } | { ok: false; reason: string }
const ok = (text: string): Edit => ({ ok: true, text })
const no = (reason: string): Edit => ({ ok: false, reason })

/** A short hash of a file's text, so a write can refuse when the file changed since the page read it. */
export const textHash = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 12)

const STEP = /^(GIVEN|WHEN|THEN|AND|BUT)\s+\S/

/** The bullet lines under each scenario heading, by scenario ID: what the UI shows and edits. */
export const scenarioSteps = (spec: string, prefix = 'S'): Record<string, string[]> => {
  const out: Record<string, string[]> = {}
  const heading = new RegExp(`^#{2,6}\\s*Scenario:.*\\{#(${prefix}-\\d+\\.\\d+)[^}]*\\}\\s*$`)
  let current: string | undefined
  for (const line of spec.split('\n')) {
    const h = line.match(heading)
    if (h) { current = h[1]!; out[current] = []; continue }
    if (/^#{1,6}\s/.test(line)) { current = undefined; continue }
    const step = line.match(/^\s*[-*]\s+(.*)$/)
    if (current && step) out[current]!.push(step[1]!.trim())
  }
  return out
}

/** The requirement's sentence: the text under the {#ID} heading up to the next heading. */
export const requirementText = (spec: string, id: string) => {
  const at = spec.indexOf(`{#${id}}`)
  if (at < 0) return ''
  const body = spec.slice(spec.indexOf('\n', at) + 1)
  const next = body.search(/^#{1,6}\s/m)
  return (next < 0 ? body : body.slice(0, next)).replace(/\s+/g, ' ').trim()
}

/** "As a… I want… so that…": story.md's text after the front matter, up to its first heading. */
export const storyText = (storyMd: string) =>
  storyMd.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').split(/^#{1,6}\s/m)[0]!.replace(/\s+/g, ' ').trim()

const decisionLines = (spec: string) => {
  const lines = spec.split('\n')
  const at = lines.findIndex(l => /^###\s+Decisions\s*$/.test(l))
  if (at < 0) return { lines, indexes: [] as number[] }
  const indexes: number[] = []
  for (let i = at + 1; i < lines.length && !/^#{1,3}\s/.test(lines[i]!); i++) if (/^\s*[-*]\s+\S/.test(lines[i]!)) indexes.push(i)
  return { lines, indexes }
}

/** An open decision's question: its text without "(open)" and the scenario IDs it names. */
export const decisionQuestion = (text: string) =>
  text.replace(/\s*(?<!["`“])\(open\)(?!["`”])/i, '').replace(/[;,]?\s*(?:[A-Z]+-\d+\.\d+(?:\s*,\s*)?)+\s*$/, '').replace(/[\s:;,]+$/, '').trim()

/** Answers the `index`th decision (0-based, in spec order), which must be open. Pinned keeps the scenarios it named
 * as its pins; free records the answer as one reasonable choice. */
export const answerDecision = (spec: string, index: number, answer: string, kind: 'pinned' | 'free', prefix = 'S'): Edit => {
  const { lines, indexes } = decisionLines(spec)
  const at = indexes[index]
  if (at === undefined) return no(`there is no decision ${index + 1}`)
  const text = lines[at]!.replace(/^\s*[-*]\s+/, '')
  if (!isOpen(text)) return no('that decision is not open')
  const a = answer.trim().replace(/\s+/g, ' ')
  if (!a) return no('the answer is empty')
  const ids = [...new Set(text.match(new RegExp(`\\b${prefix}-\\d+\\.\\d+\\b`, 'g')) ?? [])]
  if (kind === 'pinned' && !ids.length) return no('a pinned answer needs a scenario that proves it; this decision names none, so answer it as free or add a scenario first')
  lines[at] = `- ${decisionQuestion(text)}: ${a}${kind === 'pinned' ? `; pinned by ${ids.join(', ')}` : ' (free)'}`
  return ok(lines.join('\n'))
}

/** Sets story.md's status. */
export const setStatus = (storyMd: string, status: string): Edit =>
  /^status:/m.test(storyMd) ? ok(storyMd.replace(/^status:[ \t]*.*$/m, `status: ${status}`)) : no('story.md has no status')

/** Bumps story.md's version and adds a line under Revisions saying why. */
export const bumpVersion = (storyMd: string, why: string, date: string): Edit => {
  const m = storyMd.match(/^version:[ \t]*(\d+)[ \t]*$/m)
  if (!m) return no('story.md has no version')
  const v = Number(m[1]) + 1
  let text = storyMd.replace(/^version:[ \t]*\d+[ \t]*$/m, `version: ${v}`)
  const line = `- v${v} (${date}): ${why}`
  text = /^## Revisions\s*$/m.test(text) ? `${text.replace(/\s*$/, '')}\n${line}\n` : `${text.replace(/\s*$/, '')}\n\n## Revisions\n\n${line}\n`
  return ok(text)
}

/** Why a scenario's title and steps can't be written, if they can't. */
export const scenarioProblem = (title: string, steps: string[]) => {
  if (!title.trim()) return 'give the scenario a title'
  if (/[{}]/.test(title)) return 'a title can\'t contain { or }'
  if (!steps.length) return 'add its steps'
  const bad = steps.find(s => !STEP.test(s))
  if (bad) return `"${bad}" should start with GIVEN, WHEN, THEN or AND`
  if (!steps.some(s => s.startsWith('THEN'))) return 'a scenario needs a THEN: what a test can check'
  return undefined
}

const block = (id: string, title: string, steps: string[]) =>
  [`#### Scenario: ${title.trim()} {#${id}}`, '', ...steps.map(s => `- ${s.trim()}`)]

/** Replaces scenario `id`'s title and steps, keeping its tag (and any proof= on it). */
export const editScenario = (spec: string, id: string, title: string, steps: string[]): Edit => {
  const problem = scenarioProblem(title, steps)
  if (problem) return no(problem)
  const lines = spec.split('\n')
  const at = lines.findIndex(l => new RegExp(`^#{2,6}\\s*Scenario:.*\\{#${id.replace('.', '\\.')}(\\s[^}]*)?\\}\\s*$`).test(l))
  if (at < 0) return no(`${id} isn't a scenario in this spec`)
  const tag = lines[at]!.match(/\{#[^}]*\}/)![0]
  let end = at + 1
  while (end < lines.length && !/^#{1,6}\s/.test(lines[end]!)) end++
  const [first, ...rest] = block(id, title, steps)
  lines.splice(at, end - at, first!.replace(`{#${id}}`, tag), ...rest, '')
  return ok(lines.join('\n'))
}

/** Adds a scenario with the next ID after the last one, before the Decisions section. */
export const addScenario = (spec: string, storyId: string, title: string, steps: string[]): Edit & { id?: string } => {
  const problem = scenarioProblem(title, steps)
  if (problem) return no(problem)
  const used = [...spec.matchAll(new RegExp(`\\{#${storyId}\\.(\\d+)`, 'g'))].map(m => Number(m[1]))
  const id = `${storyId}.${Math.max(0, ...used) + 1}`
  const lines = spec.replace(/\s*$/, '').split('\n')
  const decisions = lines.findIndex(l => /^###\s+Decisions\s*$/.test(l))
  const insert = decisions < 0 ? lines.length : decisions
  const before = lines.slice(0, insert)
  while (before.length && before.at(-1) === '') before.pop()
  const after = lines.slice(insert)
  return { ok: true, id, text: [...before, '', ...block(id, title, steps), ...(after.length ? ['', ...after] : []), ''].join('\n') }
}
