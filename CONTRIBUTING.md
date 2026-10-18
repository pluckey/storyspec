# Contributing

Thanks for looking. story-spec is opinionated on purpose, so:

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

To try an unreleased build in another project: `npm run build` here, then `node packages/create-story-spec/index.js <dir>` for a new app (it links this checkout), or `npm i -D <path>/packages/story-spec` in an existing one.

- `stories/`: story-spec's own behaviour, written as stories. `npm run check:self` checks them with the last **published** release (installed into `.story-spec/released`), never with this build, so a regression in the trace can't vouch for itself. Until `story-spec` itself is on npm, that release is 0.8, published under the name before the rename: for the run the script links the old config file and state folder names to the new ones (and the config lists the old state folder under `ignore`, so the trace doesn't read through the link), and it changes the one string 0.8 writes its own name into, the header of `scenarios.gen.ts`, in its installed copy. Once `story-spec` is published the script uses it and does none of that; `node scripts/self-check.mjs --plan` says which it would use. New behaviour starts as a story here; existing tests in `packages/story-spec/test` move into stories when their area changes. In this repo the architecture rules, the agent-guidance check and `ids-outside-stories` are off (the framework's own code talks about IDs), and stories list their code under `implementedBy:`.
- `packages/story-spec`: the CLI and library. Rules live in `src/trace/rules.ts`; each one has a mutation test in `test/trace.test.ts`, and a row in `docs/rules.md`.
- `packages/create-story-spec`: the scaffolder. It bundles `template/` when packed.
- `template`: the app new projects get. It must always pass `npm run check`.
- The old name is kept on purpose in a few places: the migration note in README.md, the changelogs, `story-spec migrate` and the reading of the old config file (`src/migrate.ts`, `src/config.ts`), sync's recognition of old markers and hooks (`src/sync.ts`), the 0.1 and 0.8 fixtures, and `scripts/self-check.mjs`. Everywhere else it reads `story-spec`.

## Releasing

Add a changeset (`npx changeset`) to any PR that changes a published package; CI fails without one. Releases are automatic: after a merge to `main`, the Release workflow opens a "Version Packages" PR that bumps both versions and writes the changelogs, and merging that PR publishes both packages to npm (trusted publishing, with provenance) and tags the release. Nobody publishes from a laptop. Trusted publishing is set per package name on npm, so a new name needs it set up by a maintainer before its first release (`npm trust github <pkg> --repo pluckey/story-spec --file release.yml --allow-publish`); until then the publish step fails.

CI also runs `npm run lint:package` (publint and Are the Types Wrong on the packed packages), `npm run smoke:python` (needs `pytest` on PATH), the smoke test against the oldest supported vitest (`SMOKE_VITEST=2 npm run smoke`), and macOS.
