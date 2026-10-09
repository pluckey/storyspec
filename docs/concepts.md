# Concepts

## The story is the unit

Most codebases organize by technical layer (controllers, services, repositories) or by feature, and keep requirements somewhere else: a ticket, a wiki, a spec folder that drifts. storyspec makes the **story** the permanent unit. Its folder holds:

| File | Role |
|---|---|
| `story.md` | Who wants what and why, plus `id`, `title`, `epic`, `status`, `version` and a revision log |
| `spec.md` | One requirement, a single EARS sentence (`WHEN … THE SYSTEM SHALL …`) tagged `{#S-001}`, GIVEN/WHEN/THEN scenarios tagged `{#S-001.1}` … for every case, and optionally the story's decisions (see below) |
| `<use-case>.ts` | The behaviour, tagged `// @implements S-001`. Every decision the story makes lives here. |
| `<use-case>.types.ts` | Request and response types |
| `scenarios.gen.ts` | Generated from spec.md; never edited by hand |
| `<use-case>.test.ts` | `story(gen, { … })`: exactly one case per scenario, enforced by the type system |

A story's whole history is `git log stories/S-001-*`, a review of S-001 touches one folder, and "implement S-007" gives an agent an obvious destination and a finish line.

### story.md front matter

| Field | Written by | Meaning |
|---|---|---|
| `id`, `title`, `epic` | you | The story's ID (matching its folder), its title (the folder's slug), and its group in TRACE.md |
| `status` | you | `draft`, `ready`, `in-progress` or `superseded`; `done` is derived (see Lifecycle) |
| `version` | you | Bumped when the spec's behaviour changes, with a line under Revisions |
| `proof` | you, optional | The tiers every scenario needs, comma-separated (`local, deployed`), unless a scenario's tag says otherwise |
| `implementedBy` | you, optional | The files that implement the story when they aren't TypeScript in its folder, comma-separated: `implementedBy: app/usecases/publish.py, app/entry/http.py` |
| `after` | you, optional | Stories this one is built after, comma-separated: the order the product grows in, not a change in behaviour. TRACE.md shows it, and the `after` rule checks the stories exist and the order never loops |

## Requirement and scenarios

```
Story ─1──1─ Requirement (one sentence: the behaviour)
                 └─1──*─ Scenario (every case: normal, edge, error) ─1──1─ Test
```

The requirement says *what* the story does, in one sentence. The scenarios say *exactly how* it behaves in each case. Conditions never go in the requirement as extra SHALL lines: a second SHALL would be a statement of behaviour with no test of its own. As a scenario, it gets exactly one, enforced by the type system.

If two SHALL statements really are different behaviours, they're two stories.

## Decisions

Scenarios pin what every implementation must do. A story also makes judgment calls they don't pin, such as how long a token lasts, how slug clashes are resolved, or whether usernames are case-sensitive. An agent regenerating the code makes those calls again, silently, and may choose differently. A cleanroom regeneration of the RealWorld example made about 27 such choices, and at least 5 differed from the original while every test passed.

Record them under `### Decisions` in spec.md, one bullet each, and say which kind each is:

```
### Decisions

- Slug clashes get -2, -3, … after the title's slug; pinned by S-006.3
- Tokens last 7 days (free)
```

- **Pinned:** name the scenario that proves it, and every implementation must agree. Add the scenario if there isn't one.
- **Free:** any reasonable choice is acceptable. The bullet records what this implementation chose, so a reader or an agent knows it was a choice.

The `decisions` rule errors on a pin to a scenario that doesn't exist, and warns on a decision that is neither pinned nor free. TRACE.md lists every decision. When you find a silent choice that matters (a bug report, a regeneration that differs), pin it.

## Lifecycle

| Status | Written by | Meaning | The trace treats gaps as |
|---|---|---|---|
| draft | you | Being written | warnings |
| ready | you | Scenarios approved | warnings |
| in-progress | you | Being built | errors |
| done | **the trace** | Every scenario proven in every tier it needs, at its current text | errors |
| superseded | you | Replaced; kept for history | exempt |

Nobody writes `done`. A hand-written status was a second source of truth that could disagree with the tests; now the trace works it out from the proof and shows `done (v3)` in TRACE.md.

## Proof

A scenario is proven in **tiers**: `local` (tests that run on every check, the default), any tier a project configures with a command (for example `deployed`, tests against real infrastructure), and `manual` (a person checks it with `storyspec prove`). A scenario names the tiers it needs on its tag (`{#S-006.1 proof=local,deployed}`), or a story does in story.md (`proof: …`); `defaultProof` in config covers the rest. Its `story()` case then has one function per tier that runs tests, checked at compile time.

Local results come from the run in front of you. Every other tier's results are recorded in `stories/PROOF.json`, committed with the code: outcome, date, story version, commit, and a **hash of the scenario's text**. A proof of other wording is stale, so a scenario whose meaning was rewritten under the same ID can't stay proven by a test of the old meaning. Adapters are tracked the same way: the ports table shows which tiers exercised each adapter, so an adapter over a real service is only proven by a tier that reached it.

**New behaviour gets a new story. Changed behaviour revises the existing story:** edit spec.md, bump `version`, add a revision line, update the tests. That keeps exactly one owner per behaviour.

## Ports and adapters underneath

Stories depend on **ports** (interfaces for anything external: storage, time, IDs, other services) and on **domain** types and pure rules. They never touch databases, frameworks or vendor SDKs.

```
src/domain      entities, value types, pure rules shared by stories
src/ports       interfaces stories need
src/adapters    port implementations, grouped by technology (memory, postgres, http-client…)
src/presenters  shape output for one kind of caller (HTTP, CLI, MCP…)
src/entry       delivery mechanisms + composition.ts, the one place that wires adapters into stories
test/fakes      in-memory ports for story tests
test/contracts  one suite per port, run against every adapter and the fake
```

The contract suites make the fakes honest: a story tested against `fakeNoteStore` is trustworthy against Postgres only if both pass the same `NoteStore` contract.

## Why stories don't import each other

If two stories share logic, that logic is a rule of the domain, so it moves into `src/domain` as a pure function both call. That keeps stories independent: you can revise, supersede or delete one without breaking another, and the trace can attribute every decision to exactly one story.

## Why the IDs live in the code

IDs in the spec, the `@implements` tag and the test cases let a few hundred lines of code build a complete traceability matrix with no database, plugin or SaaS. Because the generated scenario types come from the spec, the most important link (spec ↔ tests) is checked by the TypeScript compiler, live in your editor.
