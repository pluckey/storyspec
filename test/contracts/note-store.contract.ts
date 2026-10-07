import { describe, expect, test } from 'vitest'
import type { Note } from '../../src/domain/note'
import type { NoteStore } from '../../src/ports/note-store'

// Every NoteStore adapter (and the fake) must pass this suite, so stories tested
// against the fake behave the same against real storage.
export const noteStoreContract = (name: string, make: () => NoteStore) =>
  describe(`NoteStore contract: ${name}`, () => {
    const note = (id: string, ownerId: string, createdAt: string): Note => ({ id, ownerId, title: id, body: '', createdAt })

    test('lists only the owner’s notes', async () => {
      const store = make()
      await store.save(note('a', 'ana', '2026-01-01T00:00:00Z'))
      await store.save(note('b', 'ben', '2026-01-02T00:00:00Z'))
      expect((await store.listByOwner('ana')).map(n => n.id)).toEqual(['a'])
    })

    test('lists newest first', async () => {
      const store = make()
      await store.save(note('old', 'ana', '2026-01-01T00:00:00Z'))
      await store.save(note('new', 'ana', '2026-01-02T00:00:00Z'))
      expect((await store.listByOwner('ana')).map(n => n.id)).toEqual(['new', 'old'])
    })
  })
