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
- **Status:** draft → ready → in-progress. **Never write `done`**: the trace shows a story as done when every scenario is proven in every tier it needs (see Proof tiers). A retired story becomes `superseded`: it stays in the trace for history and is exempt from the rules.
- **One requirement per story, one sentence:** `WHEN <trigger> THE SYSTEM SHALL <response>.` It says what the story does.
- **Every condition, edge case and error is a scenario,** not another SHALL line. That way each one gets exactly one test, and nothing in the spec is untested. (The trace fails if the requirement has more than one SHALL.)
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

## Proof tiers

A scenario is proven in the tiers it needs: `local` (the default: tests that run on every check), a tier you configure such as `deployed` (tests against real infrastructure), or `manual` (a person checks it). Declare other tiers on the scenario tag, or for a whole story with `proof: local, deployed` in story.md:

```markdown
#### Scenario: Only granted tools are listed {#S-006.1 proof=local,deployed}
#### Scenario: The member consents in their browser {#S-010.2 proof=manual}
```

Then its case has one function per tier that runs tests (a manual-only scenario's case is `{}`):

```ts
story(gen, {
  'S-006.1': { local: () => { /* fakes */ }, deployed: async () => { /* the real system */ } },
  'S-010.2': {},
})
```

- `npm run check` proves the local tier. `npx storyspec trace --tier deployed` runs the deployed tier's command (`tiers` in storyspec.config.json) and records the results in `stories/PROOF.json`; commit that file.
- `npx storyspec prove S-010.2` records a person's check (`--fail`, `--note "…"`).
- Every recorded proof carries a hash of the scenario's text. Change the text and the proof is stale: the trace warns and the story is no longer done until it is proven again.
- `npx storyspec trace --require-proven` fails unless every story past ready is done; use it to gate a release.
- Don't branch on the environment inside a case (`if (deployed) …`): give the scenario the tier and the case a function for it.

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
- **Compose per entry point.** When there are several entry points (an API, a scheduled job, a webhook handler), each builds only the adapters its stories use, so one entry point's settings or permissions never become another's requirement.
- Presenters, adapters and entry points make no business decisions. Story IDs never appear in `src/`.
- An HTTP entry parses the request, calls a story from `compose()`, and hands the result to a presenter that maps it to a status and body (e.g. `ok` → 200/201, expected error → 4xx). The example app in the storyspec repo (`template/src/entry/http.ts`) shows the shape.

## Ports, fakes and contract suites

Every port with an adapter needs a contract suite that **actually runs**. The trace fails (`contract-tests`) if no test outside `stories/` that ran exercises the port. Use two files, because Vitest only runs `*.test.ts`:

```ts
// test/contracts/todo-store.contract.ts: the suite, exported, not run by itself
export const todoStoreContract = (name: string, make: () => TodoStore) =>
  describe(`TodoStore contract: ${name}`, () => { test('…', async () => { … }) })

// test/contracts/todo-store.test.ts: the runner, one line per implementation
todoStoreContract('src/adapters/memory/todo-store.ts', () => new MemoryTodoStore())
todoStoreContract('test fake', () => fakeTodoStore())
```

**Name each run after the adapter's file**, as above: the trace counts an adapter as exercised in a tier only when a test that ran there names it, so the ports table shows which tiers proved each adapter. An adapter over a real service is proven by the tier that reaches the service (`if (process.env.…) storeContract('src/adapters/postgres/todo-store.ts', …)` inside that tier's run).

Adapter tests live in `test/`, not beside the adapter in `src/adapters` (adapters may not import test code).

## Adding things

| You need | Do this |
|---|---|
| A new behaviour | `npm run story`, then the order of work above |
| A new external dependency (DB, API, queue, clock, IDs) | Port in `src/ports`, fake in `test/fakes`, contract suite + runner in `test/contracts`, adapter in `src/adapters/<tech>/`, wire it in `composition.ts` |
| A new way to call the app (CLI, webhook) | Entry file in `src/entry`, presenter in `src/presenters` if the output shape differs |
| A rule two stories share | Pure function in `src/domain`, used by both stories |
| A rule every story in an area obeys (e.g. admin-only) | Pure function in `src/domain`, plus one scenario per story that proves it applies there |
| A scenario that turns out to be infeasible | Drop it from the story (a revision if the story was approved) and create a draft story for it, so the gap is visible in the trace |

## Checks

- `npm run check`: generated files are fresh, typecheck, then trace.
- `npm run trace`: runs the tests and writes `stories/TRACE.md` with two tables: stories (epic → story → implementation → scenario → result) and ports (port → adapters → contract tests that ran). It fails on gaps, orphans, stale generated files, untested adapters or layer violations, and prints warnings (like a port with no adapter yet, or a folder that doesn't match its title) above the result. Each finding names its rule; `node_modules/storyspec/docs/rules.md` explains every rule and its fix. Paths and prefixes are in `storyspec.config.json`.
- Drafts and ready stories only warn about missing code, tests or failing tests. Every other story fails on them.

## Before designing on a platform

- **Write down what the platform must do for the story to work** (in story.md: "Platform facts"), each with its evidence: a documentation link, a probe you ran, or a deployed test. A fact you only believe is a risk; a short probe usually settles it before any code is written.
- An adapter over a probabilistic service (a classifier, an LLM, a content scanner) gets contract assertions about presence and absence, never exact equality.

## Tests against a deployed system

- Tests that run against real infrastructure share it: mark everything a test creates with a unique marker, read back only what carries your marker, and never delete or consume what other tests might be reading.
- Touch only state your infrastructure-as-code doesn't manage, or the next plan will try to undo it.
- When several cases need the same slow setup (a deployment change, a log that takes a minute to show up), do it once in a shared run the cases read from, instead of each case paying for it.
- A marker in text that a scanner reads must not look like a secret or an identifier, or the scanner may mask it.

## Updating storyspec

This guidance and the `/story` command come from the installed storyspec version. To update both:

```bash
npm i -D storyspec@latest
npx storyspec sync    # rewrites the storyspec blocks in AGENTS.md and CLAUDE.md, the /story command and its hooks
npx storyspec migrate # updates stories for the new version, if it changed their format
npm run check
```

`sync` never touches text outside its blocks. If you edited inside a block it stops and says where; move your notes below the block, then run it again.
