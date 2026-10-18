---
"story-spec": minor
"create-story-spec": minor
---

storyspec is now story-spec: the packages are `story-spec` and `create-story-spec` (`npm create story-spec@latest`), the command is `story-spec`, the config file is `story-spec.config.json`, the state folder is `.story-spec/`, tests import `story-spec/vitest`, the managed blocks read `story-spec:begin`/`story-spec:end`, and the repo is github.com/pluckey/story-spec. `npx story-spec migrate` moves a project made with `storyspec` in one command: it renames the config file and the state folder (and the paths that name it), rewrites imports of `storyspec/vitest`, `package.json`'s scripts and dependency, `.gitignore`, the generated files and the agent guidance, lists each file it changed, and finds nothing to do the second time. Until then `storyspec.config.json` is still read, with a warning, and sync still recognises the old markers and hooks. The tier variable is `STORY_SPEC_TIER` (`STORYSPEC_TIER` is set too), and the scaffolder reads `STORY_SPEC_SPEC` (or `STORYSPEC_SPEC`).
