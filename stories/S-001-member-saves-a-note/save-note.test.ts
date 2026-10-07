import { describe, expect, test } from 'vitest'
import { fixedClock } from '../../test/fakes/clock'
import { fakeNoteStore } from '../../test/fakes/note-store'
import { saveNote } from './save-note'

const setup = () => {
  const notes = fakeNoteStore()
  return { notes, run: saveNote({ notes, clock: fixedClock('2026-01-01T09:00:00.000Z') }) }
}

describe('S-001 member saves a note', () => {
  test('S-001.1 valid note is saved', async () => {
    const { notes, run } = setup()
    const res = await run({ memberId: 'ana', title: 'Groceries', body: 'eggs' })
    expect(res).toEqual({ ok: true, value: { id: 'id-1', ownerId: 'ana', title: 'Groceries', body: 'eggs', createdAt: '2026-01-01T09:00:00.000Z' } })
    expect(notes.saved).toHaveLength(1)
  })

  test('S-001.2 empty title is rejected', async () => {
    const { notes, run } = setup()
    expect(await run({ memberId: 'ana', title: '   ', body: '' })).toEqual({ ok: false, error: 'Title is required' })
    expect(notes.saved).toHaveLength(0)
  })

  test('S-001.3 title is trimmed', async () => {
    const { notes, run } = setup()
    await run({ memberId: 'ana', title: '  Groceries  ', body: '' })
    expect(notes.saved[0]?.title).toBe('Groceries')
  })
})
