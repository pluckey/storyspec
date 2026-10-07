---
description: Start or revise a story (scenarios → tests → use case → trace)
argument-hint: "<new story title>" or S-NNN to revise
---

Work on the story described by: $ARGUMENTS

1. If the argument is an existing story ID, revise it: read its folder, update spec.md, bump `version` in story.md and add a line under Revisions. Otherwise run `npm run story -- "<title>"`, adding `--epic` when one in stories/TRACE.md fits, and fill in story.md.
2. Write the EARS requirement and GIVEN/WHEN/THEN scenarios in spec.md. Show them to me and wait for approval before writing code.
3. Set status to `in-progress`. Write one failing test per scenario, named `'<scenario ID> <description>'`, using fakes from test/fakes.
4. Implement the use case in the story folder, first line `// @implements <ID>`. Add a port, fake, contract suite and adapter only if the story needs a new dependency (see "Adding things" in AGENTS.md). Never import another story.
5. Wire it in src/entry/composition.ts and an entry point if callers need it.
6. Run `npm run check` and fix everything it reports. Set status to `done` only when the trace is green, then show me the story's rows from stories/TRACE.md.
