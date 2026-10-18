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

`storyspec ui` serves a page on localhost (port 4400; `--port` to change it) over the same scan and trace the CLI uses. A left navigation holds an inbox and three groups, one question each:

| | Screens |
|---|---|
| **Needs you** | Everything waiting on a person, with its action: Decide (an open decision), Approve (a draft), Check again (a stale proof), Check (a manual scenario nobody has checked), Claim (code no story claims). The page lands here; at its top, each persona's "can do today" and "being built" counts, so someone new can read where the project stands in a minute. |
| **Model**, what should be | People (the personas, each with their stories and the decisions waiting on them), Stories (one line per story with its state and a proof summary, opening into its requirement and scenarios), Decisions, Records (MODEL.md's lifecycles), Words (any other Markdown file in the stories folder, rendered) |
| **Implementation**, what is | Code (each story's files, and code no story claims), Ports, Layers |
| **Proof**, how we know | By tests, By a run, By a person, Stale |

Every screen is the same grid, so it is learned once. A screen is a definition in `src/ui/screens.ts` (its columns, where its rows come from, its tabs and what a row opens to), and one grid component, `src/ui/grid.ts`, draws them all: a search box that keeps the rows with the word in any column (and opens a row at the children that match), a count, tabs that filter by kind with their counts (a tab with nothing in it is shown, disabled), column headers that sort up and then down, a Columns menu to hide columns, and rows of one line each that open in place. An opened row shows its why, its sentence or requirement, and its children as a nested grid: a story's scenarios, or a persona's decisions and stories (Waiting on them, Can do today, Being built, Planned). Each row has at most one action; a screen's own action, such as Add a persona, is in its header. Needs you is the grid whose rows are a union of kinds (Decide, Approve, Check again, Check, Claim), all with the same columns: kind, what, who, since and action. The only thing off the grid is the row of summary cards above it.

The trace's findings sit on the screen of the thing they name, as rows under its To fix tab, each a sentence that says what to do. Nothing on the page stores a state: every state (can do today, being built, planned, checked, failed a check, needs a look, waiting on you) is worked out on the server from the scan, the trace and PROOF.json. Hovering a state says why, and clicking it opens its row to the full why, in sentences, with the action that would change it; a stale proof shows the text that was checked and the text now. IDs, versions, rule names and hashes are kept to an item's details line. Every word comes from one table, `src/ui/vocabulary.ts`. The URL names the project and the screen, the open rows, the search, the tab and the sort, so a link or a refresh lands in the same place; the columns a person hides are kept per screen in the browser. The page lets a person:

- **Answer an open decision**, as pinned (its scenarios prove it) or free. The line in spec.md becomes `<question>: <answer>; pinned by …` or `<question>: <answer> (free)`, and the scenarios it blocked can be built.
- **Approve a draft**, which sets `status: ready`.
- **Edit or add a scenario**, inside its opened story (Edit is in an opened scenario, Add a scenario heads the story's scenarios). A new scenario takes the next ID. Steps must start with GIVEN, WHEN, THEN or AND, and include a THEN.
- **Record a check by hand** on a manual scenario: it holds or it fails, with an optional note. It is written to PROOF.json by the same function as `storyspec prove`, naming the person git names.
- **Claim code** no story claims, which adds the file to the chosen story's `implementedBy:`; the code isn't touched.
- **Add a persona**, which appends its `## Name` heading and line to PERSONAS.md (creating the file if there is none), or start a story for a persona with `persona:` filled in.

Every change is an edit to one file (a story's files, PERSONAS.md, PROOF.json, or a new story's folder), shown as a diff before it is saved. An edit to a story past draft bumps its `version` and adds a Revisions line, as the rules ask of anyone. Each write carries the hash of the file the page read, and is refused if the file has changed since, so the page never overwrites an edit made in an editor. There is no database or account: the files are the only copy, the page lists what git hasn't committed yet, and committing is up to you. The server listens on localhost only and refuses writes from other sites' pages.

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
