# storyspec

A starting point for apps where **the story is the unit of development**. Each story is one folder holding its spec, the code that implements it and the tests that prove it. Underneath sits clean architecture with ports and adapters, and a single check (`npm run check`) keeps the two honest.

Clone it, delete the example notes app, and build anything: an API, a CLI, a worker, the back end of a web app.

```
stories/S-001-member-saves-a-note/
  story.md      As a member, I want to save a note… (status, version, revisions)
  spec.md       WHEN … THE SYSTEM SHALL …  +  scenarios {#S-001.1} {#S-001.2} …
  save-note.ts  // @implements S-001
  scenarios.gen.ts    generated from spec.md
  save-note.test.ts   story(gen, { 'S-001.1': …, 'S-001.2': …, 'S-001.3': … })
```

Tests are typed against the spec: add a scenario to `spec.md`, run `npm run gen`, and the test file stops compiling until that scenario has a case.

`npm run trace` turns that into a matrix and fails when anything is missing or out of place:

| Epic | Story | Status | v | Implementation | Scenario | Test |
|---|---|---|---|---|---|---|
| E-1 Notes | S-001 Member saves a note | done | 1 | stories/S-001-member-saves-a-note/save-note.ts | S-001.1 | ✓ pass |
| | | | | | S-001.2 | ✓ pass |
| E-1 Notes | S-002 Member lists their notes | done | 1 | stories/S-002-member-lists-their-notes/list-notes.ts | S-002.1 | ✓ pass |

## Quick start

```bash
npm create storyspec@latest my-app && cd my-app
npm run check          # typecheck + tests + trace
npm run dev            # example HTTP app on :3000
curl -X POST localhost:3000/notes -H 'x-member-id: ana' -d '{"title":"Groceries"}'
curl localhost:3000/notes -H 'x-member-id: ana'
```

Start your own story:

```bash
npm run story -- "Member deletes a note" --epic "E-1 Notes"
npm run gen            # after writing the scenarios
```

With Claude Code, run `/story "Member deletes a note"` instead. It drafts the scenarios, waits for your approval, writes failing tests, implements the use case and runs the trace. Other agents get the same rules from `AGENTS.md`.

## Why

- **One place per behaviour.** The story's spec, code and tests sit together, so reviews, history (`git log stories/S-001-*`) and changes stay scoped.
- **Traceable by construction.** IDs in the spec, the code and the test names line up, and the trace fails on gaps, orphans or a "done" story with a failing test.
- **Swappable edges.** Stories depend on ports, never on databases, frameworks or vendors. Adapters plug in at one composition root, and contract suites prove each adapter behaves like the fake the stories were tested with.
- **Agent-friendly.** "Implement S-007" has an obvious destination and an objective finish line.

## How it fits together

```
          spec.md ── scenarios ──► *.test.ts  (fakes from test/fakes)
             │                         │
             ▼                         ▼
 stories/<ID>/<use-case>.ts  ◄── the story's decisions live here
             │ depends on
             ▼
   src/ports  ◄── implemented by ── src/adapters/<tech>   (proven by test/contracts)
   src/domain (entities, pure shared rules)
             ▲
 src/entry/composition.ts wires adapters into stories
 src/entry/<http|cli|…>.ts parse → call story → src/presenters/<caller>.ts
```

| Folder | Holds | May import |
|---|---|---|
| `stories/<ID>-<slug>/` | One story: story.md, spec.md, use case, contract types, tests | own folder, `src/domain`, `src/ports` (tests also `test/`) |
| `src/domain` | Entities, value types, pure rules shared by stories | domain |
| `src/ports` | Interfaces stories depend on | domain |
| `src/adapters/<tech>` | Port implementations | domain, ports |
| `src/presenters` | Output shaping per caller | domain |
| `src/entry` | Delivery mechanisms + `composition.ts` (the only importer of stories) | anything |
| `test/fakes` | In-memory port implementations for story tests | domain, ports, test |
| `test/contracts` | One suite per port, run against every adapter and the fake | anything outside stories |

## The rules the trace enforces

1. Each story folder has `story.md`, `spec.md` with a requirement `{#ID}` and scenarios `{#ID.n}`, a fresh `scenarios.gen.ts`, exactly one file tagged `@implements ID`, and a test for every scenario.
2. Stories import only their own folder, `src/domain` and `src/ports`; never each other.
3. Story IDs appear nowhere outside `stories/`, and only `composition.ts` imports stories.
4. Each `src/` layer imports only what the table above allows.
5. A `done` story has every scenario test passing.

Draft and ready stories only warn about missing code or tests. Ports without an adapter produce a warning.

## Story lifecycle

| Status | Meaning | Trace treats gaps as |
|---|---|---|
| draft | Being written | warnings |
| ready | Scenarios approved | warnings |
| in-progress | Being built | errors |
| done | Every scenario test passes | errors (and tests must pass) |
| superseded | Replaced; keep for history | errors |

Changing behaviour means revising the story (bump `version`, add a Revisions line), not adding a new one. New behaviour gets a new story.

## Making it yours

- **Start without the example:** `npm create storyspec@latest my-app -- --no-example` gives you the structure, the tooling and one draft story.
- **Rename the ID prefix or move folders:** `storyspec.config.json` holds the ID prefix, the stories folder, the wiring files and each layer's allowed imports. Your editor autocompletes it from the schema.
- **Change the story templates:** put your own `story.md` and `spec.md` in `templates/story/`; new stories are copied from there instead of the built-in ones.
- **Upgrade the tooling:** `npm update storyspec`. Rules and fixes ship in the package, not in your copy.
- **CI:** run `npm ci && npm run check`.

## FAQ

**Ten stories all touch the same flow. Doesn't this fragment it?** Each story is one behaviour with one use case. If several stories need the same logic, move it into `src/domain` as a pure function they all call. If they're really the same behaviour, they're one story with revisions.

**Where do UI components go?** A front end is another delivery mechanism. Keep it in its own package or under `src/entry`, calling stories through an API, so the stories stay framework-free.

**Isn't a port for everything overkill?** Only external things (storage, time, IDs, network services) get ports. Pure logic is just a function in `src/domain`.
