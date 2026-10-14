# S-006 spec

### Requirement: Recorded decisions {#S-006}

WHEN spec.md has a `### Decisions` section THE SYSTEM SHALL check that each decision is pinned by the scenarios it names, marked free, or marked open, and list the decisions in TRACE.md.

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

- GIVEN a decision "Usernames are case-sensitive" that names no scenario and isn't marked free or open
- WHEN the trace runs
- THEN it warns that the decision is neither pinned, free nor open

#### Scenario: TRACE.md lists the decisions {#S-006.5}

- GIVEN a story with one pinned and one free decision
- WHEN the trace writes TRACE.md
- THEN a Decisions section lists both, with the pinning scenario or "free"

#### Scenario: An open decision blocks the scenarios it names {#S-006.6}

- GIVEN a decision "Approval threshold (open); S-001.3" and a scenario S-001.3 with no test
- WHEN the trace runs
- THEN there is no untested-scenario finding for S-001.3
- AND a decisions warning says the decision is open and blocks S-001.3
- AND TRACE.md shows S-001.3 as blocked by an open decision

#### Scenario: A test of a blocked scenario is a warning {#S-006.7}

- GIVEN a decision "Greeting punctuation (open); S-001.1" and S-001.1's test passes
- WHEN the trace runs
- THEN a decisions warning says S-001.1 is tested while its decision is open, so the test assumes an answer nobody gave

#### Scenario: An open decision that names no scenario is a warning {#S-006.8}

- GIVEN a decision "Data retention (open)"
- WHEN the trace runs
- THEN a decisions warning says the decision is open

#### Scenario: A quoted (open) isn't the marker {#S-006.9}

- GIVEN a decision that describes the marker: 'Unanswered decisions are written "(open)" (free)'
- WHEN the trace runs
- THEN the decision isn't open, and there is no decisions finding about it

### Decisions

- open is written "(open)", like "(free)"; a bare "open" in a sentence doesn't count, because words like "open" turn up in decisions about other things, and a quoted "(open)" doesn't either, because a decision may be about the marker (pinned by S-006.9)
- A blocked scenario is still not proven, so its story can't be done until the decision is answered and the scenario tested (free)
- Answering a decision is an edit: replace "(open)" with the answer, and the scenarios it names become its pins (free)
