# S-002 spec

### Requirement: Implementations in any file {#S-002}

WHEN story.md lists files under `implementedBy:` THE SYSTEM SHALL accept them as the story's implementation instead of a TypeScript use case tagged `@implements`.

#### Scenario: Listed files that exist implement the story {#S-002.1}

- GIVEN a story whose story.md says `implementedBy: app/greet.py`, which exists
- WHEN the trace runs
- THEN the story has its implementation, and the trace lists app/greet.py for it

#### Scenario: A listed file that doesn't exist is an error {#S-002.2}

- GIVEN story.md says `implementedBy: app/greet.py, app/missing.py`
- WHEN the trace runs
- THEN it reports that app/missing.py doesn't exist

#### Scenario: Without implementedBy or @implements there is no implementation {#S-002.3}

- GIVEN a story with neither `implementedBy:` nor a file tagged `@implements`
- WHEN the trace runs
- THEN it reports the missing implementation, and flags the `@implements` tag left in app/greet.py, which no story lists; it asks for no generated file, since the project isn't TypeScript (S-009)
