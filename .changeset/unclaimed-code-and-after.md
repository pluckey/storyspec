---
"storyspec": minor
"create-storyspec": minor
---

Specs say what they leave out, and when stories are built.

- New rule `unclaimed-code` (warning): code in any language that no story claims, through its folder, `implementedBy:`, `@implements`, or imports in either direction to claimed code. Tests, build output, config files and package markers don't count. List code that is out of scope on purpose under the new `unspecified` config key.
- `after:` in story.md: stories this one is built after. TRACE.md shows it; the new `after` rule reports a story that doesn't exist, names itself, or a loop.
- `gen-fresh` only asks for `scenarios.gen.ts` where TypeScript tests use it: a story with TypeScript in its folder, or a new story in a project with `tsconfig.json`. A new story in a Swift or Python project is no longer an error.
