# Concepts

## The story is the unit

Most codebases organize by technical layer (controllers, services, repositories) or by feature, and keep requirements somewhere else: a ticket, a wiki, a spec folder that drifts. storyspec makes the **story** the permanent unit. Its folder holds:

| File | Role |
|---|---|
| `story.md` | Who wants what and why, plus `id`, `title`, `epic`, `status`, `version` and a revision log |
| `spec.md` | One EARS requirement (`WHEN … THE SYSTEM SHALL …`) tagged `{#S-001}`, and GIVEN/WHEN/THEN scenarios tagged `{#S-001.1}` … |
| `<use-case>.ts` | The behaviour, tagged `// @implements S-001`. Every decision the story makes lives here. |
| `<use-case>.types.ts` | Request and response types |
| `scenarios.gen.ts` | Generated from spec.md; never edited by hand |
| `<use-case>.test.ts` | `story(gen, { … })`: exactly one case per scenario, enforced by the type system |

A story's whole history is `git log stories/S-001-*`, a review of S-001 touches one folder, and "implement S-007" gives an agent an obvious destination and a finish line.

## Lifecycle

| Status | Meaning | The trace treats gaps as |
|---|---|---|
| draft | Being written | warnings |
| ready | Scenarios approved | warnings |
| in-progress | Being built | errors |
| done | Every scenario test passes | errors, and tests must pass |
| superseded | Replaced; kept for history | errors |

**New behaviour gets a new story. Changed behaviour revises the existing story:** edit spec.md, bump `version`, add a revision line, update the tests. That keeps exactly one owner per behaviour.

## Ports and adapters underneath

Stories depend on **ports** (interfaces for anything external: storage, time, IDs, other services) and on **domain** types and pure rules. They never touch databases, frameworks or vendor SDKs.

```
src/domain      entities, value types, pure rules shared by stories
src/ports       interfaces stories need
src/adapters    port implementations, grouped by technology (memory, postgres, http-client…)
src/presenters  shape output for one kind of caller (HTTP, CLI, MCP…)
src/entry       delivery mechanisms + composition.ts, the one place that wires adapters into stories
test/fakes      in-memory ports for story tests
test/contracts  one suite per port, run against every adapter and the fake
```

The contract suites make the fakes honest: a story tested against `fakeNoteStore` is trustworthy against Postgres only if both pass the same `NoteStore` contract.

## Why stories don't import each other

If two stories share logic, that logic is a rule of the domain, so it moves into `src/domain` as a pure function both call. That keeps stories independent: you can revise, supersede or delete one without breaking another, and the trace can attribute every decision to exactly one story.

## Why the IDs live in the code

IDs in the spec, the `@implements` tag and the test cases let a few hundred lines of code build a complete traceability matrix with no database, plugin or SaaS. Because the generated scenario types come from the spec, the most important link (spec ↔ tests) is checked by the TypeScript compiler, live in your editor.
