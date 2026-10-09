---
id: S-004
title: The config schema describes every setting
epic: E-2 Configuration
status: in-progress
version: 1
implementedBy: packages/storyspec/schema/storyspec.config.schema.json
---

As a developer editing storyspec.config.json,
I want my editor's schema to know every setting storyspec accepts,
so that valid settings aren't flagged and invalid ones are.

## Revisions

- v1 (2026-10-09): initial; tiers and defaultProof had been missing from the schema since 0.3, so editors flagged every config that used them
