---
id: S-006
title: A spec records its decisions
epic: E-4 Specs that survive regeneration
status: in-progress
version: 2
implementedBy: packages/storyspec/src/trace/scan.ts, packages/storyspec/src/trace/rules.ts, packages/storyspec/src/trace/report.ts
---

As someone who regenerates a product from its specs,
I want the judgment calls the scenarios leave open written down, and each marked pinned, free or open,
so that a regeneration either keeps a decision (a scenario proves it), knowingly makes its own, or waits for someone to answer it.

## Revisions

- v1 (2026-10-09): initial; a cleanroom regeneration of RealWorld made about 27 silent choices, and at least 5 differed from the original while every test passed
- v2 (2026-10-14): open decisions, which block the scenarios they name; a spec written for a client has questions only the client can answer (an approval threshold), and an agent filled them in with invented values
