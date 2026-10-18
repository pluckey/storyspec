import type { Note } from '../../domain/note'
import type { NoteStore } from '../../ports/note-store'

// Runnable in-memory adapter for local development. A database adapter would sit
// beside it (src/adapters/postgres/…) and pass the same contract suite.
export class MemoryNoteStore implements NoteStore {
  private readonly notes: Note[] = []

  async save(note: Note) {
    this.notes.push(note)
  }

  async listByOwner(ownerId: string) {
    return this.notes
      .filter(n => n.ownerId === ownerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
}
