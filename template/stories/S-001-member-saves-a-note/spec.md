# S-001 spec

### Requirement: Saving a note {#S-001}

WHEN a member saves a note THE SYSTEM SHALL store it under that member with the current time, or reject it with a reason when its title is invalid.

#### Scenario: Valid note is saved {#S-001.1}

- GIVEN Ana is signed in and it is 09:00 on 1 January 2026
- WHEN she saves a note titled "Groceries"
- THEN the note is stored under Ana with that timestamp and returned

#### Scenario: Empty title is rejected {#S-001.2}

- GIVEN Ana is signed in
- WHEN she saves a note whose title is only spaces
- THEN she gets "Title is required" and nothing is stored

#### Scenario: Title is trimmed {#S-001.3}

- GIVEN Ana is signed in
- WHEN she saves a note titled "  Groceries  "
- THEN the stored title is "Groceries"

#### Scenario: Over-long title is rejected {#S-001.4}

- GIVEN Ana is signed in
- WHEN she saves a note whose title is 121 characters long
- THEN she gets "Title must be 120 characters or fewer" and nothing is stored
