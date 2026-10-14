# S-012 spec

### Requirement: A person manages the spec in a browser {#S-012}

WHEN a person runs storyspec ui and acts on the page THE SYSTEM SHALL make each change as an edit to the story's files and show the spec as the trace now sees it.

#### Scenario: The page reads the spec {#S-012.1}

- GIVEN a story with a requirement, steps under a scenario and a decision
- WHEN the page asks for the state
- THEN it gets the story with its requirement, each scenario's steps and result, each decision's question, and the trace's findings

#### Scenario: Answering an open decision pins it {#S-012.2}

- GIVEN the decision "Greeting punctuation (open); S-001.1"
- WHEN a person answers "an exclamation mark" as pinned
- THEN spec.md reads "Greeting punctuation: an exclamation mark; pinned by S-001.1"
- AND S-001.1 is no longer blocked

#### Scenario: An answer can be free {#S-012.3}

- GIVEN the decision "Token lifetime (open)"
- WHEN a person answers "7 days" as free
- THEN spec.md reads "Token lifetime: 7 days (free)"

#### Scenario: A decision that names no scenario can't be pinned {#S-012.4}

- GIVEN the decision "Token lifetime (open)"
- WHEN a person answers it as pinned
- THEN the edit is refused, saying a pin needs a scenario that proves it
- AND spec.md is unchanged

#### Scenario: Approving a draft makes it ready {#S-012.5}

- GIVEN a draft story
- WHEN a person approves it
- THEN story.md says status: ready

#### Scenario: Editing an approved story revises it {#S-012.6}

- GIVEN a story past draft at version 1
- WHEN a person changes the steps of S-001.1
- THEN spec.md has the new steps under the same tag
- AND story.md says version: 2, with a Revisions line saying S-001.1 changed

#### Scenario: A new scenario gets the next ID {#S-012.7}

- GIVEN a story whose last scenario is S-001.2
- WHEN a person adds a scenario
- THEN it is written as S-001.3, before the Decisions section

#### Scenario: A scenario with no THEN is refused {#S-012.8}

- WHEN a person saves a scenario whose steps have no THEN line
- THEN the edit is refused, saying a scenario needs a THEN
- AND spec.md is unchanged

#### Scenario: A file changed since the page read it is refused {#S-012.9}

- GIVEN the page read spec.md, and someone then edited it
- WHEN a person answers a decision from the page
- THEN the edit is refused, saying the file changed and to reload
- AND spec.md keeps the other person's edit

#### Scenario: Another site can't make edits {#S-012.10}

- GIVEN storyspec ui is running
- WHEN a page from another origin posts an edit to it
- THEN the edit is refused

### Decisions

- The files are the only copy: no database, no accounts; git is the history and the save button (free)
- The server listens on localhost only (free)
- Any edit to a story past draft bumps its version and adds a Revisions line, as AGENTS.md asks of people (pinned by S-012.6)
- A decision is addressed by its position under Decisions, and every write carries the hash of the file it read, so a position can't point at a line that moved (pinned by S-012.9)
- Answering keeps the decision's question and replaces "(open)" and its scenario list with ": <answer>" and either "; pinned by …" or "(free)" (pinned by S-012.2, S-012.3)
- Statuses a person can set are draft, ready, in-progress and superseded; done is worked out from proof (free)
