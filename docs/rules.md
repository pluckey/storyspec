# Rules

`storyspec trace` reports each finding with its rule name. Errors fail the command; warnings don't. A project can change a rule's severity, or turn it off, with `rules` in `storyspec.config.json`. For stories whose status is in `gapsOnlyWarnFor` (draft and ready by default), missing code, tests or tags are warnings. Stories whose status is in `exemptStatuses` (superseded by default) appear in the trace but no story rule applies to them.

`storyspec ui` shows each finding on the screen of the thing it names (Model, Implementation or Proof), as a plain sentence that names the thing and the fix, with the rule's name on the item's details line. Those sentences live in one table, `src/ui/vocabulary.ts`, one per rule below; the CLI's messages are unchanged.

| Rule | Severity | Fires when | Fix |
|---|---|---|---|
| `story-files` | error | A story folder lacks `story.md` or `spec.md`, or `story.md`'s `id` doesn't match the folder | Add the file, or correct the `id` |
| `requirement-tag` | gap / error | `spec.md` has no requirement tagged `{#<ID>}` (gap), or tags it more than once (error) | Tag one requirement heading: `### Requirement: … {#S-001}` |
| `requirement-shape` | gap / error | The requirement has no SHALL statement (gap) or more than one (error) | One sentence for the behaviour; move each extra condition or edge case into a scenario, or split a separate behaviour into another story |
| `scenarios` | gap | `spec.md` has no scenarios | Add `#### Scenario: … {#S-001.1}` blocks |
| `scenario-ownership` | error | A scenario carries another story's ID, or an ID appears twice | Use `<this story's ID>.<n>`, each once |
| `decisions` | error / warning | A decision under `### Decisions` in spec.md pins a scenario that doesn't exist (error); is neither pinned by a scenario, marked free nor marked open (warning); is open, which blocks the scenarios it names (warning); or a scenario an open decision blocks has a test, which had to assume an answer (warning) | Pin a decision every implementation must keep by naming its scenario; mark the rest `(free)`; mark one only someone else can answer `(open)` and name the scenarios that wait for it. To answer it, replace `(open)` with the answer, and the scenarios it names become its pins |
| `model` | error / warning | A story emits or is triggered by `<record>.<state>` for a state its record in stories/MODEL.md doesn't have (error), or no story emits the event for entering a state other than a record's first (warning) | Fix the event's spelling or add the state to MODEL.md; add the event to the `emits:` of the story that moves the record into that state, or write that story |
| `unknown-persona` | warning | `stories/PERSONAS.md` exists and a story serves a persona it doesn't describe, named by `persona:` or, without the field, by its "As a…" line | Add a `## <Persona>` heading to PERSONAS.md, or name a persona it describes (the key is the heading lower-cased, with hyphens for spaces) |
| `persona-without-stories` | warning | A persona in `stories/PERSONAS.md` has no story serving it (superseded stories don't count) | Write the story it needs, with `persona: <key>`, or remove the persona |
| `persona-prose-mismatch` | warning | `stories/PERSONAS.md` exists, a story has `persona:`, and its "As a…" line names a persona the field doesn't list | Make the field and the text agree |
| `implementation` | gap / error | No file says `@implements <ID>` and story.md lists no `implementedBy:` (gap), more than one file does (error), a file implements another story's ID (error), or an `implementedBy:` file doesn't exist (error) | One use case per story, tagged on its first line; code that isn't TypeScript in the story's folder (Python, Terraform, Cedar) is listed under `implementedBy:` |
| `untested-scenario` | gap | A scenario has no test | Add its case to `story(gen, { … })` (the typecheck will already be complaining) |
| `orphan-test` | error | A test names a scenario that isn't in `spec.md` | Remove the case, or add the scenario and run `storyspec gen` |
| `failing-test` | gap / error | A scenario's test failed in a story that isn't in `mustPassFor` (a gap: a draft's only warns, an in-progress story's fails), or a test outside the stories (a contract suite, any other test) failed, or a test file failed before its tests ran (error) | Fix the test or the code. Every failing test is reported, so the trace never passes while something is red |
| `must-pass` | error | A story still written as `done` (from before 0.3) has a scenario whose test failed or didn't run | `storyspec migrate`; done is now worked out from proof |
| `proof` | gap / warning | A recorded tier failed for a scenario at its current text (gap: errors unless the story is a draft), or the scenario's text changed since a tier proved it (warning: stale) | Fix and rerun the tier (`storyspec trace --tier <name>`), or prove a manual scenario again (`storyspec prove <ID>`) |
| `derived-status` | warning | story.md says `status: done`, which the trace now works out itself | `storyspec migrate` (sets `in-progress`) |
| `unproven` | error | With `--require-proven`: a story past ready isn't done; the message lists each scenario and tier still to prove | Prove what's listed, or don't gate on it yet |
| `adapter-untested` | warning | No test that ran, in this run or a recorded tier, names the adapter's file (`src/adapters/…/x.ts`) in its name or a describe around it | Run its contract suite against it with the file path as the suite's name, in the tier that reaches the real service |
| `gen-fresh` | error | `scenarios.gen.ts` is missing or out of date with `spec.md`. Only stories with TypeScript in their folder need one, or, in a TypeScript project (`tsconfig.json` at the root, or TypeScript in any story's folder), stories with nothing there yet | `storyspec gen` |
| `story-imports` | error | Story code imports outside its own folder and `storyMayImport` (tests also get `storyTestMayAlsoImport`) | Depend on a port or a domain rule instead of an adapter or another story |
| `ids-outside-stories` | error | A story ID appears in code outside `stories/` (import statements don't count: who may import a story is the `wiring` rule's question) | Move the story-specific logic into the story; keep the kernel generic |
| `wiring` | error | A file other than a `wiring` file imports a story. Importing a story's `*.types.ts` for its types alone (`import type`) is allowed anywhere | Call the story through `composition.ts` |
| `layers` | error | A file imports something its layer doesn't allow (`layers` in config) | Invert the dependency through a port, or move the code to the right layer |
| `contract-tests` | error | A port has an adapter, but no test outside `stories/` that actually ran mentions the port (directly or through a module it imports) | Add a runner `test/contracts/<port>.test.ts` that calls the port's contract suite for each adapter and the fake. Moving the interface out of `portsDir` silences the rule without testing the adapter |
| `trigger` | error / warning | A story's `trigger:` isn't `actor:`, `event:`, `schedule:` or `external:` followed by a name, or names more than one trigger (error); or it is `event:<name>` and no story `emits:` that event (warning) | Use one `kind:name`, and split a story with two triggers into two. For an event, add it to the `emits:` of the story that causes it; if another system sends it, use `external:<system>` instead |
| `after` | error | A story's `after:` names a story that doesn't exist, names itself, or the stories' `after:` go round in a circle | Name stories that exist, and keep the build order one-way |
| `unclaimed-code` | warning | A code file (in any language) that no story claims: not in a story's folder, not named by `implementedBy:` or `@implements`, not joined to claimed code by imports in either direction, and not listed under `unspecified`. Tests, build output (`dist/`, `build/`, `vendor/`, `*.min.js`), config files (`*.config.*`) and package markers (`__init__.py`, `Package.swift`) don't count. In a language whose imports the trace can't read (Swift, Kotlin, …), only a story's folder and `implementedBy:` claim | Name the file in the story it belongs to, write the story it needs, or list it under `unspecified` if no story should cover it, so a regeneration drops it on purpose |
| `slug` | warning | A story folder isn't `<ID>-<slug of the title>` | Rename the folder (keep the ID), then `storyspec gen` |
| `port-adapter` | warning | An interface in `portsDir` isn't mentioned by any adapter | Write the adapter, or ignore the warning while it's in progress |
| `framework-sync` | warning | `AGENTS.md` (or, in a project that uses Claude Code, `CLAUDE.md`, the `/story` command or its hooks) has no storyspec guidance, guidance from another storyspec version, or a storyspec block edited by hand | `storyspec sync`. Move project notes outside the storyspec blocks; `sync --force` replaces a hand-edited block |
| `tests` | error | The test command didn't produce its JSON report | Check `testCommand` and `testReport` in config |

## How imports are read

TypeScript imports come from [dependency-cruiser](https://github.com/sverweij/dependency-cruiser), which resolves tsconfig paths and knows type-only imports. Python imports come from [ast-grep](https://ast-grep.github.io), which parses many languages the same way. Each language is described as data in `src/trace/languages.ts`: its file extensions, which files are tests, the patterns that find its imports, and how a module name maps to repo files. A Python import maps to `a/b.py` or `a/b/__init__.py` (relative imports from the importing file's package). Imports of anything outside the repo are left out. Adding a language means adding its description there, but only where imports are how files depend on each other. Swift isn't described: within one module, files use each other with no import at all, so an import graph would see nothing and report clean. In Swift, put layers in separate SwiftPM targets, and the compiler enforces them.

Story IDs outside the stories folder are allowed in two places. The first is an `@implements` tag in a file a story lists under `implementedBy:`. The second is tests in languages other than TypeScript, which name the scenarios they prove and can't always sit in the story's folder.

## How tests are matched to scenarios

A scenario counts as tested if a test file in the story's folder contains either a `story()` case key (`'S-001.1': …`) or a plain test name starting with the ID (`test('S-001.1 …')`), or if a test in the report ran under the scenario's ID, wherever that test lives. Results are read from the report by test name, so `story()` names its tests `<ID> <scenario title>`. A skipped test proves nothing.

## Other test runners and languages

The trace reads two report formats, recognised from the file's content:

- **Vitest or Jest JSON** (`testResults[].assertionResults[]`): `vitest --reporter=json`, or `jest --json --outputFile=…`.
- **JUnit XML**, which most runners in any language write: `pytest --junitxml=…`, `vitest --reporter=junit`, `jest-junit`, `go-junit-report`, `gradle test`.

In JUnit, a test names its scenario in one of three ways:

| How | Example |
|---|---|
| The ID at the start of its name, as in TypeScript | `S-001.1 [deployed] greets by name` |
| A function name, where `-` and `.` aren't allowed | `test_S_001_1_greets_by_name`, or `test_S_001_1__deployed__greets` to name a tier |
| A `scenario` property (and optionally `tier`) | pytest: `@pytest.mark.verifies("S-001.1")` with the conftest hook in [Projects that aren't TypeScript](adopting.md#projects-that-arent-typescript), or `record_property("scenario", "S-001.1")` |

A JUnit test that names no tier ran in the tier whose command wrote the report, so a tier selects its tests through its command (`pytest tests/deployed`, `pytest -m deployed`). The typed `story()` helper and `scenarios.gen.ts` are TypeScript-only; a story implemented elsewhere (`implementedBy:`) with no TypeScript in its folder gets no generated file. See [Projects that aren't TypeScript](adopting.md#projects-that-arent-typescript).
