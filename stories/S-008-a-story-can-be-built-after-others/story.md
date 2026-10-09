---
id: S-008
title: A story can be built after others
epic: E-5 Story organisation
status: in-progress
version: 1
implementedBy: packages/storyspec/src/trace/rules.ts, packages/storyspec/src/trace/scan.ts, packages/storyspec/src/trace/report.ts
---

As someone who grows a product a story at a time,
I want a story to say which stories it is built after,
so that the order the system grows in is written down and checked, not kept in my head.

## Revisions

- v1 (2026-10-09): initial; the Drill app's stories used after: before storyspec read it, so a typo or a loop would have gone unnoticed
