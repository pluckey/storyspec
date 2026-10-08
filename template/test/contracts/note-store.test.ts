import { MemoryNoteStore } from '../../src/adapters/memory/note-store'
import { fakeNoteStore } from '../fakes/note-store'
import { noteStoreContract } from './note-store.contract'

noteStoreContract('src/adapters/memory/note-store.ts', () => new MemoryNoteStore())
noteStoreContract('test fake', () => fakeNoteStore())
