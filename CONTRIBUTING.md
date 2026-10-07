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
```

- `packages/storyspec`: the CLI and library. Rules live in `src/trace/rules.ts`; each one has a mutation test in `test/trace.test.ts`, and a row in `docs/rules.md`.
- `packages/create-storyspec`: the scaffolder. It bundles `template/` when packed.
- `template`: the app new projects get. It must always pass `npm run check`.

## Releasing

Add a changeset (`npx changeset`) to any PR that changes a published package. Merging the release PR that the Changesets action opens publishes to npm.
