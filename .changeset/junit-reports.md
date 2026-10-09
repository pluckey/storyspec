---
"storyspec": minor
"create-storyspec": minor
---

Projects that aren't TypeScript. The trace reads JUnit XML reports as well as Vitest/Jest JSON, recognised from the content, so pytest, Go, Gradle and most other runners can prove scenarios. A JUnit test names its scenario at the start of its name (`S-001.1 …`), in a function name (`test_S_001_1_…`, `test_S_001_1__deployed__…`), or with a `scenario` property (pytest's `record_property`); one that names no tier ran in the tier whose command wrote the report. A scenario counts as tested when a test in the report ran under its ID, wherever the test lives, and a skipped test proves nothing. Stories whose code isn't TypeScript in their folder list it in story.md under `implementedBy:` (any file type), and get no `scenarios.gen.ts`.
