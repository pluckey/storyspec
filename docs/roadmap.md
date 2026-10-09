# Roadmap

Ideas, roughly in order. Open an issue to discuss any of them before building.

## Next

- **Python layering:** run import-linter beside the TypeScript import rules and report its findings, and a typed scenario module for pytest like `scenarios.gen.ts`.
- **Lists for `portsDir`/`adaptersDir`,** so a client and a server in one project both get port coverage.
- **Relationships between stories:**
  - `extends:` (this story changes the behaviour of another): the trace shows "extended by", and a revision of the extended story makes its extenders' proofs stale.
  - `after:` (build order): a generated "ready to build" list of the stories whose dependencies are done.
- **Organized views of a flat folder:**
  - The `stories/` folder stays flat and append-only.
  - An optional `stories/epics.md` gives each epic its order, its description and the rules all its stories share.
  - The trace groups stories by epic, then by status.
  - A superseded story shows as one row, and draft warnings are collapsed.
- **Deployed-tier ergonomics:**
  - a timeout per case
  - a shared-run helper
  - `changes:` front matter, so the runner can schedule stories that touch shared state
  - recording the identity a tier ran as
- **One switch for architecture rules:** a `profile` option that turns the layer, wiring and import rules on or off together.

## Later

- **OpenSpec as a story source.** storyspec's `spec.md` already uses OpenSpec's Markdown (`### Requirement:`, `#### Scenario:`, SHALL, WHEN/THEN) plus `{#ID}` tags. To follow OpenSpec exactly:
  - **Identity:** IDs derived from titles (`capability/requirement/scenario`), since OpenSpec has none. A rename shows up as an orphan test plus an untested scenario, and a `storyspec rename` command could move the proof across.
  - **Shape:** one requirement per capability, so `openspec/specs/<capability>/` is the story folder. Whether code and tests can sit beside `spec.md` there is the first thing to test against `openspec validate` and `archive`.
  - **Extra fields:** `proof:`, `implementedBy:` and the user story need a place OpenSpec allows.
  - **Status:** an active change means in progress, and a requirement in `specs/` must be proven.
  - **Cost:** about 3–5 days.
  - **When:** someone asks for it, or storyspec sets out to grow its audience. Start with a half-day spike that converts the template.
- **Per-story coverage attribution.** Run each story's tests with coverage, then report which stories exercise each line of `src/`. Flags shared code no story justifies, and gives a reverse trace (code → stories).
- **Orphan detection.** Files and exports in `src/` unreachable from any story or entry point (via the import graph, or by wiring in `knip`).
- **ESLint plugin.** The per-file rules (`implementation`, `story-imports`, `layers`, `ids-outside-stories`) as editor squiggles, before you run the trace.
- **Infrastructure as code.** Tracing for Terraform: modules declare the adapter or entry point they back, infra-level stories use `terraform test` run names as scenarios, orphan infrastructure is reported, and environment variables the code needs are checked against what the module supplies.
- **More runners.** A typed `story()` for Jest and `node:test`.
