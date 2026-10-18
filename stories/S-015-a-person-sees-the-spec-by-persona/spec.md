# S-015 spec

Personas are the people a product serves. A story already names one in its "As a…" line and often in
`trigger: actor:<role>`. This story makes them first class: a file that describes them, a field that ties each
story to them, a trace that groups by them and warns when they drift, and a page that shows one persona's journey.

### Requirement: Seeing the spec by persona {#S-015}

WHEN a project describes its personas in `stories/PERSONAS.md` THE SYSTEM SHALL tie every story to the personas it serves, group the trace and the page by persona, and report the personas and decisions that no story covers.

#### Scenario: Personas are listed in one file {#S-015.1}

- GIVEN `stories/PERSONAS.md` with `## Player` and `## Developer`, each followed by a line of prose
- WHEN the project is scanned
- THEN the scan lists two personas, `player` and `developer` (the heading, lower-cased and slugged), each with its prose

#### Scenario: A story names its personas {#S-015.2}

- GIVEN a story with `persona: player` in story.md
- WHEN the project is scanned
- THEN the story's personas are `[player]`

#### Scenario: A story may serve more than one {#S-015.3}

- GIVEN a story with `persona: player, developer`
- WHEN the project is scanned
- THEN the story's personas are `[player, developer]`, in that order

#### Scenario: Without the field, the "As a…" line decides {#S-015.4}

- GIVEN a story with no `persona:` whose body begins "As a player, I want…"
- WHEN the project is scanned
- THEN the story's personas are `[player]`

#### Scenario: A persona that isn't described is a warning {#S-015.5}

- GIVEN `PERSONAS.md` listing only `player` and a story with `persona: friend`
- WHEN the trace runs
- THEN it warns, naming the story and `friend`, with the rule `unknown-persona`, and does not fail

#### Scenario: A described persona with no story is a warning {#S-015.6}

- GIVEN `PERSONAS.md` listing `player` and `friend`, and stories that only name `player`
- WHEN the trace runs
- THEN it warns with the rule `persona-without-stories`, naming `friend`

#### Scenario: The field and the prose must agree {#S-015.7}

- GIVEN a story with `persona: developer` whose body begins "As a player, I want…"
- WHEN the trace runs
- THEN it warns with the rule `persona-prose-mismatch`, naming the story, the field's value and the prose's value

#### Scenario: Without PERSONAS.md nothing changes {#S-015.8}

- GIVEN a project with no `stories/PERSONAS.md`
- WHEN the trace runs
- THEN there are no persona warnings and the trace reads as before

#### Scenario: The trace groups by persona on request {#S-015.9}

- GIVEN a project with personas `player` and `developer` and stories for each
- WHEN `storyspec trace --by persona` runs
- THEN TRACE.md has one section per persona, in PERSONAS.md order, each holding that persona's stories in ID order with the usual columns, and a story serving two personas appears under both

#### Scenario: The trace shows the coverage grid {#S-015.10}

- GIVEN a project with personas `player` and `friend`, epics `E-1` and `E-2`, and stories only for `player` in `E-1`
- WHEN `storyspec trace` runs
- THEN TRACE.md ends with a grid of personas across and epics down, each cell the counts of done, in-progress and draft stories, and the empty cells read `·`

#### Scenario: An open decision names who answers it {#S-015.11}

- GIVEN a story whose decisions include "- The target frame rate on low-end machines (open: player), waited on by S-010.14"
- WHEN the project is scanned
- THEN that decision's owner is `player`

#### Scenario: The page has a Personas tab {#S-015.12}

- GIVEN storyspec ui is open on a project with PERSONAS.md
- WHEN the person opens the Personas tab and picks `player`
- THEN the page shows the persona's prose, then the open decisions owned by `player`, then `player`'s stories in ID order with status and proof per scenario

#### Scenario: The page lists personas without stories {#S-015.13}

- GIVEN storyspec ui is open on a project whose PERSONAS.md names `friend` and no story serves `friend`
- WHEN the person opens the Personas tab
- THEN `friend` is listed with "no stories yet", and picking it offers to start one with `persona: friend` filled in

#### Scenario: Adding a persona from the page writes the file {#S-015.14}

- GIVEN storyspec ui is open on a project with PERSONAS.md
- WHEN the person adds a persona named "Friend" with a line of prose
- THEN `## Friend` and the prose are appended to PERSONAS.md and shown as a diff, like every other change the page makes

#### Scenario: The template starts with one persona {#S-015.15}

- GIVEN a project created with `create-storyspec`
- WHEN its files are listed
- THEN `stories/PERSONAS.md` exists with one persona, `Member`, and the example story names `persona: member`

#### Scenario: A person reads one journey on the page {#S-015.16 proof=manual}

- GIVEN a project with several personas and a few stories each
- WHEN a person who does not edit files opens the Personas tab
- THEN they can tell, without opening any file, what each persona can do today, what is still in progress for them, and what decision is waiting on them

### Decisions

- Personas are a flat view over a flat stories folder, never folders: a story serving two personas appears under both and lives in one place (free, but it is the point of the design)
- The persona key is the heading of PERSONAS.md lower-cased with spaces replaced by hyphens; "As a…" prose is matched the same way after the article ("As a", "As an") (pinned by S-015.1, S-015.4)
- `persona:` is optional and the prose is the fallback, so no existing project needs an edit to get the view; the mismatch rule only fires when both are present and differ (pinned by S-015.4, S-015.7)
- All three persona rules are warnings, not failures, because a persona is a lens and not a contract; a project that wants them strict can promote them in `rules` like any other rule (pinned by S-015.5, S-015.6, S-015.7)
- The coverage grid always prints when PERSONAS.md exists, and `--by persona` only changes the main table's grouping (pinned by S-015.9, S-015.10)
- An open decision's owner is written as `(open: <persona>)`; `(open)` with no owner is still allowed and shows under "unassigned" on the page (pinned by S-015.11)
- `trigger: actor:<role>` is not changed and is not the same thing: the trigger says who starts the story, the persona says who it is for; the trace does not require them to match (free)
- The page writes PERSONAS.md the way it writes story files: a plain-text edit shown as a diff, committed with git by the person (pinned by S-015.14)
