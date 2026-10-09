# S-007 spec

### Requirement: Code no story claims is reported {#S-007}

WHEN the trace runs THE SYSTEM SHALL warn about each code file no story claims, unless it is listed as deliberately unspecified.

#### Scenario: Code no story reaches is reported {#S-007.1}

- GIVEN a Python project whose story names app/greet.py, and an app/extra.py nothing imports
- WHEN the trace runs
- THEN app/extra.py gets an unclaimed-code warning, and app/greet.py doesn't

#### Scenario: Code joined to a story's code by imports is claimed {#S-007.2}

- GIVEN app/greet.py imports app/helpers.py, and app/cli.py imports app/greet.py
- WHEN the trace runs
- THEN neither helpers.py nor cli.py is reported: code that serves a story, or is served by it, counts

#### Scenario: Code listed as unspecified isn't reported {#S-007.3}

- GIVEN app/extra.py, with "unspecified": ["app/extra.py"] in the config
- WHEN the trace runs
- THEN it isn't reported

#### Scenario: Tests, build output, config and package markers aren't code to claim {#S-007.4}

- GIVEN tests/test_more.py, conftest.py, app/__init__.py, dist/bundle.js, vendor/lib.min.js and tool.config.js, none claimed
- WHEN the trace runs
- THEN none of them is reported

#### Scenario: Where imports can't be read, a story must name the file {#S-007.5}

- GIVEN a Swift file ios/Home.swift that no story names
- WHEN the trace runs, and then a story's implementedBy: names it
- THEN it is reported, and then it isn't

### Decisions

- A warning, not an error: unclaimed code may be a gap or a choice (free)
- Imports count in both directions, so adapters, entry points and presenters that serve stories are claimed (pinned by S-007.2)
- Deliberately unspecified code is listed in the config, not hidden by ignore, so the trace still sees it (pinned by S-007.3)
