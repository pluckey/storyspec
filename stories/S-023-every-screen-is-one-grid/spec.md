# S-023 spec

One grid component draws every screen. A screen is a **definition**: its columns, its row source, its tabs (named
filters with counts) and what a row expands to. Needs you is the screen whose row source is a union of kinds.
People is the screen whose rows expand to a persona's journey. The only thing off the grid is the row of summary
cards above the home.

### Requirement: One grid {#S-023}

WHEN any screen is shown THE SYSTEM SHALL draw it with the one grid component from a definition of columns, row source, tabs and expansion, with search, column sort, filter tabs with counts, and rows that expand in place.

#### Scenario: Every screen is a definition {#S-023.1}

- GIVEN the page's screen definitions
- WHEN they are listed
- THEN there is exactly one for each of Needs you, People, Stories, Decisions, Records, Words, Code, Ports, Layers, By tests, By a run, By a person and Stale, and each names its columns, its row source, its tabs and its expansion, and nothing else

#### Scenario: The grid is the only list widget {#S-023.2}

- GIVEN the page's source
- WHEN its templates are read
- THEN every list of items on every screen is rendered by the grid component; no screen has its own list markup

#### Scenario: Search is the same everywhere {#S-023.3}

- GIVEN any screen with rows
- WHEN a word is typed in the search box
- THEN rows whose any column contains the word stay and the rest hide, the count updates, and expanded rows whose children match open at the match

#### Scenario: Columns sort {#S-023.4}

- GIVEN a screen with a state column and a since column
- WHEN the since column header is clicked, then clicked again
- THEN rows order by that column ascending, then descending, and the sort is kept in the URL hash

#### Scenario: Tabs are named filters with counts {#S-023.5}

- GIVEN Needs you with 2 decisions, 1 draft, 3 pending checks and 1 unclaimed file
- WHEN its tabs are read
- THEN they are All 7, Decide 2, Approve 1, Check 3, Claim 1, and picking one shows only that kind

#### Scenario: Needs you is a union {#S-023.6}

- GIVEN a project with an open decision, a draft story, a stale proof, a pending manual scenario and an unclaimed file
- WHEN Needs you is read as rows
- THEN every row has the same columns, kind, what, who, since and action, and the five kinds appear with the verbs Answer, Approve, Check again, Check and Claim

#### Scenario: Rows expand in place {#S-023.7}

- GIVEN Stories
- WHEN a story's row is expanded
- THEN its requirement and its scenarios appear beneath it as a nested grid with the same component, other rows do not move except to make room, and the expansion is kept in the URL hash

#### Scenario: A persona's row expands to the journey {#S-023.8}

- GIVEN People with persona `player` who has 11 stories done, 2 being built, none planned and 1 open decision
- WHEN the player row is read collapsed, then expanded
- THEN collapsed it says "11 can do today · 2 being built · 1 waiting", and expanded it shows four nested grids titled Waiting on them, Can do today, Being built and Planned

#### Scenario: The state cell carries the why {#S-023.9}

- GIVEN a row whose state is being built
- WHEN the state cell is opened
- THEN the why from S-017 appears, in the expanded row and on hover

#### Scenario: One action per row {#S-023.10}

- GIVEN any screen
- WHEN each row's action column is read
- THEN it holds at most one button with one verb from the vocabulary, and the primary action of the screen, if any, is in the header only

#### Scenario: An empty tab names its absence {#S-023.11}

- GIVEN People where persona `friend` has no story, and Needs you with no items
- WHEN each is read
- THEN the friend row says "no stories yet" with Start a story, and Needs you says nothing is waiting on a person

#### Scenario: The summary cards stay above the home {#S-023.12}

- GIVEN the home
- WHEN it is read at 1280 by 800
- THEN the cards from S-022.2 sit above the grid and the grid's first rows are visible without scrolling

#### Scenario: Column choice is remembered per screen {#S-023.13}

- GIVEN a person hides the since column on Stories
- WHEN they return to Stories later in the same browser
- THEN since is still hidden, and it is not hidden on other screens

#### Scenario: The same grid after a refresh {#S-023.14}

- GIVEN a screen with a sort, a tab and an expanded row
- WHEN the files change and the page refreshes
- THEN the sort, the tab and the expansion are as they were

#### Scenario: The page reads the same on every screen {#S-023.15 proof=manual}

- GIVEN a person who learned the grid on one screen
- WHEN they open each of the other twelve
- THEN they find the search, tabs, sort, expansion and action in the same places, and say nothing had to be relearned

### Decisions

- A screen definition is data in one module (`screens.ts`): `{ id, title, question, columns, source, tabs, expand }`; the router draws every screen from it, and a screen with its own markup is a layer violation of the ui (pinned by S-023.1, S-023.2)
- Nested grids use the same component with the parent's row as scope; depth is shown by a left bar and indentation, and nesting beyond two levels is not needed by any screen (pinned by S-023.7, S-023.8)
- Sort, tab and expansion live in the URL hash; column choice lives in the browser's local storage per screen (pinned by S-023.4, S-023.13, S-023.14)
- Tabs with a count of zero are shown disabled, not hidden, so the reader sees the kinds that exist (free)
- Row height is one line collapsed; a title that would wrap is truncated with the full text in the expanded row (free)
- The verbs are those of S-021's vocabulary; this story adds none (pinned by S-023.10)
- S-016 to S-022 remain the specification of what each screen contains; this story is only how it is drawn (free)
