# S-006 spec

### Requirement: Recorded decisions {#S-006}

WHEN spec.md has a `### Decisions` section THE SYSTEM SHALL check that each decision names the scenarios that pin it or is marked free, and list the decisions in TRACE.md.

#### Scenario: A decision pinned by a scenario is accepted {#S-006.1}

- GIVEN a decision "Slug clashes get -2, -3, …; pinned by S-001.1", and S-001.1 exists
- WHEN the trace runs
- THEN there is no finding about it

#### Scenario: A decision pinned by a missing scenario is an error {#S-006.2}

- GIVEN a decision pinned by S-001.9, which no spec has
- WHEN the trace runs
- THEN it reports an error under the decisions rule

#### Scenario: A decision marked free is accepted {#S-006.3}

- GIVEN a decision "Token lifetime: 7 days (free)"
- WHEN the trace runs
- THEN there is no finding about it

#### Scenario: A decision neither pinned nor free is a warning {#S-006.4}

- GIVEN a decision "Usernames are case-sensitive" that names no scenario and isn't marked free
- WHEN the trace runs
- THEN it warns that the decision is neither pinned nor free

#### Scenario: TRACE.md lists the decisions {#S-006.5}

- GIVEN a story with one pinned and one free decision
- WHEN the trace writes TRACE.md
- THEN a Decisions section lists both, with the pinning scenario or "free"
