// Languages other than TypeScript, for the import graph (Python, for now). Each is data: its file extensions, which files are tests, the
// ast-grep patterns that find its imports, and how a module name maps to repo files. TypeScript stays with
// dependency-cruiser (graph.ts), which knows tsconfig paths and type-only imports.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, posix } from 'node:path'

export type ImportMatch = { module: string; names: string[] }

export type Language = {
  name: string
  /** ast-grep's name for the language. */
  astGrep: string
  extensions: string[]
  tests: RegExp
  /** Patterns whose $M is the module imported and $$$NAMES (if any) the names imported from it. */
  imports: string[]
  /** The repo files (relative, without extension) an import of `module` from `file` refers to, given which exist. */
  resolve: (file: string, m: ImportMatch, exists: (rel: string) => boolean) => string[]
}

const python: Language = {
  name: 'python',
  astGrep: 'python',
  extensions: ['.py'],
  tests: /(^|\/)(test_[^/]*|[^/]*_test|conftest)\.py$/,
  imports: ['import $M', 'import $M as $A', 'from $M import $$$NAMES'],
  resolve: (file, { module, names }, exists) => {
    // from . import x / from ..pkg import y are relative to the importing file's package.
    const dots = module.match(/^\.*/)![0].length
    const rest = module.slice(dots).replace(/\./g, '/')
    const base = dots ? posix.join(posix.dirname(file), ...Array(dots - 1).fill('..'), rest) : rest
    const asModule = (p: string) => exists(`${p}.py`) ? p : exists(`${p}/__init__.py`) ? `${p}/__init__` : undefined
    // `from pkg import sub` imports the submodule when there is one, else a name defined in pkg.
    const found = names.map(n => asModule(posix.join(base, n.split(/\s+as\s+/)[0]!.trim()))).filter((p): p is string => !!p)
    const own = asModule(base)
    return [...new Set([...found, ...(found.length === names.length && names.length ? [] : own ? [own] : [])])]
  },
}

// Swift is deliberately absent: in a single-module app its files use each other without imports, so an import graph
// would see nothing and report clean. Its layers are SwiftPM targets, which the compiler already enforces.
export const LANGUAGES: Language[] = [python]

export const languageOf = (path: string) => LANGUAGES.find(l => l.extensions.some(e => path.endsWith(e)))

/** ast-grep's binary for this platform, from its npm package (without relying on its install script), else on PATH. */
const astGrepBinary = (): string => {
  const require = createRequire(import.meta.url)
  const exe = process.platform === 'win32' ? 'ast-grep.exe' : 'ast-grep'
  const suffix = process.platform === 'linux' ? '-gnu' : process.platform === 'win32' ? '-msvc' : ''
  for (const pkg of [`@ast-grep/cli-${process.platform}-${process.arch}${suffix}`, '@ast-grep/cli']) {
    try {
      const bin = join(dirname(require.resolve(`${pkg}/package.json`)), exe)
      if (existsSync(bin)) return bin
    } catch { /* not installed */ }
  }
  return 'ast-grep'
}

// Like grep, ast-grep exits 1 when nothing matches; that's an empty result, not a failure.
const astGrep = (bin: string, root: string, args: string[]): string => {
  try {
    return execFileSync(bin, args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string; code?: string }
    if (err.status === 1 && !err.stderr?.trim()) return err.stdout ?? '[]'
    if (err.code === 'ENOENT') throw new Error('storyspec needs ast-grep to read imports outside TypeScript; install @ast-grep/cli')
    throw new Error(`ast-grep ${args.slice(0, 5).join(' ')} failed: ${err.stderr?.trim() || err.status}`)
  }
}

type AstGrepMatch = { file: string; metaVariables: { single: Record<string, { text: string }>; multi: Record<string, { text: string }[]> } }

/** Every import in `files` (repo-relative) of language `lang`, by file. */
export const findImports = (root: string, lang: Language, files: string[]): Map<string, ImportMatch[]> => {
  const out = new Map<string, ImportMatch[]>(files.map(f => [f, []]))
  if (!files.length) return out
  const bin = astGrepBinary()
  for (const pattern of lang.imports) {
    // Files go in batches, to stay under the OS's argument length limit.
    for (let i = 0; i < files.length; i += 200) {
      const json = astGrep(bin, root, ['run', '--lang', lang.astGrep, '--pattern', pattern, '--json=compact', ...files.slice(i, i + 200)])
      for (const m of JSON.parse(json || '[]') as AstGrepMatch[]) {
        const module = m.metaVariables.single.M?.text
        if (!module) continue
        const names = (m.metaVariables.multi.NAMES ?? []).map(n => n.text).filter(t => t !== ',' && t !== '(' && t !== ')')
        out.get(m.file.split('\\').join('/'))?.push({ module, names })
      }
    }
  }
  return out
}
