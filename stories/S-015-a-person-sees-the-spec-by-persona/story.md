---
id: S-015
title: A person sees the spec by persona
epic: E-7 Specs for people who don't edit files
status: in-progress
version: 1
implementedBy: packages/story-spec/src/trace/personas.ts, packages/story-spec/src/trace/scan.ts, packages/story-spec/src/trace/rules.ts, packages/story-spec/src/trace/report.ts, packages/story-spec/src/index.ts, packages/story-spec/src/cli.ts, packages/story-spec/src/edit.ts, packages/story-spec/src/new-story.ts, packages/story-spec/src/ui/server.ts, packages/story-spec/ui/index.html, template/stories/PERSONAS.md
after: S-014
---

As someone who decides what a product does,
I want the spec organized by the people it serves, so that I can read one persona's whole journey, see which
decisions wait on them, and notice the persona nobody has written a story for.

## Revisions

- v1 (2026-10-18): initial, drafted after building Deadlight, where "player" and "developer" were buried in the "As a…" lines and the co-op "friend" persona had no story at all
