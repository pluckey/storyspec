# S-011 spec

### Requirement: A model names records and their states {#S-011}

WHEN stories/MODEL.md lists records and their transitions THE SYSTEM SHALL check the stories' events against each record's states and show each record's lifecycle in TRACE.md.

#### Scenario: A record's lifecycle is shown in TRACE.md {#S-011.1}

- GIVEN MODEL.md with a record Greeting and the transition Draft → Sent
- AND S-001 emits greeting.created and S-002 emits greeting.sent
- WHEN the trace runs
- THEN there is no model finding
- AND TRACE.md has a Greeting table with a row for Sent, entered by S-002

#### Scenario: An event for a state the record doesn't have is an error {#S-011.2}

- GIVEN MODEL.md with Greeting: Draft → Sent
- AND a story that emits greeting.delivered
- WHEN the trace runs
- THEN a model error says Greeting has no state delivered, and lists its states

#### Scenario: A state no story moves a record into is a warning {#S-011.3}

- GIVEN MODEL.md with Greeting: Draft → Sent, and no story that emits greeting.sent
- WHEN the trace runs
- THEN a model warning says no story moves a Greeting to Sent
- AND there is no warning for Draft, where greetings start

#### Scenario: created and changed are events of every record {#S-011.4}

- GIVEN MODEL.md with Greeting: Draft → Sent
- AND a story with trigger: event:greeting.changed and another that emits greeting.changed
- WHEN the trace runs
- THEN there is no model finding

#### Scenario: Events of things that aren't records aren't checked {#S-011.5}

- GIVEN MODEL.md with Greeting: Draft → Sent
- AND a story that emits spec.saved
- WHEN the trace runs
- THEN there is no model finding about spec.saved

#### Scenario: Without MODEL.md nothing changes {#S-011.6}

- GIVEN no stories/MODEL.md
- WHEN the trace runs
- THEN there is no model finding, and TRACE.md has no Model section

### Decisions

- A record is a `## Name` heading; its transitions are bullets of state names joined by → (or ->), and other lines are notes the trace doesn't read (free)
- A record's events are `<record>.<state>` for entering a state, plus `<record>.created` and `<record>.changed`, with names as slugs (pinned by S-011.1, S-011.4)
- A state no transition leads to is where records start, so nothing has to move a record into it (pinned by S-011.3)
- Fields aren't modelled: the lifecycle is what stories hand on to each other, and fields belong to the app's code (free)
- The model lives in stories/ beside TRACE.md and PROOF.json, one file for the project, because records are shared by many stories (free)
