import type { Note } from '../../src/domain/note'

export type ListNotesRequest = { memberId: string }
export type ListNotesResponse = { notes: Note[] }
