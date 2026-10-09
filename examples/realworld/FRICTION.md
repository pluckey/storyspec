# storyspec friction log (RealWorld example)

Where storyspec helped or got in the way while building RealWorld in Python with storyspec 0.4. The numbering starts again from 1. The MCP gateway's log was the first.

Severity: **block** (couldn't go on without changing storyspec), **bend** (worked around it), **papercut**, **win**.

| # | When | Severity | What happened | Workaround | Fix in storyspec |
|---|---|---|---|---|---|
| 1 | setup | win | A Python project needed only `implementedBy:`, the pytest `verifies` hook and a JUnit `testCommand`. The local check worked on the first run, and the deployed tier recorded PROOF.json with no changes to storyspec. | n/a | n/a |
| 2 | tiers | win | One test proves a scenario in both tiers. A session-scoped `api` fixture is the app in-process (memory adapters) unless `STORYSPEC_TIER=deployed`, when it is the running server on Postgres. Tests that don't name a tier count for the tier whose command wrote the report, which made this free. | n/a | document the pattern in the adoption guide |
| 3 | conformance | win | The official RealWorld Hurl suite runs inside the deployed tier. Its JUnit is merged with pytest's, and since its tests name no scenario, any failure fails the trace (`failing-test`), shown by breaking one assertion on purpose. | `scripts/merge_junit.py` | let a tier list several reports, so no merge script is needed |
| 4 | conformance | papercut | Hurl's JUnit test cases carry no file attribute, so the finding says `(unknown file): "hurl/tags.hurl" fails`. | none | fall back to the test case's name or classname for the file |
| 5 | ports | bend | The Ports table and the `contract-tests` rule only see TypeScript, so the storage contract (`tests/contracts`, memory and Postgres) isn't credited to any adapter, and nothing fails if it's deleted. | contract tests are ordinary tests, and their failures still fail the trace | per-adapter coverage from report names in any language: the parametrised ids already are the adapter paths (`app/adapters/postgres`) |
| 6 | spec | bend | The suite ran green the first time, but a scenario test (S-008.1) caught a flake the Hurl suite didn't. An edit within the same millisecond as publishing kept the same `updatedAt`, because times are shown to the millisecond. | `later()` steps at least 1 ms | n/a: a win for writing scenario tests beside a conformance suite |
| 7 | proof | papercut | PROOF.json records `-dirty` when the deployed tier runs before the commit. Recording proof means: commit, run the tier, then commit PROOF.json. | run the tier after committing | `trace --tier` could warn when the tree is dirty |
| 8 | guidance | papercut | `framework-sync` warned that AGENTS.md was missing in a fresh example. Right, but the TypeScript-shaped guidance (`story()`, `src/domain`) doesn't fit a Python project. | wrote the Python specifics under "This project" | language-aware guidance, or a short section for projects that aren't TypeScript |
