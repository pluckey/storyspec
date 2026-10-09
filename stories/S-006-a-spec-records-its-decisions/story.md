---
id: S-006
title: A spec records its decisions
epic: E-4 Specs that survive regeneration
status: in-progress
version: 1
implementedBy: packages/storyspec/src/trace/scan.ts, packages/storyspec/src/trace/rules.ts, packages/storyspec/src/trace/report.ts
---

As someone who regenerates a product from its specs,
I want the judgment calls the scenarios leave open written down, and each marked pinned or free,
so that a regeneration either keeps a decision (a scenario proves it) or knowingly makes its own.

## Revisions

- v1 (2026-10-09): initial; a cleanroom regeneration of RealWorld made about 27 silent choices, and at least 5 differed from the original while every test passed
