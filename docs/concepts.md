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
| `trigger` | you, optional | What starts the story, as `kind:name`: `actor:<role>` (a person in a role), `event:<event>` (another story emitted it), `schedule:<name>` (time passed) or `external:<system>` (another system called in). One per story. TRACE.md shows it beside the story and lists every trigger in a Triggers table |
| `emits` | you, optional | Events the story emits, comma-separated. A story whose trigger is `event:<name>` starts when one is emitted, so the Triggers table shows how stories hand on to each other |
| `persona` | you, optional | The personas the story is for, comma-separated, as keys from `stories/PERSONAS.md` (`persona: player, developer`). Without it, the "As a…" line decides (see Personas) |

### Organising stories

`epic` is the area of the product a story belongs to. `trigger` is what starts it. Persona alone doesn't organise stories well: in a workflow app, half the stories start when another story changes something (a vendor moving to Review notifies its reviewer), when time passes, or when another system calls in, and no person starts them. So the trigger says who or what *starts* the story, and the "As a… I want… so that…" text says who *benefits*. When no person starts a story, keep the "so that" (why it matters) and name whoever benefits, even if that is the organisation.

Personas are a view across the folders, not a way to file them: `persona:` says who a story is *for*, which isn't always who starts it, and the trace doesn't ask `persona` and `trigger: actor:` to match.

### Personas

List the people the product serves in `stories/PERSONAS.md`, one `## Name` heading each, followed by a line or two about them:

```markdown
# Personas

## Player

Plays the game alone, a few evenings a week.

## Developer

Builds levels and ships the game.
```

A persona's key is its heading lower-cased, with hyphens for spaces (`## Game Master` is `game-master`). A story names the ones it serves with `persona:`; without the field, its "As a player, I want…" line names one, matched the same way after the article, so an existing project gets the view without editing a story. An open decision can say who answers it: `(open: player)` instead of `(open)`.

With PERSONAS.md present, the trace warns on a story serving a persona it doesn't describe (`unknown-persona`), a persona no story serves (`persona-without-stories`), and a story whose `persona:` and "As a…" line disagree (`persona-prose-mismatch`). They are warnings because a persona is a lens, not a contract; raise them in `rules` to make them strict. TRACE.md ends with a grid of epics down and personas across, each cell counting that epic's stories for that persona as done / in progress / draft, and `storyspec trace --by persona` makes the stories table one table per persona, in PERSONAS.md order (a story for two personas appears under both). Without PERSONAS.md, none of this happens and the trace reads as before.

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
- **Open:** nobody has answered it yet, and only someone else can (a client's approval threshold, a risk team's weights). Write `(open)` and name the scenarios that wait for it: `- Approval threshold in USD a year (open); S-003.1`. Those scenarios are *blocked*: they need no test yet, TRACE.md shows them as blocked, and their story can't be done. A test of a blocked scenario is a warning, because it had to assume an answer nobody gave. To answer the decision, replace `(open)` with the answer; the scenarios it names become its pins.

The `decisions` rule errors on a pin to a scenario that doesn't exist, and warns on a decision that is open or is neither pinned, free nor open. TRACE.md lists every decision. When you find a silent choice that matters (a bug report, a regeneration that differs), pin it.

## The model

Many products move records through states: a vendor goes from Draft to Review to Approved. Write the records and their states once, in `stories/MODEL.md`:

```markdown
# Model

## Vendor

Notes about the record are fine; the trace reads only the transitions.

- Draft → Review → Finance approval → Approved
- Review → Approved
- Finance approval → Rejected
```

Each `## Name` is a record, and each bullet of state names joined by `→` (or `->`) lists transitions. A state no transition leads to is where records start. Each record has the events `<record>.<state>` (entering a state, as slugs: `vendor.finance-approval`), `<record>.created` and `<record>.changed`, which stories name in `emits:` and `trigger: event:`.

The `model` rule errors on an event for a state the record doesn't have, and warns on a state that no story moves a record into. TRACE.md gets a Model section: for each record, each state, the stories that move a record into it, the stories that entering it starts, and the states that can follow. Fields aren't modelled; they belong to the app's code.

## A page for people who don't edit files

`storyspec ui` serves a page on localhost (port 4400; `--port` to change it) over the same scan and trace the CLI uses. It has a tab each for decisions, stories, scenarios, the model, the trace's findings and personas, and lets a person:

- **Answer an open decision**, as pinned (its scenarios prove it) or free. The line in spec.md becomes `<question>: <answer>; pinned by …` or `<question>: <answer> (free)`, and the scenarios it blocked can be built.
- **Approve a draft**, which sets `status: ready`.
- **Edit or add a scenario.** A new scenario takes the next ID. Steps must start with GIVEN, WHEN, THEN or AND, and include a THEN.
- **Read one persona's journey.** The Personas tab shows a persona's prose, the open decisions waiting on them, and their stories in ID order with each scenario's proof. A persona with no story says so and offers to start one with `persona:` filled in; open decisions with no owner are listed under Unassigned.
- **Add a persona**, which appends its `## Name` heading and line to PERSONAS.md (creating the file if there is none).

Every change is an edit to one story's files (or PERSONAS.md, or a new story's folder), shown as a diff before it is saved. An edit to a story past draft bumps its `version` and adds a Revisions line, as the rules ask of anyone. Each write carries the hash of the file the page read, and is refused if the file has changed since, so the page never overwrites an edit made in an editor. There is no database or account: the files are the only copy, the page lists what git hasn't committed yet, and committing is up to you. The server listens on localhost only and refuses writes from other sites' pages.

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
