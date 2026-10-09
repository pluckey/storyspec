# S-007 spec

### Requirement: Visitor reads an article {#S-007}

WHEN anyone asks for an article by its slug THE SYSTEM SHALL return it with its body.

#### Scenario: An article is returned by its slug {#S-007.1}

- GIVEN ana published an article
- WHEN a visitor opens its slug
- THEN the response is 200 with the article, body included, not favorited, 0 favorites

#### Scenario: An unknown slug is not found {#S-007.2}

- GIVEN no article has the slug nothing-here
- WHEN someone opens it
- THEN the response is 404 with article "not found"
