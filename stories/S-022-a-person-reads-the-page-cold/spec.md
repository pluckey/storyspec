# S-022 spec

### Requirement: Reading cold {#S-022}

WHEN a person who has never seen the project opens its page THE SYSTEM SHALL let them say within a minute, without opening a file, what each persona can do today, what is being built, and what waits on a decision.

#### Scenario: The home renders on every project {#S-022.1}

- GIVEN every project the page lists
- WHEN each home is rendered
- THEN it renders without errors and names at least the project's stories count

#### Scenario: The three questions are answerable from the home {#S-022.2}

- GIVEN a project with personas, stories in each state and an open decision
- WHEN the home is read
- THEN each persona's can-do-today count, the being-built count and the decision are all visible without scrolling at 1280 by 800

#### Scenario: A person reads it cold {#S-022.3 proof=manual}

- GIVEN a person who has not seen the project
- WHEN they open the page and are asked the three questions after one minute
- THEN they answer all three correctly

### Decisions

- The person for S-022.3 should not be the author of the stories; a note names who read it (free)
