---
id: S-003
title: A tier reads several reports
epic: E-1 Proof from any test runner
status: in-progress
version: 1
implementedBy: packages/storyspec/src/config.ts, packages/storyspec/src/trace/scan.ts, packages/storyspec/src/index.ts
---

As a team whose tier runs more than one test runner (pytest and a conformance suite, say),
I want the tier to name all of their reports,
so that the trace reads every result without a script to merge them.

## Revisions

- v1 (2026-10-09): initial, from the RealWorld example's FRICTION #3
