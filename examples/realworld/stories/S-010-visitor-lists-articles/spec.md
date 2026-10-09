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

#### Scenario: Out-of-range limit and offset are clamped {#S-010.4}

- GIVEN at least one published article
- WHEN someone lists with limit 1000, and with offset -5
- THEN the first returns at most 100 articles, and the second is the same as offset 0

### Decisions

- limit defaults to 20 and is clamped to 0..100; a negative offset counts as 0; pinned by S-010.4
- Filters combine with AND; an unknown author, tag or favoriter gives an empty list, not 404 (free)
- Ties in time are broken by newest record first, so two articles published in the same instant list in a stable order (free)
