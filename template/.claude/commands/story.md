---
description: Start or revise a story (scenarios → tests → use case → trace)
argument-hint: "<new story title>" or S-NNN to revise
---

Work on the story described by: $ARGUMENTS

1. If the argument is an existing story ID, revise it: read its folder, update spec.md, bump `version` in story.md and add a line under Revisions. Otherwise run `npm run story -- "<title>"`, adding `--epic` when one in stories/TRACE.md fits, and fill in story.md.
2. Write the requirement in spec.md as one EARS sentence (exactly one SHALL), then a GIVEN/WHEN/THEN scenario for every case: normal, edge and error. Mark scenarios that need another tier (`proof=local,deployed`, `proof=manual`; see Proof tiers in AGENTS.md). Show them to me and wait for approval before writing code.
3. Run `npm run gen`. Set status to `in-progress`. Write the test file with `story(gen, { … })` from `storyspec/vitest`, one failing case per scenario, using fakes from test/fakes.
4. Implement the use case in the story folder, first line `// @implements <ID>`. Add a port, fake, contract suite and adapter only if the story needs a new dependency (see "Adding things" in AGENTS.md). Never import another story.
5. Wire it in src/entry/composition.ts and an entry point if callers need it.
6. Run `npm run check` and fix everything it reports. Never set status to `done`: the trace shows the story as done once every scenario is proven in every tier it needs. Tell me which tiers are still awaiting (a deployed run, or a check only a person can make with `storyspec prove`), then show me the story's rows from stories/TRACE.md.

<!-- storyspec:managed 0.6.0 sha=cba44383f939efad -->
