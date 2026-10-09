# storyspec

**Story-first, spec-driven development: every story owns its spec, code and tests, and one check proves it.**

```bash
npm create storyspec@latest my-app
cd my-app && npm run check
```

In an existing repo: `npm i -D storyspec vitest`, then `npx storyspec sync` (see [adopting](docs/adopting.md)). To update later: `npm i -D storyspec@latest && npx storyspec sync && npx storyspec migrate` (see [updating](docs/adopting.md#updating-storyspec)).

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

Underneath is clean architecture with ports and adapters (`src/domain`, `src/ports`, `src/adapters`, `src/presenters`, `src/entry`), and the `storyspec` CLI holds it together (the import graph comes from [dependency-cruiser](https://github.com/sverweij/dependency-cruiser)):

- **Tests are typed against the spec.** Add a scenario to `spec.md`, run `storyspec gen`, and the test file won't compile until that scenario has a case.
- **`storyspec trace`** runs the tests and writes `stories/TRACE.md`, a matrix of epic → story → implementation → scenario → proof. It fails on gaps, orphans, stale generated files, failing tests, and imports that break the architecture.
- **Done is proven, not declared.** Each scenario names the tiers that must prove it: local tests, a deployed run, or a person's check. Proof from beyond the local run is recorded in `stories/PROOF.json` with a hash of the scenario's text, and a story shows as done only when every scenario is proven at its current wording.
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
| `storyspec trace [--tier <name>] [--require-proven] [--no-run] [--json]` | Run a tier's tests (local by default), write TRACE.md, enforce every rule; another tier's results are recorded in `stories/PROOF.json` |
| `storyspec prove <ID> [--tier manual] [--fail] [--note "…"]` | Record a person's proof of a scenario or a story's scenarios |
| `storyspec migrate` | Update stories for the installed version (0.3: done is derived from proof) |
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
| `examples/realworld` | The RealWorld API in Python (FastAPI, Postgres), built story by story: proof tiers, a deployed tier on docker compose, and the official RealWorld suite as part of proof |
| `docs` | Documentation |

## Prior art

storyspec borrows ideas from tools worth knowing:
- [OpenFastTrace](https://github.com/itsallcode/openfasttrace) for tag-based requirement tracing
- [Serenity BDD](https://serenity-bdd.github.io/) for living documentation
- [OpenSpec](https://github.com/Fission-AI/OpenSpec) and [Spec Kit](https://github.com/github/spec-kit) for spec-driven development with AI agents

What's different here is that the story is a permanent folder that *owns* its code, and that one check enforces traceability and architecture together.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Licensed [MIT](LICENSE).
