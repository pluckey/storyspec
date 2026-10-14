import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, expect } from 'vitest'
import { story } from 'storyspec/vitest'
import { serveUi } from '../../packages/storyspec/src/ui/server.js'
import { edit, pythonProject, STORY } from '../../test/python-project.js'
import { gen } from './scenarios.gen.js'

const cleanup: (() => void)[] = []
afterEach(() => { for (const c of cleanup.splice(0)) c() })
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

/** Follows the project's event stream the way the page does; `next` resolves with the next change, or null. */
const follow = async (root: string) => {
  const server = await serveUi(root, { port: 0 })
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  const abort = new AbortController()
  cleanup.push(() => { abort.abort(); server.closeAllConnections(); server.close() })
  const res = await fetch(`http://127.0.0.1:${port}/api/events`, { signal: abort.signal })
  const reader = res.body!.getReader()
  const events: { files: string[] }[] = []
  let buffer = ''
  void (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read()
        if (done) return
        buffer += new TextDecoder().decode(value)
        for (let at = buffer.indexOf('\n\n'); at >= 0; at = buffer.indexOf('\n\n')) {
          const block = buffer.slice(0, at); buffer = buffer.slice(at + 2)
          const data = block.match(/^event: change\ndata: (.*)$/m)?.[1]
          if (data) events.push(JSON.parse(data))
        }
      }
    } catch { /* aborted */ }
  })()
  await wait(300) // let the watcher start before anything changes
  return { events, settle: () => wait(900) }
}

story(gen, {
  'S-014.1': async () => {
    const root = pythonProject()
    const { events, settle } = await follow(root)
    edit(root, `${STORY}/spec.md`, s => s.replace('greet them by it', 'greet them by name'))
    await settle()
    expect(events).toHaveLength(1)
    expect(events[0]!.files).toContain(`${STORY}/spec.md`)
  },

  'S-014.2': async () => {
    const root = pythonProject()
    const { events, settle } = await follow(root)
    edit(root, '.storyspec/junit.xml', s => s.replace('time="0.01"', 'time="0.02"'))
    await settle()
    expect(events.flatMap(e => e.files)).toContain('.storyspec/junit.xml')
  },

  'S-014.3': async () => {
    const root = pythonProject()
    mkdirSync(join(root, 'node_modules/left-pad'), { recursive: true })
    mkdirSync(join(root, '.git'), { recursive: true })
    const { events, settle } = await follow(root)
    writeFileSync(join(root, 'node_modules/left-pad/index.js'), 'module.exports = 1\n')
    writeFileSync(join(root, '.git/HEAD'), 'ref: refs/heads/main\n')
    await settle()
    expect(events).toEqual([])
  },

  'S-014.4': async () => {
    const root = pythonProject()
    const { events, settle } = await follow(root)
    writeFileSync(join(root, 'notes-a.md'), 'a\n')
    writeFileSync(join(root, 'notes-b.md'), 'b\n')
    writeFileSync(join(root, 'notes-c.md'), 'c\n')
    await settle()
    expect(events).toHaveLength(1)
    expect(events[0]!.files).toEqual(expect.arrayContaining(['notes-a.md', 'notes-b.md', 'notes-c.md']))
  },

  'S-014.5': {},
})
