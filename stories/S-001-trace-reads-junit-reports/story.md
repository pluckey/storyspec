---
id: S-001
title: Trace reads JUnit reports
epic: E-1 Proof from any test runner
status: in-progress
version: 2
implementedBy: packages/storyspec/src/trace/results.ts
---

As a team whose tests aren't Vitest (pytest, Go, Gradle),
I want the trace to read my runner's JUnit report,
so that my tests prove scenarios the way TypeScript tests do.

## Revisions

- v1 (2026-10-08): initial (shipped in 0.4.0; written as a story when storyspec began checking itself)
- v2 (2026-10-09): a test case with no file is reported by its name (S-001.12), from RealWorld's FRICTION #4
