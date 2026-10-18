import type { Note } from '../../src/domain/note'
import type { NoteStore } from '../../src/ports/note-store'

// Test fake: like the memory adapter, but exposes what was saved for assertions.
export const fakeNoteStore = (seed: Note[] = []) => {
  const saved = [...seed]
  const store: NoteStore & { saved: Note[] } = {
    saved,
    save: async n => { saved.push(n) },
    listByOwner: async ownerId =>
      saved.filter(n => n.ownerId === ownerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  }
  return store
}
