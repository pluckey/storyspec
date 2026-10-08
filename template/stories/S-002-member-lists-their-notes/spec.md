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

#### Scenario: The list reads well on a phone {#S-002.3 proof=manual}

- GIVEN Ana has ten notes with long titles
- WHEN she lists them on a phone
- THEN each title is readable without scrolling sideways, and a person has checked it (`npx storyspec prove S-002.3`)
