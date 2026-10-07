# Roadmap

Ideas, roughly in order. Open an issue to discuss any of them before building.

- **Per-story coverage attribution.** Run each story's tests with coverage, then report which stories exercise each line of `src/`. Flags shared code no story justifies, and gives a reverse trace (code → stories).
- **Orphan detection.** Files and exports in `src/` unreachable from any story or entry point (via the import graph, or by wiring in `knip`).
- **ESLint plugin.** The per-file rules (`implementation`, `story-imports`, `layers`, `ids-outside-stories`) as editor squiggles, before you run the trace.
- **Infrastructure as code.** Tracing for Terraform: modules declare the adapter or entry point they back, infra-level stories use `terraform test` run names as scenarios, orphan infrastructure is reported, and environment variables the code needs are checked against what the module supplies.
- **Requirement versioning.** Record the story version a test was written against, and flag tests that predate a revision.
- **More runners.** A typed `story()` for Jest and `node:test`.
