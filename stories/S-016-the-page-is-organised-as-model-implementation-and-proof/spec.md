# S-016 spec

The page's tabs become a left navigation with one inbox and three groups: **Model** (what should be: people,
stories, decisions, records, words), **Implementation** (what is: code, ports, layers) and **Proof** (how we know:
by tests, by a run, by a person, stale). Everything the page shows today finds exactly one home.

### Requirement: Organising the page {#S-016}

WHEN the page opens a project THE SYSTEM SHALL show a left navigation with Needs you on top and three groups, Model, Implementation and Proof, each screen of today's page placed under exactly one of them.

#### Scenario: Every screen has one home {#S-016.1}

- GIVEN the page is open on a project
- WHEN the navigation is read
- THEN Model holds People, Stories, Decisions, Records and Words; Implementation holds Code, Ports and Layers; Proof holds By tests, By a run, By a person and Stale; and no screen appears twice

#### Scenario: The old tab bar is gone {#S-016.2}

- GIVEN the page is open
- WHEN the top of the page is read
- THEN it shows the project switcher and the live indicator only; Decisions, Stories, Scenarios, Model, Findings and Personas are no longer tabs

#### Scenario: Each group carries its question {#S-016.3}

- GIVEN the page is open
- WHEN the navigation is read
- THEN Model is captioned "what should be", Implementation "what is" and Proof "how we know"

#### Scenario: Findings split by module {#S-016.4}

- GIVEN a project whose trace reports a `requirement-shape` finding, a `layers` finding and a stale proof
- WHEN the navigation is read
- THEN the requirement finding counts under Model, the layers finding under Implementation and the stale proof under Proof, and no single Findings screen exists

#### Scenario: Words is the shared vocabulary {#S-016.5}

- GIVEN a project whose `stories/` holds a file other than story folders, MODEL.md, PERSONAS.md and TRACE.md (for example GAME.md)
- WHEN Words is opened
- THEN that file is shown rendered, and when there is none Words says the project has no shared vocabulary yet

#### Scenario: The URL names the screen {#S-016.6}

- GIVEN the page is open on Proof › By a person for project `deadlight`
- WHEN the URL is read, and later opened fresh
- THEN it names the project and the screen, and opening it lands on the same screen

#### Scenario: A project without personas still has three groups {#S-016.7}

- GIVEN a project with no PERSONAS.md
- WHEN the navigation is read
- THEN all three groups are present and People says the project has no personas yet, with the offer to add one

### Decisions

- Records is MODEL.md (S-011) and People is the Personas tab (S-015), moved, not rebuilt (free)
- Scenarios are no longer a screen of their own; they live under their story (S-020) and in Proof by tier (free)
- Layers shows the layer rules and their violations, read from the same trace the CLI writes (free)
- The navigation's counts are the number of items on each screen that need a person, not the number of rows (pinned by S-016.4, S-018.5)
