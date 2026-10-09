# S-001 spec

### Requirement: Reading JUnit reports {#S-001}

WHEN a tier's test report is JUnit XML THE SYSTEM SHALL read each test's scenario and outcome from it, as it does from a Vitest report.

#### Scenario: Scenario IDs written the way the language allows {#S-001.1}

- GIVEN JUnit tests named `S-001.1 …`, `test_S_001_1_…`, `test_S_001_1__deployed__…`, or carrying a `scenario` property (and optionally `tier`)
- WHEN the trace reads their names
- THEN each names its scenario, and its tier when it gives one

#### Scenario: A test that names no tier ran in the reporting tier {#S-001.2}

- GIVEN a test named `test_S_001_1_greets` that names no tier
- WHEN it is read from the deployed tier's report
- THEN it counts for the deployed tier

#### Scenario: A name with no scenario proves nothing {#S-001.3}

- GIVEN tests named `test_greets`, `test_S_001`, `test_S_001_x`, `TEST_S_001_1` or `test_SS_001_1`
- WHEN the trace reads their names
- THEN none names a scenario

#### Scenario: A Python project is clean from its JUnit report {#S-001.4}

- GIVEN a Python project whose pytest report passes both of its story's scenarios
- WHEN the trace runs
- THEN it has no findings, the story is done, and no `scenarios.gen.ts` is needed

#### Scenario: A failed test fails its scenario {#S-001.5}

- GIVEN the report has a `<failure>` for `test_S_001_1_greets_by_name`
- WHEN the trace runs
- THEN S-001.1's test fails, with the failure's message

#### Scenario: A failure message keeps its line breaks {#S-001.6}

- GIVEN a failure message with an encoded line break (`&#10;`)
- WHEN the trace reports the failure
- THEN the message shows it as a new line

#### Scenario: A scenario no test ran is untested {#S-001.7}

- GIVEN the report has a test for only one of the story's two scenarios
- WHEN the trace runs
- THEN the other scenario has no test

#### Scenario: A test naming a scenario the spec lacks is an orphan {#S-001.8}

- GIVEN the report has a test for S-001.3, which spec.md doesn't have
- WHEN the trace runs
- THEN it reports an orphan test

#### Scenario: A failure outside any scenario fails the trace {#S-001.9}

- GIVEN a contract test with no scenario fails
- WHEN the trace runs
- THEN the trace fails on it

#### Scenario: A skipped test proves nothing {#S-001.10}

- GIVEN S-001.2's only test was skipped
- WHEN the trace runs
- THEN S-001.2 has not run and the story isn't done

#### Scenario: Another tier records what its command ran {#S-001.11}

- GIVEN a deployed tier whose JUnit report passes S-001.1 and fails S-001.2, by names that don't mention the tier
- WHEN `storyspec trace --tier deployed` reads it
- THEN PROOF.json records S-001.1 passed and S-001.2 failed in the deployed tier
