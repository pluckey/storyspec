# S-018 spec

### Requirement: The inbox {#S-018}

WHEN the page opens a project THE SYSTEM SHALL land on Needs you, one list of everything waiting on a person across the three modules, each item with its action inline.

#### Scenario: Every kind of item appears once {#S-018.1}

- GIVEN a project with an open decision, a draft story, a stale proof, a manual scenario with no proof and a file no story claims
- WHEN Needs you is read
- THEN it lists five items: Decide, Approve, Check again, Check, Claim, each with that action

#### Scenario: An empty inbox says so {#S-018.2}

- GIVEN a project with nothing waiting on a person
- WHEN Needs you is read
- THEN it says there is nothing waiting and shows the three groups' summaries instead

#### Scenario: Acting removes the item {#S-018.3}

- GIVEN Needs you shows an open decision that blocks two scenarios
- WHEN the person answers it
- THEN the item is gone from the list and the two scenarios no longer read as blocked, in the same refresh

#### Scenario: Items name their owner {#S-018.4}

- GIVEN an open decision with owner `player`
- WHEN Needs you is read
- THEN the item says it waits on Player

#### Scenario: The count is the list {#S-018.5}

- GIVEN any project
- WHEN the number beside Needs you in the navigation is compared with the list
- THEN they are equal

#### Scenario: The page lands on the inbox {#S-018.6}

- GIVEN the page is opened with no screen in the URL
- WHEN it loads
- THEN Needs you is shown

### Decisions

- Items are ordered: decisions, then drafts, then stale proofs, then pending checks, then unclaimed code; within a kind by story ID (free)
- Claim offers to open the file's path and the story picker from S-002's `implementedBy:`; it does not edit code (free)
