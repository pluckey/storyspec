# S-024 spec

The framework is renamed from `storyspec` to `story-spec`: the npm packages, the command, the config file, the
state folder, the import path, the agent guidance and the docs. Existing projects keep working until they migrate,
and `story-spec migrate` moves them.

### Requirement: Renaming {#S-024}

WHEN the packages are published as `story-spec` and `create-story-spec` THE SYSTEM SHALL answer to `story-spec` on the command line, read `story-spec.config.json`, keep its state in `.story-spec/`, export `story-spec/vitest`, and migrate a project made with `storyspec` in one command.

#### Scenario: The command is story-spec {#S-024.1}

- GIVEN the package is installed
- WHEN `npx story-spec --help` runs
- THEN it prints the usage, and every command name in it reads `story-spec`

#### Scenario: The config file is story-spec.config.json {#S-024.2}

- GIVEN a project with `story-spec.config.json`
- WHEN `story-spec trace` runs
- THEN it reads that file, and its schema is served as `story-spec/config.schema.json`

#### Scenario: The old config file still works, with a note {#S-024.3}

- GIVEN a project with only `storyspec.config.json`
- WHEN `story-spec trace` runs
- THEN it reads that file, and warns once that the file should be renamed with `story-spec migrate`

#### Scenario: State lives in .story-spec {#S-024.4}

- GIVEN a project
- WHEN `story-spec trace` runs
- THEN the test report and the released checker go under `.story-spec/`, and `.story-spec` is ignored by default as `.storyspec` was

#### Scenario: The import path is story-spec/vitest {#S-024.5}

- GIVEN a story test that imports `story` from `story-spec/vitest`
- WHEN the tests run
- THEN it works, and `scenarios.gen.ts` is generated with that import

#### Scenario: Migrate renames the project's files {#S-024.6}

- GIVEN a project made with `storyspec` 0.8: `storyspec.config.json`, `.storyspec/`, tests importing `storyspec/vitest`, generated files importing it, and AGENTS.md and CLAUDE.md with storyspec's managed blocks
- WHEN `story-spec migrate` runs
- THEN the config file is renamed, `.storyspec/` is renamed, every import of `storyspec/vitest` reads `story-spec/vitest`, the managed blocks are rewritten by sync, and the report lists each file changed

#### Scenario: Migrate is safe to run twice {#S-024.7}

- GIVEN a project already migrated
- WHEN `story-spec migrate` runs again
- THEN it reports nothing to migrate and changes no file

#### Scenario: The scaffolder is create-story-spec {#S-024.8}

- GIVEN `npm create story-spec@latest my-app`
- WHEN it finishes
- THEN the app depends on `story-spec`, its config is `story-spec.config.json`, its tests import `story-spec/vitest`, and `npm run check` passes in it

#### Scenario: The guidance names story-spec {#S-024.9}

- GIVEN the agent guidance the package bundles (AGENTS.md, CLAUDE.md, the /story command and its hooks)
- WHEN it is read
- THEN no line says `storyspec`; the managed block markers read `story-spec:begin` and `story-spec:end`, and `story-spec sync` still recognises and replaces a block with the old markers

#### Scenario: The repo and the docs name story-spec {#S-024.10}

- GIVEN the repo
- WHEN README.md, docs/, CONTRIBUTING.md, the workflows and both package.json files are read
- THEN the package names, the bin, the repository and homepage URLs (`github.com/pluckey/story-spec`), the workspace scripts and the commands all read `story-spec`, and the only remaining `storyspec` mentions are in the migration note, the changelog and the old-name handling of S-024.3 and S-024.9

#### Scenario: The self-check survives the rename {#S-024.11}

- GIVEN the last published checker is still `storyspec` 0.8
- WHEN `npm run check:self` runs on this repo
- THEN it passes, the script giving the old checker what it needs to read the renamed repo, and once `story-spec` is published the script prefers it

#### Scenario: The old packages point to the new ones {#S-024.12 proof=manual}

- GIVEN `story-spec` and `create-story-spec` are published
- WHEN a person runs `npm deprecate storyspec` and `npm deprecate create-storyspec` with the message "Renamed to story-spec; run npx story-spec migrate"
- THEN installing the old names prints that message

### Decisions

- The package directories are renamed to `packages/story-spec` and `packages/create-story-spec`, with git moves so history follows (free)
- The versions continue from 0.8.0: the first `story-spec` release is 0.9.0 and the changeset is a minor for both packages (free)
- `story-spec.config.json` is the only name written; the old name is read with a warning for one release line, then dropped (pinned by S-024.3)
- `migrate` keeps its existing jobs and adds the rename; it runs sync at the end so the managed blocks are rewritten (pinned by S-024.6)
- The environment variable `STORYSPEC_SPEC` becomes `STORY_SPEC_SPEC`, with the old name still read (free)
- Trusted publishing for the two new package names must be set up by the maintainer with `npm trust github <pkg> --repo pluckey/story-spec --file release.yml --allow-publish`; the release workflow is updated to the new names and will fail until that is done, which is expected (free; noted in the PR)
- check:self installs the old checker under its old name while `story-spec` is unpublished, and gives it `storyspec.config.json` and `.storyspec/` as symlinks for the run (pinned by S-024.11)
