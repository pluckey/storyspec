---
id: S-012
title: A person manages the spec in a browser
epic: E-7 Specs for people who don't edit files
status: in-progress
version: 1
implementedBy: packages/storyspec/src/ui/server.ts, packages/storyspec/src/edit.ts, packages/storyspec/src/cli.ts
after: S-006, S-010, S-011
---

As someone who decides what a product does but doesn't edit Markdown (a client answering a threshold, a product manager approving scenarios),
I want a page that shows the spec and lets me answer decisions, approve stories and edit scenarios,
so that my answers land in the same files the trace checks, with no second copy of the spec to drift.

## Revisions

- v1 (2026-10-14): initial; open decisions made the spec something a person outside the repo has to act on, and nobody outside it could
