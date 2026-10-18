---
id: S-024
title: storyspec becomes story-spec
epic: E-8 Release
status: superseded
version: 2
after: S-023
---

As someone who uses the framework,
I want it named story-spec everywhere, on npm, on GitHub, on the command line and in my project,
so that the name reads as what it is, and my existing project moves over with one command.

## Revisions

- v1 (2026-10-18): initial; the GitHub repo was renamed to pluckey/story-spec and made public the same day
- v2 (2026-10-18): superseded. npm refuses `story-spec` as too similar to `storyspec` (E403, even for the same owner), and a split name across npm, repo and command was judged worse than the hyphen. Built and merged as #30, published nowhere, reverted the same day; the repo is `pluckey/storyspec` again. The migrate work lives in git history at 1fc6d91 if a scoped name is ever wanted.
