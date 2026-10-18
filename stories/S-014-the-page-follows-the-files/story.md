---
id: S-014
title: The page follows the files
epic: E-7 Specs for people who don't edit files
status: in-progress
version: 1
implementedBy: packages/storyspec/src/ui/watch.ts, packages/storyspec/src/ui/server.ts
after: S-013
---

As someone watching agents work on a project,
I want storyspec ui to update as soon as a spec, a test report or the code changes,
so that the page is a live view of the work, and I never act on a stale copy.

## Revisions

- v1 (2026-10-14): initial; the page only re-read the files on focus or Refresh, so an agent's edits showed up late
