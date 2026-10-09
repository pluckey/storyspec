# S-010 spec

### Requirement: Visitor lists articles {#S-010}

WHEN anyone lists articles THE SYSTEM SHALL return those matching the filters, newest first, a page at a time, with the total count and without their bodies.

#### Scenario: Articles are listed newest first without bodies {#S-010.1}

- GIVEN ana published two articles
- WHEN a visitor lists her articles
- THEN both are listed, the newer first, each without a body and with its author; the count is 2

#### Scenario: Articles are filtered by tag, author and favoriter {#S-010.2}

- GIVEN ana published one article tagged with a unique tag, and ben favorited it
- WHEN someone lists by that tag, by ana, and by articles ben favorited
- THEN each lists ana's article

#### Scenario: Limit and offset page through the list {#S-010.3}

- GIVEN ana published two articles
- WHEN someone lists her articles with limit 1, then limit 1 and offset 1
- THEN each page has one article, the newer then the older, and the count is 2 both times
