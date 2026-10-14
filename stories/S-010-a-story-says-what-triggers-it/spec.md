# S-010 spec

### Requirement: A story says what triggers it {#S-010}

WHEN a story's front matter has trigger: or emits: THE SYSTEM SHALL check them and show in TRACE.md which stories each trigger starts.

#### Scenario: Triggers and events are shown in TRACE.md {#S-010.1}

- GIVEN S-001 with trigger: actor:visitor and emits: greeted, and S-002 with trigger: event:greeted
- WHEN the trace runs
- THEN there is no trigger finding
- AND TRACE.md shows "on actor:visitor" beside S-001 and "on event:greeted" beside S-002
- AND its Triggers table has a row for event:greeted, emitted by S-001, starting S-002

#### Scenario: An unknown kind of trigger is an error {#S-010.2}

- GIVEN a story with trigger: webhook:stripe
- WHEN the trace runs
- THEN a trigger error names the four kinds: actor, event, schedule, external

#### Scenario: A trigger with no name is an error {#S-010.3}

- GIVEN a story with trigger: actor:
- WHEN the trace runs
- THEN a trigger error says the trigger needs a name after the colon

#### Scenario: A story has one trigger {#S-010.4}

- GIVEN a story with trigger: actor:visitor, schedule:nightly
- WHEN the trace runs
- THEN a trigger error says a story has one trigger and suggests splitting the story

#### Scenario: An event no story emits is a warning {#S-010.5}

- GIVEN a story with trigger: event:greeted and no story that emits greeted
- WHEN the trace runs
- THEN a trigger warning says no story emits greeted

#### Scenario: A story needs no trigger {#S-010.6}

- GIVEN stories with no trigger: or emits:
- WHEN the trace runs
- THEN there is no trigger finding, and TRACE.md has no Triggers table

### Decisions

- A trigger is who or what starts the story; the beneficiary stays in the "As a… so that…" text, which the trace doesn't read (free)
- Four kinds, kind:name, because those are the ways a requirement's WHEN can start (pinned by S-010.2)
- One trigger per story, as a story has one requirement and so one WHEN (pinned by S-010.4)
- An event no story emits only warns, so a story can be written before the story that emits its event (pinned by S-010.5)
- An emitted event that no story listens for is fine: other systems, or an audit, may be its reader (free)
- Event names are matched exactly, with no namespaces or wildcards (free)
