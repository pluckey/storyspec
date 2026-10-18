// Copies ../../template into ./template for publishing. npm drops .gitignore from
// packages, so it ships as `gitignore` and index.js renames it back.
import { cpSync, existsSync, renameSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const src = fileURLToPath(new URL('../../template', import.meta.url))
const dest = fileURLToPath(new URL('./template', import.meta.url))
const skip = ['node_modules', '.storyspec', 'package-lock.json']

rmSync(dest, { recursive: true, force: true })
cpSync(src, dest, { recursive: true, filter: p => !skip.some(s => p.split(/[\\/]/).includes(s)) })
if (existsSync(`${dest}/.gitignore`)) renameSync(`${dest}/.gitignore`, `${dest}/gitignore`)
console.log('bundled template')
