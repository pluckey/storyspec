# storyspec

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
