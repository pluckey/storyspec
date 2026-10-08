# Adopting storyspec in an existing repo

You don't have to restructure everything at once. Stories can grow beside existing code.

1. `npm i -D storyspec vitest`
2. Add `storyspec.config.json`. Point `storyMayImport`, `layers` and `wiring` at your real folders, or start with `"layers": {}` so only story rules apply.
3. Add scripts: `"gen": "storyspec gen"`, `"story": "storyspec story"`, `"trace": "storyspec trace"`.
4. Write the next feature as a story: `npm run story -- "…"`, scenarios, `npm run gen`, `story(gen, …)` tests, then the use case in the story folder.
5. Wire the use case from wherever your composition happens, and add that file to `wiring`.
6. When an existing feature changes, consider moving its logic into a story as part of the change. Leave the rest alone.
7. Tighten `layers` gradually as code moves behind ports. Run `storyspec trace` in CI from day one so new stories stay clean.

Run `npx storyspec sync` to add the agent guidance: a storyspec block in `AGENTS.md`, and with `--claude` (or once the project has a `CLAUDE.md` or `.claude/`) the `CLAUDE.md` block, the `/story` command and the hooks. If your repo already has an `AGENTS.md`, the block goes under its title and your text stays. Write notes about your folders and conventions outside the block.

## Updating storyspec

The agent guidance comes from the installed storyspec version, so it updates with the package:

```bash
npm i -D storyspec@latest
npx storyspec sync     # rewrites the storyspec blocks and files from the new version
npm run check
```

`sync` changes only what storyspec owns: the marked blocks in `AGENTS.md` and `CLAUDE.md`, the `/story` command, and the hooks whose command runs storyspec. Each block is stamped with the version it came from and a hash of its text, so `sync` knows when it's stale and when someone edited it by hand; it won't overwrite a hand edit unless you pass `--force`. Until you sync, the trace warns (`framework-sync`). In CI, `storyspec sync --check` fails if the guidance is out of date. A project made from the 0.1 template whose files were never edited is migrated whole on its first sync.

New rules arrive as warnings when they could break existing projects. Use `rules` in `storyspec.config.json` to choose a rule's severity for your project.
