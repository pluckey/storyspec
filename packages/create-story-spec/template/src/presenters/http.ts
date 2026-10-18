import type { Note } from '../domain/note'
import type { Result } from '../domain/result'

// Shapes use case output for HTTP callers. Formatting only; no decisions.
export type HttpResponse = { status: number; body: unknown }

export const presentNote = (r: Result<Note>): HttpResponse =>
  r.ok ? { status: 201, body: r.value } : { status: 422, body: { error: r.error } }

export const presentNotes = (notes: Note[]): HttpResponse => ({ status: 200, body: { notes } })
