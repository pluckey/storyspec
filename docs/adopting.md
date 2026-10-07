# Adopting storyspec in an existing repo

You don't have to restructure everything at once. Stories can grow beside existing code.

1. `npm i -D storyspec vitest`
2. Add `storyspec.config.json`. Point `storyMayImport`, `layers` and `wiring` at your real folders, or start with `"layers": {}` so only story rules apply.
3. Add scripts: `"gen": "storyspec gen"`, `"story": "storyspec story"`, `"trace": "storyspec trace"`.
4. Write the next feature as a story: `npm run story -- "…"`, scenarios, `npm run gen`, `story(gen, …)` tests, then the use case in the story folder.
5. Wire the use case from wherever your composition happens, and add that file to `wiring`.
6. When an existing feature changes, consider moving its logic into a story as part of the change. Leave the rest alone.
7. Tighten `layers` gradually as code moves behind ports. Run `storyspec trace` in CI from day one so new stories stay clean.

Copy `AGENTS.md` (and `CLAUDE.md` plus `.claude/` if you use Claude Code) from the [template](../template) and edit them to match your folders.
