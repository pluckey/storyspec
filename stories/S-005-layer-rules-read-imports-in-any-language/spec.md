# S-005 spec

### Requirement: Imports in any language {#S-005}

WHEN a project has source files in a language storyspec describes (Python) THE SYSTEM SHALL read their imports with ast-grep and check them against `layers` as it does TypeScript's.

#### Scenario: Python imports resolve to the repo's files {#S-005.1}

- GIVEN Python files that import with `import a.b`, `from a.b import c` (a name), `from a import b` (a submodule) and `from . import d` (relative)
- WHEN the trace builds the import graph
- THEN each import maps to the repo file it names, and imports of packages outside the repo are left out

#### Scenario: A Python layer violation is reported {#S-005.2}

- GIVEN `layers` lets app/domain import only app/domain
- WHEN app/domain/model.py imports app.adapters.db
- THEN the trace reports the import under the layers rule, and the same import from app/adapters is allowed

#### Scenario: Tests in other languages may name their scenarios {#S-005.3}

- GIVEN a pytest file outside the stories folder that marks a test `@pytest.mark.verifies("S-001.2")`
- WHEN the trace checks for story IDs outside stories
- THEN the test file isn't flagged, and a source file that mentions S-001.2 without being listed under implementedBy is
