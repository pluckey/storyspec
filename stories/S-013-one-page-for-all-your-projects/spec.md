# S-013 spec

### Requirement: One page for all your projects {#S-013}

WHEN storyspec ui starts THE SYSTEM SHALL list the storyspec projects in its folder and let the page read and edit any of them.

#### Scenario: The projects in the folder are listed {#S-013.1}

- GIVEN a folder holding three storyspec projects (one of them in a subfolder), a folder that isn't one, and a project inside node_modules
- WHEN the page asks for the projects
- THEN it gets the three projects, each with its number of stories and open decisions
- AND not the plain folder or the one inside node_modules

#### Scenario: The page opens on the project it was started in {#S-013.2}

- GIVEN storyspec ui started inside one of the projects
- WHEN the page asks for the projects
- THEN that project is the one to open first

#### Scenario: Started in the folder above, it lists every project {#S-013.3}

- GIVEN storyspec ui started in a folder that isn't itself a storyspec project
- WHEN the page asks for the projects
- THEN it gets every project under that folder, and the first is the one to open

#### Scenario: Reading and editing go to the chosen project {#S-013.4}

- GIVEN two projects, each with an open decision
- WHEN the page answers the second project's decision
- THEN only the second project's spec.md changes
- AND the state the page reads for the second project shows the answer

#### Scenario: A project that isn't listed is refused {#S-013.5}

- WHEN the page asks for the state of a project named ../../etc
- THEN the request is refused as not found

### Decisions

- The folder is where storyspec ui started, or the folder above it when that is itself a storyspec project, so starting it in any project shows its neighbours (free)
- A project is a folder with storyspec.config.json, up to three levels down, skipping node_modules, .git, dist and hidden folders; projects inside a project count too, as an app inside a monorepo is its own project (free)
- A project is named by its path within the folder, and only listed names are accepted, so the page can't reach outside the folder (pinned by S-013.5)
- The list counts stories and open decisions without running the trace, so it stays fast with many projects (free)
