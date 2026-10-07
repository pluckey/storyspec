// The only place that wires adapters into stories. Swap adapters here
// (memory → postgres, system clock → …) without touching any story.
import { saveNote } from '../../stories/S-001-member-saves-a-note/save-note'
import { listNotes } from '../../stories/S-002-member-lists-their-notes/list-notes'
import { systemClock } from '../adapters/memory/clock'
import { MemoryNoteStore } from '../adapters/memory/note-store'

export const compose = () => {
  const notes = new MemoryNoteStore()
  const clock = systemClock
  return {
    saveNote: saveNote({ notes, clock }),
    listNotes: listNotes({ notes }),
  }
}

export type App = ReturnType<typeof compose>
