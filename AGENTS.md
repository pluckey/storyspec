# Working in this repo

This repo is organized around **stories**. A story owns its spec, its implementation and its tests, in one folder. The shared code in `src/` is plumbing that stories plug into through ports. `npm run check` enforces all of it.

## A story

```
stories/S-001-member-saves-a-note/
  story.md                As a… I want… so that…  (front matter: id, title, epic, status, version)
  spec.md                 EARS requirement {#S-001}, GIVEN/WHEN/THEN scenarios {#S-001.1} …
  save-note.ts            the use case: one exported factory, first line // @implements S-001
  save-note.contract.ts   request and response types
  save-note.test.ts       one test per scenario, named after it: test('S-001.1 …')
```

- **New behaviour gets a new story:** `npm run story -- "<title>" --epic "<epic>"`.
- **Changed behaviour revises its story:** edit spec.md, bump `version`, add a line under Revisions, update the tests. Don't open a second story for the same behaviour.
- **Status:** draft → ready → in-progress → done, or superseded. A done story needs every scenario test passing.
- **Requirements** use EARS: `WHEN <trigger> THE SYSTEM SHALL <response>.` Every requirement has at least one scenario.
- **Order of work:** scenarios (get them approved) → failing tests → use case → wiring → `npm run check`.

## The use case

- It's a factory that takes its dependencies (ports) and returns the operation: `saveNote({ notes, clock })(request)`.
- It holds every decision the story makes. Expected failures come back as values (`Result`), not exceptions.
- It imports only its own folder, `src/domain` and `src/ports`. Its tests may also use `test/`.
- **Stories never import each other.** Logic two stories share becomes a pure function in `src/domain`.

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
- **Every adapter passes its port's contract suite** in `test/contracts/`, and so does the test fake. That's what makes a story tested against a fake trustworthy against the real thing.

## Adding things

| You need | Do this |
|---|---|
| A new behaviour | `npm run story`, then the order of work above |
| A new external dependency (DB, API, queue) | Port in `src/ports`, fake in `test/fakes`, contract suite in `test/contracts`, adapter in `src/adapters/<tech>/`, wire it in `composition.ts` |
| A new way to call the app (CLI, webhook) | Entry file in `src/entry`, presenter in `src/presenters` if the output shape differs |
| A rule two stories share | Pure function in `src/domain`, used by both stories |

## Checks

- `npm run check`: typecheck, then trace.
- `npm run trace`: runs the tests, writes `stories/TRACE.md` (epic → story → implementation → scenario → result), and fails on gaps, orphans or layer violations. Rules are at the top of `tools/trace.ts`; paths and prefixes are in `storyspec.config.json`.
- Drafts and ready stories only warn about missing code or tests. In-progress and done stories fail.
