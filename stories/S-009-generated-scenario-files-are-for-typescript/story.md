---
id: S-009
title: Generated scenario files are for TypeScript
epic: E-6 Projects in any language
status: in-progress
version: 1
implementedBy: packages/storyspec/src/gen.ts
---

As someone using storyspec in a project that isn't TypeScript,
I want the trace to ask for scenarios.gen.ts only where TypeScript tests use it,
so that a new story in a Swift or Python project isn't an error for lacking a file it would never use.

## Revisions

- v1 (2026-10-09): initial; a draft story in the Drill app (Swift) failed the trace for a missing scenarios.gen.ts until gen-fresh was turned off
