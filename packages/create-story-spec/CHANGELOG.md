# create-storyspec

## 0.10.0

### Minor Changes

- 1fc6d91: storyspec is now story-spec: the packages are `story-spec` and `create-story-spec` (`npm create story-spec@latest`), the command is `story-spec`, the config file is `story-spec.config.json`, the state folder is `.story-spec/`, tests import `story-spec/vitest`, the managed blocks read `story-spec:begin`/`story-spec:end`, and the repo is github.com/pluckey/story-spec. `npx story-spec migrate` moves a project made with `storyspec` in one command: it renames the config file and the state folder (and the paths that name it), rewrites imports of `storyspec/vitest`, `package.json`'s scripts and dependency, `.gitignore`, the generated files and the agent guidance, lists each file it changed, and finds nothing to do the second time. Until then `storyspec.config.json` is still read, with a warning, and sync still recognises the old markers and hooks. The tier variable is `STORY_SPEC_TIER` (`STORYSPEC_TIER` is set too), and the scaffolder reads `STORY_SPEC_SPEC` (or `STORYSPEC_SPEC`).

## 0.9.0

### Patch Changes

- aad1065: Personas: describe the people a product serves in `stories/PERSONAS.md` (one `## Name` heading each, with a line of prose), and tie each story to them with `persona:` in story.md, or let its "As a…" line decide. The trace warns on a persona that isn't described (`unknown-persona`), one no story serves (`persona-without-stories`) and a story whose field and prose disagree (`persona-prose-mismatch`); TRACE.md ends with a grid of epics by personas, and `storyspec trace --by persona` gives one stories table per persona. An open decision can name who answers it with `(open: <persona>)`. `storyspec ui` gets a Personas tab that shows one persona's journey (their prose, the decisions waiting on them, their stories and proof), lists personas with no story yet and starts one for them, and adds a persona to PERSONAS.md as a diff. New projects start with a `Member` persona.

## 0.8.0

### Minor Changes

- d6c21c2: Stories say what starts them, which decisions are still open, and which records they move through which states.
  
  - `trigger:` in story.md: what starts the story, as `actor:<role>`, `event:<event>`, `schedule:<name>` or `external:<system>`. `emits:` lists the events a story causes. TRACE.md shows the trigger beside each story and adds a Triggers table: each trigger, the stories that emit it (for an event) and the stories it starts.
  - New rule `trigger`: an unknown kind, a missing name or a second trigger is an error; an event no story emits is a warning.
  - Open decisions: a decision marked `(open)` blocks the scenarios it names. They need no test yet and show as blocked in TRACE.md; a test of one is a warning, since it had to assume an answer.
  - `stories/MODEL.md`: records and the transitions between their states. New rule `model`: an event for a state a record doesn't have is an error, and a state no story moves a record into is a warning. TRACE.md gets a Model section with each record's lifecycle.
- ca42196: `storyspec ui`: a page on localhost for the people who decide what the product does but don't edit files. It answers open decisions, approves draft stories, edits and adds scenarios, and shows each record's lifecycle and the trace's findings. Each change is an edit to a story's files (bumping the version of a story past draft), shown as a diff and refused if the file changed since the page read it. No database: git is the history.
- 3ea835e: Specs say what they leave out, and when stories are built.
  
  - New rule `unclaimed-code` (warning): code in any language that no story claims, through its folder, `implementedBy:`, `@implements`, or imports in either direction to claimed code. Tests, build output, config files and package markers don't count. List code that is out of scope on purpose under the new `unspecified` config key.
  - `after:` in story.md: stories this one is built after. TRACE.md shows it; the new `after` rule reports a story that doesn't exist, names itself, or a loop.
  - `gen-fresh` only asks for `scenarios.gen.ts` where TypeScript tests use it: a story with TypeScript in its folder, or a new story in a project with `tsconfig.json`. A new story in a Swift or Python project is no longer an error.

## 0.7.0

### Minor Changes

- 3b23218: Decisions. A spec can record the judgment calls its scenarios don't pin under `### Decisions`, one bullet each, either `pinned by S-00x.n` (every implementation must keep it) or marked `free`. The new `decisions` rule errors on a pin to a scenario that doesn't exist and warns on a decision that is neither, and TRACE.md lists every decision. The docs now describe story.md's front matter, including `implementedBy:` (comma-separated).

## 0.6.0

### Minor Changes

- ae0e655: Layer rules beyond TypeScript. storyspec reads Python imports with ast-grep, so `layers` (and `story-imports`) check them as they do TypeScript's. Each language is a data description (extensions, test files, import patterns, how modules map to files). A file listed under `implementedBy:` may carry its `@implements` tag, and tests in other languages may name their scenarios, without tripping `ids-outside-stories`.

## 0.5.0

### Minor Changes

- 6e1289f: A tier can read several test reports: `testReport` and a tier's `report` accept a list (for example pytest's JUnit and a conformance suite's), and a listed report the run didn't write is skipped. JUnit test cases with no file or class (Hurl's) are reported by their name instead of "(unknown file)". The config schema now describes `tiers` and `defaultProof`, which editors had flagged as unknown since 0.3.

## 0.4.2

### Patch Changes

- d6322d3: Docs: the pytest `verifies` hook adds the scenario at collection time, so a test that fails in setup is still reported against its scenario ("fails", not "no test").

## 0.4.1

### Patch Changes

- d4b2e66: Docs: a pytest test names its scenario with `@pytest.mark.verifies("S-001.1")`, through a short `conftest.py` hook (in docs/adopting.md) that writes it into the JUnit report.

## 0.4.0

### Minor Changes

- 7c398e9: Projects that aren't TypeScript. The trace reads JUnit XML reports as well as Vitest/Jest JSON, recognised from the content, so pytest, Go, Gradle and most other runners can prove scenarios. A JUnit test names its scenario at the start of its name (`S-001.1 …`), in a function name (`test_S_001_1_…`, `test_S_001_1__deployed__…`), or with a `scenario` property (pytest's `record_property`); one that names no tier ran in the tier whose command wrote the report. A scenario counts as tested when a test in the report ran under its ID, wherever the test lives, and a skipped test proves nothing. Stories whose code isn't TypeScript in their folder list it in story.md under `implementedBy:` (any file type), and get no `scenarios.gen.ts`.

### Patch Changes

- 54ae6de: Releases are published from CI through npm trusted publishing, with provenance.

## 0.3.0

### Minor Changes

- Done is proven, not declared. A scenario names the tiers that must prove it (`{#S-001.2 proof=local,deployed}`, or `proof:` in story.md, or `defaultProof` in config): `local` reruns on every trace; a tier with a command (`tiers` in config) runs with `storyspec trace --tier <name>` and its results are recorded in the committed `stories/PROOF.json`; `manual` is recorded with `storyspec prove <ID>`. Each recorded proof carries a hash of the scenario's text, so changed wording makes it stale. A story shows as `done (vN)` only when every scenario is proven in every tier it needs; `status: done` in story.md is no longer written (`derived-status` warns; `storyspec migrate` sets in-progress). `story()` cases for tiered scenarios take one function per tier, checked at compile time. `trace --require-proven` gates a release on every story being done. New rules: `proof`, `derived-status`, `unproven`, `adapter-untested`.
  
  The ports table shows which tiers exercised each adapter, so an adapter over a real service counts as proven only by a tier that reached it.
  
  The import graph now comes from dependency-cruiser: tsconfig path aliases no longer bypass the layer rules, and a story's `*.types.ts` may be imported for its types alone from anywhere. `ids-outside-stories` ignores import statements. `trace()` in the library API is now async.
  
  Requires Node 22 or later.

## 0.2.0

### Minor Changes

- Projects can now take framework updates. The agent guidance (AGENTS.md, the Claude Code `/story` command and hooks) ships in the package, and `storyspec sync` writes it into a project inside version-stamped blocks, leaving the project's own text alone and refusing to overwrite hand edits unless `--force`. Unedited 0.1 projects are migrated whole on their first sync. The trace warns when the guidance is stale (`framework-sync`), and `sync --check` fails in CI.
  
  The trace now reports every failing test (`failing-test`): a failing scenario in a story that isn't done (a draft's only warns), a failing test outside the stories such as a contract suite, and a test file that crashed. Before, these could leave the trace green.
  
  `rules` in `storyspec.config.json` sets a rule's severity for a project (`"error"`, `"warning"` or `"off"`).
  
  New guidance in AGENTS.md: compose per entry point, cross-cutting rules, deferring an infeasible scenario, platform facts with evidence, assertions for probabilistic adapters, tests against a deployed system, and how to update.
