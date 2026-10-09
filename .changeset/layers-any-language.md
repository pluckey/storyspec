---
"storyspec": minor
"create-storyspec": minor
---

Layer rules in any language. storyspec reads Python and Swift imports with ast-grep, so `layers` (and `story-imports`) check them as they do TypeScript's. Each language is a data description (extensions, test files, import patterns, how modules map to files). A file listed under `implementedBy:` may carry its `@implements` tag, and tests in other languages may name their scenarios, without tripping `ids-outside-stories`.
