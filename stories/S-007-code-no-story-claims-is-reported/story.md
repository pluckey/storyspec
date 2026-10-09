---
id: S-007
title: Code no story claims is reported
epic: E-4 Specs that survive regeneration
status: in-progress
version: 1
implementedBy: packages/storyspec/src/trace/rules.ts, packages/storyspec/src/trace/scan.ts, packages/storyspec/src/config.ts
---

As someone who regenerates a product from its specs,
I want to know which code no story covers,
so that a regeneration doesn't silently drop a feature nobody specified, and what is left out is left out on purpose.

## Revisions

- v1 (2026-10-09): initial; in the user's Drill app about half the code (interview practice, the design round, vocabulary) belonged to no story, and nothing said so
