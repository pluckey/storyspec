import type { Note } from '../../src/domain/note'
import type { Result } from '../../src/domain/result'

export type SaveNoteRequest = { memberId: string; title: string; body: string }
export type SaveNoteResponse = Result<Note>
