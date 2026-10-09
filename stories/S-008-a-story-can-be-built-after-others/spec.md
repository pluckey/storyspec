# S-008 spec

### Requirement: A story can be built after others {#S-008}

WHEN a story names stories under after: in its front matter THE SYSTEM SHALL check that they exist and form no loop, and show the order in TRACE.md.

#### Scenario: after: is shown in TRACE.md {#S-008.1}

- GIVEN a second story whose story.md says after: S-001
- WHEN the trace runs
- THEN there is no finding, and TRACE.md shows "after S-001" beside it

#### Scenario: after: naming a missing story is an error {#S-008.2}

- GIVEN a story whose after: names S-099
- WHEN the trace runs
- THEN an after error names S-099

#### Scenario: A story can't come after itself {#S-008.3}

- GIVEN S-001 with after: S-001
- WHEN the trace runs
- THEN an after error says it names itself

#### Scenario: A loop is an error {#S-008.4}

- GIVEN S-001 after S-002 and S-002 after S-001
- WHEN the trace runs
- THEN one after error shows the loop, S-001 → S-002 → S-001

### Decisions

- after: is build order, not behaviour: extends: (a story that changes another's behaviour) is a separate idea, still to come (free)
- Several stories are comma-separated, like implementedBy: (pinned by S-008.4)
