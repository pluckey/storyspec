// @implements S-001
import { titleProblem } from '../../src/domain/note'
import { err, ok } from '../../src/domain/result'
import type { Clock } from '../../src/ports/clock'
import type { NoteStore } from '../../src/ports/note-store'
import type { SaveNoteRequest, SaveNoteResponse } from './save-note.types'

export const saveNote = (deps: { notes: NoteStore; clock: Clock }) =>
  async (req: SaveNoteRequest): Promise<SaveNoteResponse> => {
    const problem = titleProblem(req.title)
    if (problem) return err(problem)

    const note = {
      id: deps.clock.id(),
      ownerId: req.memberId,
      title: req.title.trim(),
      body: req.body,
      createdAt: deps.clock.now().toISOString(),
    }
    await deps.notes.save(note)
    return ok(note)
  }
