import { MemoryNoteStore } from '../../src/adapters/memory/note-store'
import { fakeNoteStore } from '../fakes/note-store'
import { noteStoreContract } from './note-store.contract'

noteStoreContract('memory adapter', () => new MemoryNoteStore())
noteStoreContract('test fake', () => fakeNoteStore())
