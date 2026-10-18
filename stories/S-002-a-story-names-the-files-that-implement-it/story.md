---
id: S-002
title: A story names the files that implement it
epic: E-1 Proof from any test runner
status: in-progress
version: 3
implementedBy: packages/storyspec/src/trace/rules.ts, packages/storyspec/src/gen.ts
---

As a team whose story isn't implemented by TypeScript in its folder (Python, Terraform, a policy),
I want to list the files that implement it in story.md,
so that the trace knows where it lives without a TypeScript use case.

## Revisions

- v1 (2026-10-08): initial (shipped in 0.4.0; written as a story when storyspec began checking itself)
- v2 (2026-10-09): an `@implements` tag outside stories is allowed only in a file a story lists (S-002.3)
- v3 (2026-10-09): S-002.3 no longer expects a generated file in a project that isn't TypeScript (S-009)
