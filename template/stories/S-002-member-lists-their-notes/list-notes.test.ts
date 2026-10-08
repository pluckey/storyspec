import { expect } from 'vitest'
import { story } from 'storyspec/vitest'
import type { Note } from '../../src/domain/note'
import { fakeNoteStore } from '../../test/fakes/note-store'
import { listNotes } from './list-notes'
import { gen } from './scenarios.gen'

const note = (id: string, ownerId: string, createdAt: string): Note => ({ id, ownerId, title: id, body: '', createdAt })

story(gen, {
  'S-002.1': async () => {
    const run = listNotes({ notes: fakeNoteStore([note('a', 'ana', '2026-01-01'), note('b', 'ben', '2026-01-01')]) })
    expect((await run({ memberId: 'ana' })).notes.map(n => n.id)).toEqual(['a'])
  },

  'S-002.2': async () => {
    const run = listNotes({ notes: fakeNoteStore([note('Old', 'ana', '2026-01-01'), note('New', 'ana', '2026-01-02')]) })
    expect((await run({ memberId: 'ana' })).notes.map(n => n.id)).toEqual(['New', 'Old'])
  },

  // Proven by a person (proof=manual in spec.md): nothing to run.
  'S-002.3': {},
})
