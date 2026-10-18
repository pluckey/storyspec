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

- `stories/`: storyspec's own behaviour, written as stories. `npm run check:self` checks them with the last **published** storyspec (installed into `.storyspec/released`), never with this build, so a regression in the trace can't vouch for itself. New behaviour starts as a story here; existing tests in `packages/storyspec/test` move into stories when their area changes. In this repo the architecture rules, the agent-guidance check and `ids-outside-stories` are off (the framework's own code talks about IDs), and stories list their code under `implementedBy:`.
- `packages/storyspec`: the CLI and library. Rules live in `src/trace/rules.ts`; each one has a mutation test in `test/trace.test.ts`, and a row in `docs/rules.md`.
- `packages/create-storyspec`: the scaffolder. It bundles `template/` when packed.
- `template`: the app new projects get. It must always pass `npm run check`.

## Releasing

Add a changeset (`npx changeset`) to any PR that changes a published package; CI fails without one. Releases are automatic: after a merge to `main`, the Release workflow opens a "Version Packages" PR that bumps both versions and writes the changelogs, and merging that PR publishes both packages to npm (trusted publishing, with provenance) and tags the release. Nobody publishes from a laptop.

CI also runs `npm run lint:package` (publint and Are the Types Wrong on the packed packages), `npm run smoke:python` (needs `pytest` on PATH), the smoke test against the oldest supported vitest (`SMOKE_VITEST=2 npm run smoke`), and macOS.
