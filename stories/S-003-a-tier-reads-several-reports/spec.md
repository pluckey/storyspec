# S-003 spec

### Requirement: Several reports per tier {#S-003}

WHEN `testReport` or a tier's `report` lists several files THE SYSTEM SHALL read the results of every one the run wrote.

#### Scenario: Results from every listed report count {#S-003.1}

- GIVEN `testReport` lists two JUnit files, one passing S-001.1 and one passing S-001.2
- WHEN the trace runs
- THEN both scenarios pass and the story is done

#### Scenario: A failure in any listed report fails the trace {#S-003.2}

- GIVEN the second report has a failing test that names no scenario
- WHEN the trace runs
- THEN the trace fails on it

#### Scenario: A listed report the run didn't write is skipped {#S-003.3}

- GIVEN `testReport` lists a report that doesn't exist beside one that does
- WHEN the trace runs
- THEN it reads the one that exists, with no finding about the other

#### Scenario: A run that wrote none of its reports fails {#S-003.4}

- GIVEN the tier's command writes none of the listed reports
- WHEN the trace runs the tests
- THEN it reports that the command wrote none of them
