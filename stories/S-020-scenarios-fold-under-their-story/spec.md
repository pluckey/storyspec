# S-020 spec

### Requirement: Folding scenarios {#S-020}

WHEN Stories is read THE SYSTEM SHALL show each story as one line with its title, its persona, its state and a proof summary, and open its scenarios only on request.

#### Scenario: Collapsed by default {#S-020.1}

- GIVEN a project with 14 stories and 150 scenarios
- WHEN Stories is opened
- THEN 14 lines are shown and no scenario

#### Scenario: The summary counts proof {#S-020.2}

- GIVEN a story with 14 scenarios: 10 proven by tests, 2 by a person, 2 pending
- WHEN its line is read
- THEN it says "10 by tests · 2 by a person · 2 need a look"

#### Scenario: Opening shows the scenarios in place {#S-020.3}

- GIVEN Stories is open
- WHEN a story line is opened
- THEN its requirement sentence and its scenarios appear beneath it, each with its state, and other stories stay collapsed

#### Scenario: The filter opens matches {#S-020.4}

- GIVEN Stories is open and collapsed
- WHEN the person filters by a word that matches a scenario title
- THEN the stories holding matches are shown open at the matching scenarios and the rest are hidden

#### Scenario: Open state is remembered {#S-020.5}

- GIVEN a story was opened
- WHEN the page refreshes because the files changed
- THEN that story is still open

### Decisions

- Editing scenarios (S-012) happens inside the opened story, where the scenario is (free)
- Open state lives in the URL hash so it survives refresh and can be shared (pinned by S-020.5)
