# S-014 spec

### Requirement: Visitor sees the tags in use {#S-014}

WHEN anyone asks for the tags THE SYSTEM SHALL list every tag on a published article.

#### Scenario: Tags of published articles are listed {#S-014.1}

- GIVEN ana published an article tagged with two unique tags
- WHEN a visitor asks for the tags
- THEN both tags are listed
