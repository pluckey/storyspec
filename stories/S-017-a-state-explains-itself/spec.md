# S-017 spec

Nothing on the page stores a state. Done, being built, planned, stale, blocked and needs a look are worked out from
the stories, the code and the proofs, and the page can always say how.

### Requirement: Explaining a state {#S-017}

WHEN a person opens the "why" on any state word THE SYSTEM SHALL show the rule that produced it, the items that are missing or offending, and the action that would change it, in sentences.

#### Scenario: Done explains itself {#S-017.1}

- GIVEN a story whose every scenario is proven in every tier it needs
- WHEN its why is opened
- THEN it says the story is done because all N scenarios are proven, naming the tiers

#### Scenario: Being built names what is missing {#S-017.2}

- GIVEN a story with 14 scenarios of which 12 are proven, 2 awaiting a person
- WHEN its why is opened
- THEN it says 12 of 14 are proven, lists the two by title, and offers "Check" on each

#### Scenario: Stale names the proof and the change {#S-017.3}

- GIVEN a scenario proven by a person whose text changed afterwards
- WHEN its why is opened
- THEN it names who checked it and when, shows the text then and now, and offers "Check again"

#### Scenario: Blocked names the decision {#S-017.4}

- GIVEN a scenario waiting on an open decision
- WHEN its why is opened
- THEN it names the decision and its owner and offers "Answer"

#### Scenario: A state never disagrees with the trace {#S-017.5}

- GIVEN any project
- WHEN every state word on the page is compared with `storyspec trace --json`
- THEN they agree, story by story and scenario by scenario

#### Scenario: Why is one click from every state {#S-017.6 proof=manual}

- GIVEN the page is open
- WHEN a person clicks any state word anywhere on the page
- THEN the why opens in place, and nothing on the page shows a state without one

### Decisions

- States are derived on the server from the same scan and trace the CLI uses; the page never keeps a derived value across an edit (pinned by S-017.5)
- The why is a short template per state (done, being built, planned, stale, blocked, needs a look) filled with the items, never free text (free)
- "The details" under the why shows the rule name, the IDs and the hashes for developers (free)
