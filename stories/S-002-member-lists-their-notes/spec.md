# S-002 spec

### Requirement: Listing notes {#S-002}

WHEN a member lists notes THE SYSTEM SHALL return only that member's notes, newest first.

#### Scenario: Only my notes {#S-002.1}

- GIVEN Ana has a note and Ben has a note
- WHEN Ana lists her notes
- THEN she sees only her note

#### Scenario: Newest first {#S-002.2}

- GIVEN Ana saved "Old" on 1 January and "New" on 2 January
- WHEN Ana lists her notes
- THEN "New" comes before "Old"
