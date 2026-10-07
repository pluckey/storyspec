# Working in this repo

This repo is organized around **stories**. A story owns its spec, its implementation and its tests, in one folder. The shared code in `src/` is plumbing that stories plug into through ports. `npm run check` enforces all of it.

## A story

```
stories/S-001-member-saves-a-note/
  story.md                As a… I want… so that…  (front matter: id, title, epic, status, version)
  spec.md                 EARS requirement {#S-001}, GIVEN/WHEN/THEN scenarios {#S-001.1} …
  save-note.ts            the use case: one exported factory, first line // @implements S-001
  save-note.types.ts      request and response types
  scenarios.gen.ts        generated from spec.md by `npm run gen` (never edit)
  save-note.test.ts       story(gen, { 'S-001.1': …, 'S-001.2': … }): one case per scenario
```

- **New behaviour gets a new story:** `npm run story -- "<title>" --epic "<epic>"`. Don't repurpose another story's folder.
- **The folder is `<ID>-<slug of the title>`.** If you change a title, rename the folder to match (keep the ID) and run `npm run gen`; the trace warns when they drift.
- **Changed behaviour revises its story:** edit spec.md, bump `version`, add a line under Revisions, update the tests. Don't open a second story for the same behaviour.
- **Status:** draft → ready → in-progress → done. A done story needs every scenario test passing. A retired story becomes `superseded`: it stays in the trace for history and is exempt from the rules.
- **Requirements** use EARS: `WHEN <trigger> THE SYSTEM SHALL <response>.` Every requirement has at least one scenario.
- **Order of work:** scenarios (get them approved) → `npm run gen` → failing tests → use case → wiring → `npm run check`.

## Story tests

```ts
import { expect } from 'vitest'
import { story } from 'storyspec/vitest'
import { gen } from './scenarios.gen'

story(gen, {
  'S-001.1': async () => { /* arrange, act, assert */ },
  'S-001.2': () => { /* sync is fine too */ },
})
```

- `story(gen, cases)` registers one Vitest test per scenario, named `<ID> <scenario title>` from spec.md, inside a `describe('<story ID> <story title>')`.
- Each case takes no arguments and may return a promise. Use `expect` from `vitest` as usual.
- The type requires **exactly** the scenarios in spec.md: a missing case or an unknown key fails the typecheck. After editing scenarios, run `npm run gen` and fix what the typecheck reports.

## The use case

- It's a factory that takes its dependencies (ports) and returns the operation: `saveNote({ notes, clock })(request)`.
- It holds every decision the story makes. Expected failures come back as values (`Result` in `src/domain/result.ts`), not exceptions.
- It imports only its own folder, `src/domain` and `src/ports`. Its tests may also use `test/`.
- **Stories never import each other.** Logic two stories share becomes a pure function in `src/domain`.
- **Anything nondeterministic is a port:** time (`Clock.now()`), IDs (`Clock.id()` or an `IdGenerator`), randomness. That keeps story tests exact.

## The shared kernel (`src/`)

| Folder | Holds | May import |
|---|---|---|
| `src/domain` | Entities, value types, pure rules | domain |
| `src/ports` | Interfaces stories depend on (storage, clock, external services) | domain |
| `src/adapters` | Port implementations (memory, databases, APIs), grouped by technology | domain, ports |
| `src/presenters` | Shaping output for one kind of caller (HTTP, CLI, MCP…) | domain |
| `src/entry` | Delivery mechanisms (HTTP server, CLI, Lambda) and `composition.ts` | anything |

- `src/entry/composition.ts` is the only file that imports stories and chooses adapters.
- Presenters, adapters and entry points make no business decisions. Story IDs never appear in `src/`.
- An HTTP entry parses the request, calls a story from `compose()`, and hands the result to a presenter that maps it to a status and body (e.g. `ok` → 200/201, expected error → 4xx). The example app in the storyspec repo (`template/src/entry/http.ts`) shows the shape.

## Ports, fakes and contract suites

Every port with an adapter needs a contract suite that **actually runs**. The trace fails (`contract-tests`) if no test outside `stories/` that ran exercises the port. Use two files, because Vitest only runs `*.test.ts`:

```ts
// test/contracts/todo-store.contract.ts: the suite, exported, not run by itself
export const todoStoreContract = (name: string, make: () => TodoStore) =>
  describe(`TodoStore contract: ${name}`, () => { test('…', async () => { … }) })

// test/contracts/todo-store.test.ts: the runner, one line per implementation
todoStoreContract('memory adapter', () => new MemoryTodoStore())
todoStoreContract('test fake', () => fakeTodoStore())
```

Adapter tests live in `test/`, not beside the adapter in `src/adapters` (adapters may not import test code).

## Adding things

| You need | Do this |
|---|---|
| A new behaviour | `npm run story`, then the order of work above |
| A new external dependency (DB, API, queue, clock, IDs) | Port in `src/ports`, fake in `test/fakes`, contract suite + runner in `test/contracts`, adapter in `src/adapters/<tech>/`, wire it in `composition.ts` |
| A new way to call the app (CLI, webhook) | Entry file in `src/entry`, presenter in `src/presenters` if the output shape differs |
| A rule two stories share | Pure function in `src/domain`, used by both stories |

## Checks

- `npm run check`: generated files are fresh, typecheck, then trace.
- `npm run trace`: runs the tests and writes `stories/TRACE.md` with two tables: stories (epic → story → implementation → scenario → result) and ports (port → adapters → contract tests that ran). It fails on gaps, orphans, stale generated files, untested adapters or layer violations, and prints warnings (like a port with no adapter yet, or a folder that doesn't match its title) above the result. Each finding names its rule; `node_modules/storyspec/docs/rules.md` explains every rule and its fix. Paths and prefixes are in `storyspec.config.json`.
- Drafts and ready stories only warn about missing code or tests. In-progress and done stories fail.
