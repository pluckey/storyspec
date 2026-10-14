# S-009 spec

### Requirement: Generated scenario files are for TypeScript {#S-009}

WHEN the trace checks generated scenario files THE SYSTEM SHALL require one only for a story with TypeScript in its folder, or with nothing there yet in a TypeScript project.

#### Scenario: A new story in a TypeScript project needs one {#S-009.1}

- GIVEN a project with tsconfig.json and a story with nothing in its folder
- WHEN the trace runs
- THEN gen-fresh reports its scenarios.gen.ts missing

#### Scenario: A story in a project that isn't TypeScript doesn't {#S-009.2}

- GIVEN a project without tsconfig.json and a story with no implementedBy:
- WHEN the trace runs
- THEN there is no gen-fresh finding

#### Scenario: A story with TypeScript in its folder always does {#S-009.3}

- GIVEN a project without tsconfig.json and a story with a TypeScript test in its folder
- WHEN the trace runs
- THEN gen-fresh reports its scenarios.gen.ts missing

### Decisions

- A TypeScript project is one with tsconfig.json at its root, or TypeScript in any story's folder (free)
