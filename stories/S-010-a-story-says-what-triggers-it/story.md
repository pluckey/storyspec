---
id: S-010
title: A story says what triggers it
epic: E-5 Story organisation
status: in-progress
version: 1
implementedBy: packages/story-spec/src/trace/rules.ts, packages/story-spec/src/trace/scan.ts, packages/story-spec/src/trace/report.ts
after: S-008
---

As someone organising a product's stories,
I want each story to say what sets it off (a person in a role, another story's event, a schedule or another system) and which events it emits,
so that stories no person starts still have a place, and the trace can show how the stories hand on to each other.

## Revisions

- v1 (2026-10-14): initial; grouping by persona left out the stories a person never starts (a vendor moving to Review notifies its reviewer), which in a workflow app is half of them
