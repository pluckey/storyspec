---
id: S-015
title: A person sees the spec by persona
epic: E-7 Specs for people who don't edit files
status: in-progress
version: 1
implementedBy: packages/storyspec/src/trace/personas.ts, packages/storyspec/src/trace/scan.ts, packages/storyspec/src/trace/rules.ts, packages/storyspec/src/trace/report.ts, packages/storyspec/src/index.ts, packages/storyspec/src/cli.ts, packages/storyspec/src/edit.ts, packages/storyspec/src/new-story.ts, packages/storyspec/src/ui/server.ts, packages/storyspec/ui/index.html, template/stories/PERSONAS.md
after: S-014
---

As someone who decides what a product does,
I want the spec organized by the people it serves, so that I can read one persona's whole journey, see which
decisions wait on them, and notice the persona nobody has written a story for.

## Revisions

- v1 (2026-10-18): initial, drafted after building Deadlight, where "player" and "developer" were buried in the "As a…" lines and the co-op "friend" persona had no story at all
