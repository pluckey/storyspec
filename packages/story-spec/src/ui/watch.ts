// Tells story-spec ui's pages when a project's files change, so each page reads the project again.
import { watch, type FSWatcher } from 'node:fs'

const IGNORED = /(^|\/)(node_modules|\.git|dist|coverage)(\/|$)|(^|\/)TRACE\.md$/

/** Changes gathered for this long reach listeners as one batch. */
export const SETTLE_MS = 250

type Watched = { watcher: FSWatcher; listeners: Set<(files: string[]) => void>; pending: Set<string>; timer?: NodeJS.Timeout }
const projects = new Map<string, Watched>()

/** Calls `listener` with the project-relative paths that changed, a batch at a time. Returns a function that stops it;
 * the project's watcher closes when its last listener stops. */
export const followProject = (root: string, listener: (files: string[]) => void) => {
  let w = projects.get(root)
  if (!w) {
    const entry: Watched = { watcher: undefined as unknown as FSWatcher, listeners: new Set(), pending: new Set() }
    entry.watcher = watch(root, { recursive: true }, (_event, name) => {
      const file = name?.toString().split('\\').join('/')
      if (!file || IGNORED.test(file)) return
      entry.pending.add(file)
      clearTimeout(entry.timer)
      entry.timer = setTimeout(() => {
        const files = [...entry.pending].sort()
        entry.pending.clear()
        for (const l of entry.listeners) l(files)
      }, SETTLE_MS)
    })
    entry.watcher.on('error', () => { /* the folder went away: listeners just stop hearing */ })
    projects.set(root, entry)
    w = entry
  }
  w.listeners.add(listener)
  return () => {
    const entry = projects.get(root)
    if (!entry) return
    entry.listeners.delete(listener)
    if (!entry.listeners.size) { clearTimeout(entry.timer); entry.watcher.close(); projects.delete(root) }
  }
}
