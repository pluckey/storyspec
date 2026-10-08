# Contributing

Thanks for looking. storyspec is opinionated on purpose, so:

- **Bugs and docs fixes:** pull requests welcome. Include a failing test where you can.
- **New rules, config keys or convention changes:** open an issue first. The conventions are the product, and they need a reason that holds across many apps.
- **Support** is best-effort.

## Development

```bash
npm install
npm test          # builds, runs the CLI tests and type tests, then checks the template
npm run smoke     # packs both packages, scaffolds apps from the tarballs, runs them end to end
npm run smoke:upgrade   # builds the previous release from git and upgrades apps made with it to this build
```

To try an unreleased build in another project: `npm run build` here, then `node packages/create-storyspec/index.js <dir>` for a new app (it links this checkout), or `npm i -D <path>/packages/storyspec` in an existing one.

- `packages/storyspec`: the CLI and library. Rules live in `src/trace/rules.ts`; each one has a mutation test in `test/trace.test.ts`, and a row in `docs/rules.md`.
- `packages/create-storyspec`: the scaffolder. It bundles `template/` when packed.
- `template`: the app new projects get. It must always pass `npm run check`.

## Releasing

Add a changeset (`npx changeset`) to any PR that changes a published package. `npx changeset version` bumps the versions and writes the changelogs; `npx changeset publish` publishes both packages and tags the release.
