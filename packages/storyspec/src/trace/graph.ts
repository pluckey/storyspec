// The repo's import graph. TypeScript's comes from dependency-cruiser: module resolution, tsconfig path aliases,
// re-exports and type-only imports are its job, not ours. Other languages' come from ast-grep (languages.ts). storyspec's rules (rules.ts) read the result: for each source file, the repo files it
// imports (without extension), and which of those imports are type-only.
import { existsSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
import { cruise, type ICruiseResult } from 'dependency-cruiser'
import extractTSConfig from 'dependency-cruiser/config-utl/extract-ts-config'
import { findImports, LANGUAGES } from './languages.js'

export type FileImports = { imports: string[]; typeOnly: string[] }
export type ImportGraph = Map<string, FileImports>

const bare = (p: string) => p.replace(/\.(c|m)?[jt]sx?$/, '')

/** The imports of `files` (repo-relative) that resolve to other files in the repo. */
export const importGraph = async (root: string, files: string[]): Promise<ImportGraph> => {
  const graph = await typescriptGraph(root, files.filter(f => /\.(c|m)?tsx?$/.test(f)))
  const exists = (rel: string) => existsSync(join(root, rel))
  for (const lang of LANGUAGES) {
    const own = files.filter(f => lang.extensions.some(e => f.endsWith(e)))
    for (const [file, matches] of findImports(root, lang, own))
      graph.set(file, { imports: [...new Set(matches.flatMap(m => lang.resolve(file, m, exists)))], typeOnly: [] })
  }
  return graph
}

const typescriptGraph = async (root: string, files: string[]): Promise<ImportGraph> => {
  if (!files.length) return new Map()
  // dependency-cruiser resolves symlinks, so its paths are relative to the real root (macOS's /var is /private/var).
  const base = realpathSync(root)
  const tsconfig = join(base, 'tsconfig.json')
  const hasTsconfig = existsSync(tsconfig)
  const result = await cruise(files, {
    baseDir: base,
    // Imports of types count too: they're dependencies the layers rule should see.
    tsPreCompilationDeps: true,
    doNotFollow: { path: 'node_modules' },
    ...(hasTsconfig && { tsConfig: { fileName: tsconfig } }),
  }, {}, hasTsconfig ? { tsConfig: extractTSConfig(tsconfig) } : {})
  const output = result.output as ICruiseResult
  const inRepo = new Set(files)
  const graph: ImportGraph = new Map()
  for (const m of output.modules) {
    if (!inRepo.has(m.source)) continue
    const local = m.dependencies.filter(d => !d.couldNotResolve && inRepo.has(d.resolved))
    graph.set(m.source, {
      imports: [...new Set(local.map(d => bare(d.resolved)))],
      typeOnly: [...new Set(local.filter(d => d.dependencyTypes.includes('type-only')).map(d => bare(d.resolved)))],
    })
  }
  return graph
}
