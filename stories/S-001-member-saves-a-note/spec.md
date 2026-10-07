# S-001 spec

### Requirement: Saving a note {#S-001}

WHEN a member submits a note with a valid title THE SYSTEM SHALL store it under that member with the current time and return it.
WHEN the title is empty or longer than 120 characters THE SYSTEM SHALL reject the note with a reason and store nothing.

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
