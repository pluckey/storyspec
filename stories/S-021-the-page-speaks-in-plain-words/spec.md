# S-021 spec

### Requirement: Plain words {#S-021}

WHEN any state, finding or heading is shown THE SYSTEM SHALL use a plain sentence from one vocabulary table, keep IDs, versions, rule names and hashes to a details line, and give every finding an action.

#### Scenario: States read from one table {#S-021.1}

- GIVEN the page's vocabulary table
- WHEN every state word on the page is collected
- THEN each is one of: can do today, being built, planned, needs a look, waiting on you, checked, failed a check; and the table maps each to the trace's status it stands for

#### Scenario: No ID in a heading {#S-021.2}

- GIVEN any screen
- WHEN its headings are read
- THEN none contains a story or scenario ID; the ID is on the details line of the item

#### Scenario: Every finding says what to do {#S-021.3}

- GIVEN each rule in `docs/rules.md`
- WHEN its finding is shown on the page
- THEN the finding is a sentence that names the thing and the fix, and the rule name is on the details line

#### Scenario: Versions and hashes are details {#S-021.4}

- GIVEN a story at v2 with a stale proof
- WHEN its line is read
- THEN "v2" and the hash do not appear until the details line is opened

#### Scenario: The vocabulary is the single source {#S-021.5}

- GIVEN the vocabulary table
- WHEN a word is changed in it
- THEN it changes everywhere on the page

### Decisions

- The vocabulary table is one file in the ui package, exported so the CLI could use the same words later (free)
- The details line is a single muted line at the foot of an item: ID · version · rule · hash, and nothing else (free)
