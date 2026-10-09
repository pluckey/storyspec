---
"storyspec": minor
"create-storyspec": minor
---

Decisions. A spec can record the judgment calls its scenarios don't pin under `### Decisions`, one bullet each, either `pinned by S-00x.n` (every implementation must keep it) or marked `free`. The new `decisions` rule errors on a pin to a scenario that doesn't exist and warns on a decision that is neither, and TRACE.md lists every decision. The docs now describe story.md's front matter, including `implementedBy:` (comma-separated).
