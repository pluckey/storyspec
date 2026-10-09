---
id: S-006
title: Author publishes an article
epic: E-3 Articles
status: in-progress
version: 2
implementedBy: app/usecases/publish.py
---

As a member, I want to publish an article with tags,
so that people can read it.

## Revisions

- v1 (2026-10-08): initial, from the RealWorld API spec
- v2 (2026-10-09): times are UTC whatever the database's time zone (S-006.5); seen as -05:00 against a local Postgres
