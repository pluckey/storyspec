# LOG

All times 2026-10-09, America/Chicago, from the shell clock and DB timestamps. Whole job: 09:29 to about 09:37 wall clock.

- 09:29 Read the seed: README, conftest, 14 stories/specs, 49 tests, 13 hurl files (everything read before writing any code).
- ~09:30 Installed storyspec 0.6.0, TypeScript, tsx, pg, Hono. Read storyspec docs (config, concepts, rules, adopting) and grepped `dist/` for how `implementedBy` is parsed (comma-separated).
- ~09:30–09:33 Wrote domain (errors, rules, model), Store interface, Postgres store, security (scrypt + HS256 JWT), 14 use cases (one per story), Hono routes, entry point. `tsc --noEmit` clean on the first try.
- 09:33:43 **Run 1, pytest: 49/49 green.** **Run 1, hurl: 13/13 green.** No failures at any point.
- 09:33:52 Probed silent decisions by hand (bad token → 401, malformed JSON → 400, `limit=-1` → 422) and checked psql: stored `09:33:43.764-05`, served `14:33:43.764Z`.
- ~09:34 Wrote `scripts/acceptance.sh` and `storyspec.config.json`; added `implementedBy` to every story. **Run 1, `storyspec check`: 14/14 done**, one `framework-sync` warning; `storyspec sync` cleared it.
- ~09:35 Sanity check of the harness: temporarily dropped `body` from the favorite response. pytest stayed green, `hurl/favorites.hurl` failed, `storyspec check` exited 1. Reverted, rechecked green.

Test runs: pytest 1 manual + 4 via `storyspec check`; hurl 1 manual + 4 via `check` (one deliberately broken). Runs before green: 1 each.

What taught the most: no failure did. The lessons came from reading test assertions ahead of time, notably the
same-millisecond edit (`updatedAt != ...` right after publishing), back-to-back publishes needing an `id` tie-break, the
exact error envelope, and that the favorite response must carry `body` (only hurl checks it).
