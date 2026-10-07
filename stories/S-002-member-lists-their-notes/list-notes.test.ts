import { describe, expect, test } from 'vitest'
import type { Note } from '../../src/domain/note'
import { fakeNoteStore } from '../../test/fakes/note-store'
import { listNotes } from './list-notes'

const note = (id: string, ownerId: string, createdAt: string): Note => ({ id, ownerId, title: id, body: '', createdAt })

describe('S-002 member lists their notes', () => {
  test('S-002.1 only my notes', async () => {
    const run = listNotes({ notes: fakeNoteStore([note('a', 'ana', '2026-01-01'), note('b', 'ben', '2026-01-01')]) })
    expect((await run({ memberId: 'ana' })).notes.map(n => n.id)).toEqual(['a'])
  })

  test('S-002.2 newest first', async () => {
    const run = listNotes({ notes: fakeNoteStore([note('Old', 'ana', '2026-01-01'), note('New', 'ana', '2026-01-02')]) })
    expect((await run({ memberId: 'ana' })).notes.map(n => n.id)).toEqual(['New', 'Old'])
  })
})
