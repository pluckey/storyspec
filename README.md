# storyspec

**Story-first, spec-driven development: every story owns its spec, code and tests, and one check proves it.**

```bash
npm create storyspec@latest my-app
cd my-app && npm run check
```

<!-- GIF: add a scenario to spec.md → test file turns red → implement → TRACE.md turns green -->

## What you get

A TypeScript app where the unit of development is a **story folder**:

```
stories/S-001-member-saves-a-note/
  story.md            As a member, I want to save a note…   (status, version, revisions)
  spec.md             WHEN … THE SYSTEM SHALL …  +  scenarios {#S-001.1} {#S-001.2} …
  save-note.ts        the use case          // @implements S-001
  scenarios.gen.ts    generated from spec.md
  save-note.test.ts   story(gen, { 'S-001.1': …, 'S-001.2': … })
```

Underneath is clean architecture with ports and adapters (`src/domain`, `src/ports`, `src/adapters`, `src/presenters`, `src/entry`), and the `storyspec` CLI holds it together:

- **Tests are typed against the spec.** Add a scenario to `spec.md`, run `storyspec gen`, and the test file won't compile until that scenario has a case.
- **`storyspec trace`** runs the tests and writes `stories/TRACE.md`, a matrix of epic → story → implementation → scenario → result. It fails on gaps, orphans, stale generated files, a "done" story with a failing test, and imports that break the architecture.
- **Agents know the rules.** `AGENTS.md` covers any coding agent, and Claude Code gets a `/story` command plus hooks that typecheck after edits and trace before finishing.

| Epic | Story | Status | v | Implementation | Scenario | Test |
|---|---|---|---|---|---|---|
| E-1 Notes | S-001 Member saves a note | done | 1 | stories/S-001-member-saves-a-note/save-note.ts | S-001.1 | ✓ pass |
| | | | | | S-001.2 | ✓ pass |
| E-1 Notes | S-002 Member lists their notes | done | 1 | stories/S-002-member-lists-their-notes/list-notes.ts | S-002.1 | ✓ pass |

## Commands

| Command | Does |
|---|---|
| `npm create storyspec@latest <dir>` | New app with the example notes API (`-- --no-example` for a bare structure with one draft story) |
| `storyspec story "<title>" [--epic "<epic>"]` | Next story folder from templates |
| `storyspec gen [--check]` | Write `scenarios.gen.ts` per story (`--check` fails if stale) |
| `storyspec trace [--no-run] [--json]` | Run tests, write TRACE.md, enforce every rule |
| `storyspec sync [--check] [--force] [--claude]` | Bring the agent guidance (`AGENTS.md` block, and for Claude Code the `CLAUDE.md` block, `/story` command and hooks) up to the installed version. See [updating](docs/adopting.md#updating-storyspec) |

## Docs

- [Concepts](docs/concepts.md): stories, the lifecycle, ports and adapters, why one folder per story
- [Rules](docs/rules.md): every rule the trace enforces, why, and how to fix a violation
- [Configuration](docs/config.md): `storyspec.config.json`
- [Adopting in an existing repo](docs/adopting.md)
- [Roadmap](docs/roadmap.md)
- The template's own [README](template/README.md) and [AGENTS.md](template/AGENTS.md)

## Repository layout

| Path | What |
|---|---|
| `packages/storyspec` | The CLI and library (`storyspec`, `storyspec/vitest`) |
| `packages/create-storyspec` | The scaffolder behind `npm create storyspec` |
| `template` | The app new projects start from (a working notes API) |
| `docs` | Documentation |

## Prior art

storyspec borrows ideas from tools worth knowing:
- [OpenFastTrace](https://github.com/itsallcode/openfasttrace) for tag-based requirement tracing
- [Serenity BDD](https://serenity-bdd.github.io/) for living documentation
- [OpenSpec](https://github.com/Fission-AI/OpenSpec) and [Spec Kit](https://github.com/github/spec-kit) for spec-driven development with AI agents

What's different here is that the story is a permanent folder that *owns* its code, and that one check enforces traceability and architecture together.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Licensed [MIT](LICENSE).
