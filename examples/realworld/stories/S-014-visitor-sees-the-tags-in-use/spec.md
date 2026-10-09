# S-014 spec

### Requirement: Visitor sees the tags in use {#S-014}

WHEN anyone asks for the tags THE SYSTEM SHALL list every tag on a published article.

#### Scenario: Tags of published articles are listed {#S-014.1}

- GIVEN ana published an article tagged with two unique tags
- WHEN a visitor asks for the tags
- THEN both tags are listed

#### Scenario: Tags are listed alphabetically {#S-014.2}

- GIVEN tags in use, some on more articles than others
- WHEN a visitor asks for the tags
- THEN they come back in alphabetical order by character code (the order Python's sorted() gives, not the database locale's), however often each is used

### Decisions

- Tags are listed by character code, with no limit; pinned by S-014.2. A locale's collation would order punctuation and case differently, and Postgres uses one by default
- A tag disappears when no article uses it (free)
