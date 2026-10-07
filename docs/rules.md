# Rules

`storyspec trace` reports each finding with its rule name. Errors fail the command; warnings don't. For stories whose status is in `gapsOnlyWarnFor` (draft and ready by default), missing code, tests or tags are warnings. Stories whose status is in `exemptStatuses` (superseded by default) appear in the trace but no story rule applies to them.

| Rule | Severity | Fires when | Fix |
|---|---|---|---|
| `story-files` | error | A story folder lacks `story.md` or `spec.md`, or `story.md`'s `id` doesn't match the folder | Add the file, or correct the `id` |
| `requirement-tag` | gap | `spec.md` has no requirement tagged `{#<ID>}` | Tag the requirement heading: `### Requirement: … {#S-001}` |
| `scenarios` | gap | `spec.md` has no scenarios | Add `#### Scenario: … {#S-001.1}` blocks |
| `scenario-ownership` | error | A scenario carries another story's ID, or an ID appears twice | Use `<this story's ID>.<n>`, each once |
| `implementation` | gap / error | No file says `@implements <ID>` (gap), more than one does (error), or a file implements another story's ID (error) | One use case per story, tagged on its first line |
| `untested-scenario` | gap | A scenario has no test | Add its case to `story(gen, { … })` (the typecheck will already be complaining) |
| `orphan-test` | error | A test names a scenario that isn't in `spec.md` | Remove the case, or add the scenario and run `storyspec gen` |
| `must-pass` | error | A story in `mustPassFor` (done) has a scenario whose test failed or didn't run | Fix the test or the code, or move the story back to in-progress |
| `gen-fresh` | error | `scenarios.gen.ts` is missing or out of date with `spec.md` | `storyspec gen` |
| `story-imports` | error | Story code imports outside its own folder and `storyMayImport` (tests also get `storyTestMayAlsoImport`) | Depend on a port or a domain rule instead of an adapter or another story |
| `ids-outside-stories` | error | A story ID appears in code outside `stories/` (except imports in `wiring` files) | Move the story-specific logic into the story; keep the kernel generic |
| `wiring` | error | A file other than a `wiring` file imports a story | Call the story through `composition.ts` |
| `layers` | error | A file imports something its layer doesn't allow (`layers` in config) | Invert the dependency through a port, or move the code to the right layer |
| `contract-tests` | error | A port has an adapter, but no test outside `stories/` that actually ran mentions the port (directly or through a module it imports) | Add a runner `test/contracts/<port>.test.ts` that calls the port's contract suite for each adapter and the fake |
| `slug` | warning | A story folder isn't `<ID>-<slug of the title>` | Rename the folder (keep the ID), then `storyspec gen` |
| `port-adapter` | warning | An interface in `portsDir` isn't mentioned by any adapter | Write the adapter, or ignore the warning while it's in progress |
| `tests` | error | The test command didn't produce its JSON report | Check `testCommand` and `testReport` in config |

## How tests are matched to scenarios

A scenario counts as tested if a test file in the story's folder contains either a `story()` case key (`'S-001.1': …`) or a plain test name starting with the ID (`test('S-001.1 …')`). Results are read from the JSON report by test title, so `story()` names its tests `<ID> <scenario title>`.
