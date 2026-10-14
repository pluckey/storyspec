# S-014 spec

### Requirement: The page follows the files {#S-014}

WHEN a file in the open project changes THE SYSTEM SHALL tell the page, which reads the project again.

#### Scenario: An edit made outside the page reaches it {#S-014.1}

- GIVEN the page is following a project
- WHEN someone edits a story's spec.md in their editor
- THEN the page is told within a second, and the change names spec.md

#### Scenario: A new test report reaches it {#S-014.2}

- GIVEN the page is following a project
- WHEN a test run rewrites the project's test report
- THEN the page is told, so the results it shows are the new ones

#### Scenario: Changes in node_modules and .git don't {#S-014.3}

- GIVEN the page is following a project
- WHEN a file changes inside node_modules or .git
- THEN the page isn't told

#### Scenario: Changes close together arrive as one {#S-014.4}

- GIVEN the page is following a project
- WHEN three files change within a tenth of a second
- THEN the page is told once, naming all three

#### Scenario: A form being filled in isn't replaced {#S-014.5 proof=manual}

- GIVEN a person is typing an answer or editing a scenario on the page
- WHEN the project's files change
- THEN the form stays as it is, and the page says the files changed and offers to refresh

### Decisions

- Changes reach the page as server-sent events, which reconnect by themselves and need no library (free)
- The whole project is watched, not just stories/, because code and test reports change what the trace finds; node_modules, .git, dist, coverage and the trace's own TRACE.md are left out (pinned by S-014.3)
- Changes are gathered for a quarter of a second before the page is told, so an agent saving many files doesn't make the page reload many times (pinned by S-014.4)
- One watcher per project however many pages follow it, closed when the last one leaves (free)
