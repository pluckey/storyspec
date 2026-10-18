# create-story-spec

Scaffolds a [story-spec](https://github.com/pluckey/story-spec) app: story-first, spec-driven development on clean architecture with ports and adapters.

```bash
npm create story-spec@latest my-app                    # with the example notes API
npm create story-spec@latest my-app -- --no-example    # structure, tooling and one draft story
npm create story-spec@latest my-app -- --no-install    # skip npm install
```

## Moving from storyspec

Up to 0.8 this scaffolder was `create-storyspec`. An app made with it moves with `npx story-spec migrate`; see the [migration note](https://github.com/pluckey/story-spec#moving-from-storyspec).
