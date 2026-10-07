import type { Note } from '../domain/note'

// Owned by the core: stories depend on this interface, adapters implement it.
export interface NoteStore {
  save(note: Note): Promise<void>
  listByOwner(ownerId: string): Promise<Note[]>
}
