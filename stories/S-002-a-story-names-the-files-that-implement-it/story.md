---
id: S-002
title: A story names the files that implement it
epic: E-1 Proof from any test runner
status: in-progress
version: 1
implementedBy: packages/storyspec/src/trace/rules.ts, packages/storyspec/src/gen.ts
---

As a team whose story isn't implemented by TypeScript in its folder (Python, Terraform, a policy),
I want to list the files that implement it in story.md,
so that the trace knows where it lives without a TypeScript use case.

## Revisions

- v1 (2026-10-08): initial (shipped in 0.4.0; written as a story when storyspec began checking itself)
