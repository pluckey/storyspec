// @implements S-002
import type { NoteStore } from '../../src/ports/note-store'
import type { ListNotesRequest, ListNotesResponse } from './list-notes.types'

// Ordering is part of the NoteStore contract, so this story stays a thin use case.
export const listNotes = (deps: { notes: NoteStore }) =>
  async (req: ListNotesRequest): Promise<ListNotesResponse> =>
    ({ notes: await deps.notes.listByOwner(req.memberId) })
