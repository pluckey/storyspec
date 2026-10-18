// The story-spec projects story-spec ui can show: every folder with a config file (either name) under one folder.
import { readdirSync, statSync } from 'node:fs'
import { basename, dirname, join, relative } from 'node:path'
import { configFile, loadConfig } from '../config.js'
import { scan } from '../trace/scan.js'

export type Project = { id: string; name: string; root: string; stories: number; open: number }

const SKIP = new Set(['node_modules', 'dist', 'build', 'coverage'])
const isProject = (dir: string) => configFile(dir) !== undefined

/** The folder to list: where the ui started, or the folder above when that is itself a project. */
export const projectsBase = (start: string) => isProject(start) ? dirname(start) : start

/** Projects up to three levels below `base`, sorted by path, including projects inside projects (an app in a monorepo). */
export const findProjects = (base: string): Project[] => {
  const roots: string[] = []
  const walk = (dir: string, depth: number) => {
    if (isProject(dir)) roots.push(dir)
    if (depth === 3) return
    let names: string[]
    try { names = readdirSync(dir) } catch { return }
    for (const n of names) {
      if (n.startsWith('.') || SKIP.has(n)) continue
      const p = join(dir, n)
      try { if (statSync(p).isDirectory()) walk(p, depth + 1) } catch { /* unreadable: skip */ }
    }
  }
  walk(base, 0)
  return roots.sort().map(root => {
    const id = relative(base, root).split('\\').join('/') || '.'
    let stories = 0, open = 0
    try {
      const repo = scan(root, loadConfig(root))
      stories = repo.stories.length
      open = repo.stories.reduce((n, s) => n + s.decisions.filter(d => d.open).length, 0)
    } catch { /* a project whose config doesn't load still shows; its page reports why */ }
    return { id, name: id === '.' ? basename(root) : id, root, stories, open }
  })
}
