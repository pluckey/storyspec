---
id: S-005
title: Layer rules read imports in any language
epic: E-3 Architecture in any language
status: in-progress
version: 1
implementedBy: packages/storyspec/src/trace/languages.ts, packages/storyspec/src/trace/graph.ts
---

As a team building in Python or Swift,
I want storyspec's layer rules to read my imports,
so that the architecture is checked the way it is in TypeScript, without a plugin per language.

## Revisions

- v1 (2026-10-09): initial; imports outside TypeScript come from ast-grep, with each language described as data
