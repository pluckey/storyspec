import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, expect } from 'vitest'
import { story } from 'storyspec/vitest'
import { importGraph, trace } from '../../packages/storyspec/src/index.js'
import { edit, pythonProject, rulesOf } from '../../test/python-project.js'
import { gen } from './scenarios.gen.js'

const roots: string[] = []
afterEach(() => { for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true }) })

const project = (files: Record<string, string>) => {
  const root = mkdtempSync(join(tmpdir(), 'storyspec-lang-'))
  roots.push(root)
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  return root
}
const importsOf = async (root: string, file: string, files: string[]) => (await importGraph(root, files)).get(file)?.imports.sort()

story(gen, {
  'S-005.1': async () => {
    const files = {
      'app/__init__.py': '', 'app/domain/__init__.py': '', 'app/domain/model.py': '', 'app/domain/rules.py': '',
      'app/usecases/__init__.py': '', 'app/usecases/helpers.py': '',
      'app/usecases/publish.py': 'import os\nimport app.domain.rules\nfrom app.domain.model import Article\nfrom app.domain import rules as r\nfrom . import helpers\nimport httpx\n',
    }
    const root = project(files)
    expect(await importsOf(root, 'app/usecases/publish.py', Object.keys(files)))
      .toEqual(['app/domain/model', 'app/domain/rules', 'app/usecases/helpers'])
  },

  'S-005.2': async () => {
    const root = pythonProject()
    edit(root, 'storyspec.config.json', s => JSON.stringify({ ...JSON.parse(s), layers: { 'app/domain': ['app/domain'], 'app/adapters': ['app/domain', 'app/adapters'] } }))
    for (const [path, text] of Object.entries({
      'app/__init__.py': '', 'app/domain/__init__.py': '', 'app/adapters/__init__.py': '', 'app/adapters/db.py': 'from app.domain.model import Thing\n',
      'app/domain/model.py': 'from app.adapters.db import connect\n',
    })) { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text) }
    const r = await trace(root, { write: false })
    expect(r.findings.filter(f => f.rule === 'layers').map(f => [f.file, f.message])).toEqual([
      ['app/domain/model.py', 'imports app/adapters/db; app/domain may import app/domain'],
    ])
  },

  'S-005.3': async () => {
    const files = {
      'Sources/Domain/Model.swift': 'import Foundation\npublic struct Thing {}\n',
      'Sources/Adapters/Store.swift': 'import Domain\n',
      'Sources/Domain/Bad.swift': 'import Adapters\n',
      'Tests/DomainTests/ModelTests.swift': 'import XCTest\n@testable import Domain\n',
    }
    const root = project(files)
    const graph = await importGraph(root, Object.keys(files))
    expect(graph.get('Sources/Domain/Bad.swift')?.imports).toEqual(['Sources/Adapters'])
    expect(graph.get('Sources/Domain/Model.swift')?.imports).toEqual([])
    expect(graph.get('Tests/DomainTests/ModelTests.swift')?.imports).toEqual(['Sources/Domain'])
  },

  'S-005.4': async () => {
    const root = pythonProject()
    expect(await rulesOf(root)).toEqual([])
    writeFileSync(join(root, 'app/notes.py'), '# see S-001.2\n')
    const r = await trace(root, { write: false })
    expect(r.findings.filter(f => f.rule === 'ids-outside-stories').map(f => f.file)).toEqual(['app/notes.py'])
  },
})
