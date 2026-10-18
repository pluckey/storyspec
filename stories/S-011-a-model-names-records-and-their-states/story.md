---
id: S-011
title: A model names records and their states
epic: E-5 Story organisation
status: in-progress
version: 1
implementedBy: packages/story-spec/src/trace/model.ts, packages/story-spec/src/trace/rules.ts, packages/story-spec/src/trace/report.ts
after: S-010
---

As someone whose product moves records through states (a vendor from Draft to Approved),
I want the records and their states written down once, and the stories' events checked against them,
so that every state some story moves a record into is accounted for, and a misspelt event is caught.

## Revisions

- v1 (2026-10-14): initial; in the vendor onboarding app, "a vendor in Review" lived only in the prose of five stories, and nothing showed that no story told the vendor it was approved
